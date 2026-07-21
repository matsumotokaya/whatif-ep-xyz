/**
 * Backfill lightweight Gallery-only thumbnails for works without feed_thumb.
 *
 * The script reads the public Gallery cards API and writes new, deterministic
 * objects to the R2 assets bucket. It does not update Supabase or replace any
 * source object. Existing destination objects are always skipped.
 *
 * Dry run:
 *   npm run backfill:gallery-thumbs
 *
 * Apply:
 *   npm run backfill:gallery-thumbs -- --apply
 *
 * Optional:
 *   --series=episode --concurrency=4 --limit=3 --all
 */

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const EXPECTED_BUCKET = "whatif-assets";
const GALLERY_BASE_URL = (
  process.env.GALLERY_BASE_URL || "https://whatif-ep.xyz"
).replace(/\/+$/, "");
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ASSETS_BUCKET =
  process.env.R2_ASSETS_BUCKET || process.env.R2_BUCKET;

const APPLY = process.argv.includes("--apply");
const INCLUDE_ALL = process.argv.includes("--all");
const seriesArg = process.argv.find((arg) => arg.startsWith("--series="));
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const SERIES = seriesArg?.slice("--series=".length) || "episode";
const CONCURRENCY = Number(concurrencyArg?.slice("--concurrency=".length) || 4);
const LIMIT = limitArg ? Number(limitArg.slice("--limit=".length)) : null;
const PAGE_SIZE = 100;
const THUMB_WIDTH = 576;
const THUMB_HEIGHT = 720;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const missing = [];
if (!R2_ENDPOINT) missing.push("R2_ENDPOINT / R2_ACCOUNT_ID");
if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
if (!R2_ASSETS_BUCKET) missing.push("R2_ASSETS_BUCKET / R2_BUCKET");
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}
if (R2_ASSETS_BUCKET !== EXPECTED_BUCKET) {
  throw new Error(
    `Refusing to run against bucket "${R2_ASSETS_BUCKET}"; expected "${EXPECTED_BUCKET}".`
  );
}
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 10) {
  throw new Error("--concurrency must be an integer from 1 to 10.");
}
if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT < 1)) {
  throw new Error("--limit must be a positive integer.");
}

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function thumbnailKey(work) {
  const seriesSegment = encodeURIComponent(work.seriesSlug);
  const codeSegment = encodeURIComponent(work.displayCode);
  return `gallery-thumbs/v1/${seriesSegment}/${codeSegment}.webp`;
}

async function objectHead(key) {
  try {
    const response = await r2.send(
      new HeadObjectCommand({ Bucket: R2_ASSETS_BUCKET, Key: key })
    );
    return {
      exists: true,
      size: Number(response.ContentLength || 0),
      contentType: response.ContentType || null,
    };
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") {
      return { exists: false, size: 0, contentType: null };
    }
    throw error;
  }
}

async function fetchCatalog() {
  const items = [];
  let offset = 0;

  for (;;) {
    const url = new URL(`/api/works/${encodeURIComponent(SERIES)}/cards`, GALLERY_BASE_URL);
    url.searchParams.set("sort", "oldest");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(PAGE_SIZE));

    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Gallery API returned ${response.status} for offset ${offset}.`);
    }

    const page = await response.json();
    if (!Array.isArray(page.items)) {
      throw new Error(`Gallery API returned an invalid page for offset ${offset}.`);
    }
    items.push(...page.items);

    if (!page.hasMore || page.items.length === 0) break;
    offset += page.items.length;
  }

  return items;
}

async function downloadFirstUsableSource(work) {
  const candidates = Array.isArray(work.imageCandidates)
    ? work.imageCandidates.filter((url) => typeof url === "string" && url.length > 0)
    : [];

  for (const sourceUrl of candidates) {
    try {
      const response = await fetch(sourceUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;
      return { sourceUrl, buffer: Buffer.from(await response.arrayBuffer()) };
    } catch {
      // Try the next source candidate. The final error includes the work code.
    }
  }

  throw new Error(`No usable source image for ${work.seriesSlug}/${work.displayCode}.`);
}

async function renderThumbnail(sourceBuffer) {
  return sharp(sourceBuffer, { failOn: "warning" })
    .rotate()
    .resize({
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, smartSubsample: true })
    .toBuffer();
}

async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const results = new Array(items.length);

  async function runWorker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );
  return results;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Series: ${SERIES}`);
  console.log(`Target bucket: ${R2_ASSETS_BUCKET}`);

  const catalog = await fetchCatalog();
  const eligible = INCLUDE_ALL
    ? catalog
    : catalog.filter((work) => !work.feedThumbUrl);
  const selected = LIMIT === null ? eligible : eligible.slice(0, LIMIT);
  console.log(
    `Catalog: ${catalog.length}; eligible: ${eligible.length}; selected: ${selected.length}; ` +
      `already has feed_thumb: ${catalog.length - eligible.length}`
  );

  let present = 0;
  let created = 0;
  let failed = 0;
  let bytesCreated = 0;

  await mapWithConcurrency(selected, CONCURRENCY, async (work, index) => {
    const key = thumbnailKey(work);
    const label = `[${index + 1}/${selected.length}] ${work.seriesSlug}/${work.displayCode}`;

    try {
      const existing = await objectHead(key);
      if (existing.exists) {
        present += 1;
        if ((index + 1) % 50 === 0) {
          console.log(`${label}: already present`);
        }
        return;
      }

      if (!APPLY) {
        created += 1;
        console.log(`${label}: would create`);
        return;
      }

      const { buffer: sourceBuffer } = await downloadFirstUsableSource(work);
      const thumbnail = await renderThumbnail(sourceBuffer);
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_ASSETS_BUCKET,
          Key: key,
          Body: thumbnail,
          ContentType: "image/webp",
          CacheControl: CACHE_CONTROL,
        })
      );

      const verified = await objectHead(key);
      if (!verified.exists || verified.contentType !== "image/webp") {
        throw new Error("Uploaded object failed verification.");
      }

      created += 1;
      bytesCreated += thumbnail.length;
      console.log(`${label}: created ${(thumbnail.length / 1024).toFixed(0)} KB`);
    } catch (error) {
      failed += 1;
      console.error(`${label}: FAILED ${error instanceof Error ? error.message : error}`);
    }
  });

  console.log(
    `Done: present=${present}, ${APPLY ? "created" : "would-create"}=${created}, ` +
      `failed=${failed}, bytes=${(bytesCreated / 1048576).toFixed(1)} MB`
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
