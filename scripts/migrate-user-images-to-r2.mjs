/**
 * Phase 1 (M3): copy every Supabase Storage `user-images` object into the R2
 * bucket `whatif-assets` under the key `user-images/{original path}`.
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
 * Required env (names match whatif-ep-xyz/.env.local; do NOT hardcode values):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET                 (defaults to `whatif-assets`)
 *
 * Usage:
 *   # dry-run (lists what would be copied, no writes):
 *   node --env-file=.env.local scripts/migrate-user-images-to-r2.mjs
 *
 *   # actually copy:
 *   node --env-file=.env.local scripts/migrate-user-images-to-r2.mjs --apply
 *
 * Notes:
 *   - `.env.local` sets R2_BUCKET=whatif-assets (the assets.whatif-ep.xyz
 *     bucket). Confirm it is NOT the r2-legacy `whatif-ep-xyz` bucket.
 *   - The Supabase JS Storage API caps `list()` at 100 rows per page and does
 *     not recurse, so this script walks the folder tree page by page.
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'whatif-assets';

const APPLY = process.argv.includes('--apply');
const SOURCE_BUCKET = 'user-images';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});

const encodeKey = (key) =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const r2Url = (r2Key) =>
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(r2Key)}`;

// Authenticated HEAD against the S3 endpoint (read-after-write consistent).
const r2ObjectExists = async (r2Key) => {
  const res = await r2.fetch(r2Url(r2Key), { method: 'HEAD' });
  if (res.ok) {
    return { exists: true, size: Number(res.headers.get('content-length') || 0) };
  }
  return { exists: false, size: 0 };
};

const r2Put = async (r2Key, body, contentType) => {
  const res = await r2.fetch(r2Url(r2Key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${detail}`);
  }
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
  console.log(`Target: R2 bucket "${R2_BUCKET}" key prefix "user-images/"`);

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
