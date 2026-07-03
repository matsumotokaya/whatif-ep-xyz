/**
 * Phase 1 (M3): copy every Supabase Storage `user-images` object into the R2
 * assets bucket `whatif-assets` under the key `user-images/{original path}`.
 *
 * See docs/M3_ASSET_KEY_PLAN.md. This is a COPY only — the Supabase originals
 * are left untouched (they stay the read source for bare-key rows until Stage
 * C/D). The script is idempotent: objects already present on R2 (verified via
 * an authenticated S3 HEAD) are skipped, so it can be re-run safely.
 *
 * Verification uses the authenticated R2 S3 API endpoint, NOT the public
 * custom domain: Cloudflare negative-caches a pre-upload 404 and would then
 * serve that stale 404 right after the PUT. The S3 endpoint is read-after-write
 * consistent and has no CDN cache.
 *
 * Bucket safety: the destination is the ASSETS bucket (`whatif-assets`, served
 * from assets.whatif-ep.xyz), which is DIFFERENT from the legacy bucket
 * `whatif-ep-xyz` that .env.local's R2_BUCKET points at (used by src/lib/r2.ts).
 * This script therefore reads R2_ASSETS_BUCKET (default `whatif-assets`) and
 * refuses to run against the legacy bucket, so loading .env.local can't
 * misdirect the copy.
 *
 * Required env (do NOT hardcode values):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID (or R2_ENDPOINT)
 *   R2_ACCESS_KEY_ID          (must have write access to whatif-assets)
 *   R2_SECRET_ACCESS_KEY
 *   R2_ASSETS_BUCKET          (defaults to `whatif-assets`; NOT R2_BUCKET)
 *
 * IMPORTANT — which env file:
 *   Use ../imagine/.env.r2backfill.local, NOT whatif-ep-xyz/.env.local. The
 *   gallery .env.local R2 credentials are scoped to the LEGACY bucket
 *   `whatif-ep-xyz` and get 403 Access Denied on `whatif-assets`. The imagine
 *   backfill env file holds credentials with write access to `whatif-assets`
 *   (and R2_BUCKET=whatif-assets, though this script reads R2_ASSETS_BUCKET).
 *
 * Usage:
 *   # dry-run (lists what would be copied, no writes):
 *   node --env-file=../imagine/.env.r2backfill.local scripts/migrate-user-images-to-r2.mjs
 *
 *   # actually copy:
 *   node --env-file=../imagine/.env.r2backfill.local scripts/migrate-user-images-to-r2.mjs --apply
 *
 * Notes:
 *   - The Supabase JS Storage API caps `list()` at 100 rows per page and does
 *     not recurse, so this script walks the folder tree page by page.
 */

import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
// Deliberately NOT R2_BUCKET: that points at the legacy bucket in .env.local.
const R2_ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || 'whatif-assets';
const LEGACY_BUCKET = 'whatif-ep-xyz';

const APPLY = process.argv.includes('--apply');
const SOURCE_BUCKET = 'user-images';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!R2_ENDPOINT) missing.push('R2_ENDPOINT / R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// Guard: never write the assets copy into the legacy bucket by mistake.
if (R2_ASSETS_BUCKET === LEGACY_BUCKET) {
  console.error(
    `Refusing to run: target bucket is the legacy bucket "${LEGACY_BUCKET}". ` +
      `Set R2_ASSETS_BUCKET=whatif-assets (the assets.whatif-ep.xyz bucket).`,
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Authenticated HEAD against the S3 endpoint (read-after-write consistent).
const r2ObjectExists = async (r2Key) => {
  try {
    const res = await r2.send(
      new HeadObjectCommand({ Bucket: R2_ASSETS_BUCKET, Key: r2Key }),
    );
    return { exists: true, size: Number(res.ContentLength || 0) };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
      return { exists: false, size: 0 };
    }
    throw err;
  }
};

const r2Put = async (r2Key, body, contentType) => {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_ASSETS_BUCKET,
      Key: r2Key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }),
  );
};

// Recursively list every object path in the Supabase bucket. list() returns at
// most `limit` entries per call and treats folder-like prefixes as entries with
// a null `id`, so we recurse into those.
async function listAllObjects(prefix = '') {
  const paths = [];
  const pageSize = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.id === undefined) {
        // Folder-like prefix: recurse.
        const nested = await listAllObjects(entryPath);
        paths.push(...nested);
      } else {
        paths.push({ path: entryPath, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype });
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}

const downloadFromSupabase = async (path) => {
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).download(path);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, contentType: data.type || 'application/octet-stream' };
};

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (copying)' : 'DRY-RUN (no writes)'}`);
  console.log(`Source: Supabase bucket "${SOURCE_BUCKET}"`);
  console.log(`Target: R2 bucket "${R2_ASSETS_BUCKET}" key prefix "user-images/"`);

  console.log('\nListing Supabase objects (this may take a moment)...');
  const objects = await listAllObjects('');
  console.log(`Found ${objects.length} objects.`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let bytesCopied = 0;

  let i = 0;
  for (const obj of objects) {
    i += 1;
    const r2Key = `user-images/${obj.path}`;
    const label = `[${i}/${objects.length}] ${r2Key}`;
    try {
      const head = await r2ObjectExists(r2Key);
      if (head.exists) {
        skipped += 1;
        if (i % 50 === 0) console.log(`... ${i} processed (skipped present: ${skipped})`);
        continue;
      }
      if (!APPLY) {
        console.log(`DRY would copy ${label}`);
        copied += 1;
        continue;
      }
      const { buffer, contentType } = await downloadFromSupabase(obj.path);
      await r2Put(r2Key, buffer, obj.mime || contentType);
      const verify = await r2ObjectExists(r2Key);
      if (!verify.exists) throw new Error('post-PUT HEAD missing');
      copied += 1;
      bytesCopied += buffer.length;
      console.log(`copied ${label} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed += 1;
      console.warn(`FAILED ${label}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. copied=${copied} skipped(present)=${skipped} failed=${failed} ~${(
      bytesCopied / 1048576
    ).toFixed(1)} MB`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
