import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const bucketName = process.env.R2_ASSETS_BUCKET || "whatif-assets";
const accountId = process.env.R2_ACCOUNT_ID;
const endpoint =
  process.env.R2_ENDPOINT ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export function isR2AssetsConfigured() {
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

function createR2AssetsClient() {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 assets credentials are not configured.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadR2AssetObject(params: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  const client = createR2AssetsClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}
