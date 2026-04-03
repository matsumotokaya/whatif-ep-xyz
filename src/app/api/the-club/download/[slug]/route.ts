import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getClubAccess, canAccessClub } from "@/lib/club/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bucketName = process.env.R2_BUCKET ?? "whatif-ep-xyz";
const publicBaseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL;
const accountId = process.env.R2_ACCOUNT_ID;
const endpoint =
  process.env.R2_ENDPOINT ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

const r2Client =
  endpoint && r2AccessKeyId && r2SecretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        },
      })
    : null;

function buildContentDisposition(fileName: string) {
  const safeName = fileName.replace(/"/g, "");
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
}

function buildPublicObjectUrl(storageKey: string) {
  if (!publicBaseUrl) return null;

  const base = publicBaseUrl.endsWith("/")
    ? publicBaseUrl
    : `${publicBaseUrl}/`;

  return new URL(storageKey, base);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  const access = await getClubAccess();

  if (access.status === "anonymous") {
    return NextResponse.redirect(
      new URL(`/auth/login?next=/the-club/${slug}`, origin)
    );
  }

  if (!canAccessClub(access)) {
    return NextResponse.redirect(
      new URL("/the-club", origin)
    );
  }

  if (!r2Client) {
    return NextResponse.json(
      { error: "R2 credentials are not configured." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("club_items")
    .select("slug, storage_key, file_name, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !item || !item.is_published) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  if (!r2Client) {
    const publicUrl = buildPublicObjectUrl(item.storage_key);
    if (publicUrl) {
      const response = NextResponse.redirect(publicUrl);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    return NextResponse.json(
      { error: "R2 credentials are not configured." },
      { status: 500 }
    );
  }

  const signedUrl = await getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: item.storage_key,
      ResponseContentDisposition: buildContentDisposition(item.file_name),
    }),
    { expiresIn: 60 * 60 }
  );

  const response = NextResponse.redirect(signedUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
