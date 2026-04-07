'use server';

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/admin/access";
import { isR2Configured, uploadR2Object } from "@/lib/r2";

export interface CreateEpisodeState {
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

export async function createEpisodeAction(
  _prevState: CreateEpisodeState,
  formData: FormData
): Promise<CreateEpisodeState> {
  const access = await getAdminAccess();

  if (!access.isAuthenticated) {
    redirect("/auth/login?next=%2Fepisodes%2Fnew");
  }

  if (!access.isAdmin) {
    return {
      message: "管理者のみエピソードを追加できます。",
    };
  }

  if (!isR2Configured()) {
    return {
      message: "R2 の接続情報が不足しています。.env.local を確認してください。",
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

  if (!isFileEntry(originalFile) || originalFile.size === 0) {
    return {
      message: "オリジナル画像の PNG / JPG ファイルを選択してください。",
    };
  }

  const originalExt = getOriginalExtension(originalFile);
  if (!originalExt) {
    return {
      message: "オリジナル画像は PNG / JPG のみ対応しています。",
    };
  }

  const id = Number.parseInt(number, 10);
  const originalStorageKey = `originals/${number}.${originalExt}`;
  let thumbnailStorageKey: string | null = null;
  const supabase = await createClient();

  const { data: existingEpisode } = await supabase
    .from("episodes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existingEpisode) {
    return {
      message: `Episode ${number} はすでに存在します。`,
    };
  }

  try {
    const originalBytes = new Uint8Array(await originalFile.arrayBuffer());

    await uploadR2Object({
      key: originalStorageKey,
      body: originalBytes,
      contentType: originalFile.type,
    });

    if (isFileEntry(thumbnailFile) && thumbnailFile.size > 0) {
      const thumbnailExt = getThumbnailExtension(thumbnailFile);
      if (!thumbnailExt) {
        return {
          message: "サムネイルは JPG / PNG / WebP のみ対応しています。",
        };
      }

      thumbnailStorageKey = `thumbnails/${number}.${thumbnailExt}`;

      await uploadR2Object({
        key: thumbnailStorageKey,
        body: new Uint8Array(await thumbnailFile.arrayBuffer()),
        contentType: thumbnailFile.type,
      });
    } else {
      thumbnailStorageKey = `thumbnails/${number}.jpg`;

      const generatedThumbnail = await sharp(Buffer.from(originalBytes))
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      await uploadR2Object({
        key: thumbnailStorageKey,
        body: new Uint8Array(generatedThumbnail),
        contentType: "image/jpeg",
      });
    }

    const { error } = await supabase.from("episodes").insert({
      id,
      number,
      title,
      category,
      product_url: productUrl,
      released_on: releasedOn,
      original_storage_key: originalStorageKey,
      thumbnail_storage_key: thumbnailStorageKey,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    });

    if (error) {
      return {
        message: `DB 保存に失敗しました: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `アップロードに失敗しました: ${error.message}`
          : "アップロードに失敗しました。",
    };
  }

  revalidatePath("/episodes");
  revalidatePath(`/episodes/${number}`);
  redirect(`/episodes/${number}`);
}
