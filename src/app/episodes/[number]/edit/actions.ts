'use server';

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/admin/access";
import { deleteR2Object, isR2Configured, uploadR2Object } from "@/lib/r2";

export interface EditEpisodeState {
  message: string | null;
}

function normalizeNumber(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string") return "";
  return rawValue.trim();
}

function normalizeString(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string") return "";
  return rawValue.trim();
}

function normalizeOptionalString(rawValue: FormDataEntryValue | null) {
  const value = normalizeString(rawValue);
  return value || null;
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function getThumbnailExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function getOriginalExtension(file: File) {
  switch (file.type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      return null;
  }
}

export async function updateEpisodeAction(
  _prevState: EditEpisodeState,
  formData: FormData
): Promise<EditEpisodeState> {
  const access = await getAdminAccess();

  if (!access.isAuthenticated) {
    redirect("/auth/login?next=%2Fepisodes");
  }

  if (!access.isAdmin) {
    return {
      message: "管理者のみエピソードを編集できます。",
    };
  }

  const number = normalizeNumber(formData.get("number"));
  const title = normalizeString(formData.get("title"));
  const category = normalizeString(formData.get("category"));
  const productUrl = normalizeOptionalString(formData.get("productUrl"));
  const releasedOn = normalizeOptionalString(formData.get("releasedOn"));
  const isPublished = formData.get("isPublished") === "on";
  const originalFile = formData.get("originalFile");
  const thumbnailFile = formData.get("thumbnailFile");

  if (!/^\d{4,}$/.test(number)) {
    return {
      message: "エピソード番号は4桁以上の数字で入力してください。",
    };
  }

  if (!title) {
    return {
      message: "タイトルを入力してください。",
    };
  }

  const supabase = await createClient();
  const { data: existingEpisode, error: existingError } = await supabase
    .from("episodes")
    .select("id, original_storage_key, thumbnail_storage_key, published_at")
    .eq("number", number)
    .maybeSingle();

  if (existingError) {
    return {
      message: `エピソード取得に失敗しました: ${existingError.message}`,
    };
  }

  if (!existingEpisode) {
    return {
      message: "指定されたエピソードが見つかりません。",
    };
  }

  const hasOriginalFile = isFileEntry(originalFile) && originalFile.size > 0;
  const hasThumbnailFile = isFileEntry(thumbnailFile) && thumbnailFile.size > 0;

  if ((hasOriginalFile || hasThumbnailFile) && !isR2Configured()) {
    return {
      message: "R2 の接続情報が不足しています。.env.local を確認してください。",
    };
  }

  const originalExt = hasOriginalFile ? getOriginalExtension(originalFile) : null;
  if (hasOriginalFile && !originalExt) {
    return {
      message: "オリジナル画像は PNG / JPG のみ対応しています。",
    };
  }

  let originalStorageKey = existingEpisode.original_storage_key;
  let thumbnailStorageKey = existingEpisode.thumbnail_storage_key;
  let originalBytes: Uint8Array | null = null;

  try {
    if (hasOriginalFile && originalExt) {
      const nextOriginalKey = `originals/${number}.${originalExt}`;
      originalBytes = new Uint8Array(await originalFile.arrayBuffer());

      await uploadR2Object({
        key: nextOriginalKey,
        body: originalBytes,
        contentType: originalFile.type,
      });

      if (existingEpisode.original_storage_key !== nextOriginalKey) {
        await deleteR2Object({ key: existingEpisode.original_storage_key });
      }

      originalStorageKey = nextOriginalKey;
    }

    if (hasThumbnailFile) {
      const thumbnailExt = getThumbnailExtension(thumbnailFile);
      if (!thumbnailExt) {
        return {
          message: "サムネイルは JPG / PNG / WebP のみ対応しています。",
        };
      }

      const nextThumbnailKey = `thumbnails/${number}.${thumbnailExt}`;
      await uploadR2Object({
        key: nextThumbnailKey,
        body: new Uint8Array(await thumbnailFile.arrayBuffer()),
        contentType: thumbnailFile.type,
      });

      if (
        existingEpisode.thumbnail_storage_key &&
        existingEpisode.thumbnail_storage_key !== nextThumbnailKey
      ) {
        await deleteR2Object({ key: existingEpisode.thumbnail_storage_key });
      }

      thumbnailStorageKey = nextThumbnailKey;
    } else if (hasOriginalFile && originalBytes) {
      const nextThumbnailKey = `thumbnails/${number}.jpg`;
      const generatedThumbnail = await sharp(Buffer.from(originalBytes))
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      await uploadR2Object({
        key: nextThumbnailKey,
        body: new Uint8Array(generatedThumbnail),
        contentType: "image/jpeg",
      });

      if (
        existingEpisode.thumbnail_storage_key &&
        existingEpisode.thumbnail_storage_key !== nextThumbnailKey
      ) {
        await deleteR2Object({ key: existingEpisode.thumbnail_storage_key });
      }

      thumbnailStorageKey = nextThumbnailKey;
    }

    const nextPublishedAt = isPublished
      ? existingEpisode.published_at ?? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from("episodes")
      .update({
        title,
        category,
        product_url: productUrl,
        released_on: releasedOn,
        original_storage_key: originalStorageKey,
        thumbnail_storage_key: thumbnailStorageKey,
        is_published: isPublished,
        published_at: nextPublishedAt,
      })
      .eq("id", existingEpisode.id);

    if (error) {
      return {
        message: `更新に失敗しました: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `更新に失敗しました: ${error.message}`
          : "更新に失敗しました。",
    };
  }

  revalidatePath("/episodes");
  revalidatePath(`/episodes/${number}`);
  revalidatePath(`/episodes/${number}/edit`);
  redirect(`/episodes/${number}`);
}

export async function deleteEpisodeAction(
  _prevState: EditEpisodeState,
  formData: FormData
): Promise<EditEpisodeState> {
  const access = await getAdminAccess();

  if (!access.isAuthenticated) {
    redirect("/auth/login?next=%2Fepisodes");
  }

  if (!access.isAdmin) {
    return {
      message: "管理者のみエピソードを削除できます。",
    };
  }

  const number = normalizeNumber(formData.get("number"));
  const confirmed = formData.get("confirmDelete") === "on";

  if (!confirmed) {
    return {
      message: "削除確認のチェックを入れてください。",
    };
  }

  if (!/^\d{4,}$/.test(number)) {
    return {
      message: "エピソード番号が不正です。",
    };
  }

  if (!isR2Configured()) {
    return {
      message: "R2 の接続情報が不足しています。.env.local を確認してください。",
    };
  }

  const supabase = await createClient();
  const { data: existingEpisode, error: existingError } = await supabase
    .from("episodes")
    .select("id, original_storage_key, thumbnail_storage_key")
    .eq("number", number)
    .maybeSingle();

  if (existingError) {
    return {
      message: `エピソード取得に失敗しました: ${existingError.message}`,
    };
  }

  if (!existingEpisode) {
    return {
      message: "指定されたエピソードが見つかりません。",
    };
  }

  try {
    await deleteR2Object({ key: existingEpisode.original_storage_key });
    if (existingEpisode.thumbnail_storage_key) {
      await deleteR2Object({ key: existingEpisode.thumbnail_storage_key });
    }

    const { error } = await supabase
      .from("episodes")
      .delete()
      .eq("id", existingEpisode.id);

    if (error) {
      return {
        message: `削除に失敗しました: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `削除に失敗しました: ${error.message}`
          : "削除に失敗しました。",
    };
  }

  revalidatePath("/episodes");
  redirect("/episodes");
}
