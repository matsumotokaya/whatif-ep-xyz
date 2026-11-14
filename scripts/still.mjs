#!/usr/bin/env node
/**
 * Register a finished still image (credited feed image) as a Gallery work in a
 * non-Content-Factory series such as "experiment".
 *
 *   npm run still -- add <image> --series experiment [--title "..."]
 *        [--summary "..."] [--tag "Label"]... [--released YYYY-MM-DD]
 *        [--draft] [--dry-run]
 *
 * Uploads the original file plus a 720px WebP list thumbnail to the
 * whatif-assets R2 bucket (works/<series>/<code>/1/), then inserts works +
 * work_variants (+ work_tags / work_tag_map for each --tag, created if new,
 * tag_type 'general'). The source SHA-256 is stored in works.source_notes and
 * the same file is refused twice. Episode works come from Content Factory —
 * this script refuses series "episode".
 *
 * Configuration: repository-local, gitignored .env.r2backfill.local.
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_BUCKET = "whatif-assets";
const EXPECTED_SUPABASE_HOST = "rgqduwojvylkulhyodqg.supabase.co";
const USAGE =
  'Usage: npm run still -- add <image> --series <slug> [--title "..."] [--summary "..."] [--tag "Label"]... [--released YYYY-MM-DD] [--draft] [--dry-run]';

function parseArgs(argv) {
  const [command, file, ...rest] = argv;
  const options = { series: null, title: null, summary: null, tags: [], released: null, draft: false, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--series") options.series = rest[++i];
    else if (arg === "--title") options.title = rest[++i];
    else if (arg === "--summary") options.summary = rest[++i];
    else if (arg === "--tag") options.tags.push(rest[++i]);
    else if (arg === "--released") options.released = rest[++i];
    else if (arg === "--draft") options.draft = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (command !== "add" || !file || !options.series) throw new Error(USAGE);
  if (options.series === "episode") throw new Error("Episode works are registered through Content Factory.");
  if (options.released && !/^\d{4}-\d{2}-\d{2}$/.test(options.released)) {
    throw new Error("--released must be YYYY-MM-DD");
  }
  return { file: path.resolve(file), options };
}

const slugify = (label) =>
  label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}

async function main() {
  const { file, options } = parseArgs(process.argv.slice(2));
  requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (new URL(process.env.SUPABASE_URL).host !== EXPECTED_SUPABASE_HOST) {
    throw new Error(`Refusing to run against ${process.env.SUPABASE_URL}`);
  }

  const original = await readFile(file);
  const sourceHash = createHash("sha256").update(original).digest("hex");
  const meta = await sharp(original).metadata();
  const ext = (meta.format === "jpeg" ? "jpg" : meta.format) ?? path.extname(file).slice(1);
  const contentType = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext];
  if (!contentType) throw new Error(`Unsupported image format: ${meta.format}`);
  const thumb = await sharp(original).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: series, error: seriesError } = await supabase
    .from("work_series")
    .select("id, slug, number_padding")
    .eq("slug", options.series)
    .single();
  if (seriesError) throw new Error(`Series "${options.series}" not found: ${seriesError.message}`);

  const { data: duplicate } = await supabase
    .from("works")
    .select("display_code")
    .eq("series_id", series.id)
    .ilike("source_notes", `%source_sha256:${sourceHash}%`)
    .maybeSingle();
  if (duplicate) throw new Error(`Already registered as ${options.series} ${duplicate.display_code}`);

  const { data: last } = await supabase
    .from("works")
    .select("sequence_number")
    .eq("series_id", series.id)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sequence = (last?.sequence_number ?? 0) + 1;
  const code = String(sequence).padStart(series.number_padding ?? 4, "0");
  const title = options.title ?? `${options.series.toUpperCase()} ${code}`;
  const released = options.released ?? (await stat(file)).mtime.toISOString().slice(0, 10);

  const short = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 12);
  const files = [
    { body: original, key: `works/${options.series}/${code}/1/original-${short(original)}.${ext}`, type: contentType },
    { body: thumb, key: `works/${options.series}/${code}/1/thumb-${short(thumb)}.webp`, type: "image/webp" },
  ];

  console.log(`${options.series} ${code}  "${title}"  ${meta.width}x${meta.height}  released ${released}  ${options.draft ? "draft" : "published"}`);
  if (options.tags.length) console.log(`  tags: ${options.tags.join(", ")}`);
  for (const f of files) console.log(`  ${f.key}  ${(f.body.length / 1024).toFixed(0)} KB`);
  if (options.dryRun) {
    console.log("Dry run: nothing uploaded or written.");
    return;
  }

  requireEnv(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"]);
  const bucket = process.env.R2_ASSETS_BUCKET || process.env.R2_BUCKET;
  if (bucket !== EXPECTED_BUCKET) throw new Error(`Refusing bucket "${bucket}"; expected "${EXPECTED_BUCKET}"`);
  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const publicBase = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  for (const f of files) {
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: f.key,
      Body: f.body,
      ContentType: f.type,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    f.url = `${publicBase}/${f.key}`;
  }
  const [originalFile, thumbFile] = files;

  const { data: work, error: workError } = await supabase
    .from("works")
    .insert({
      series_id: series.id,
      sequence_number: sequence,
      display_code: code,
      title,
      summary: options.summary,
      released_on: released,
      status: options.draft ? "draft" : "published",
      published_at: options.draft ? null : new Date().toISOString(),
      source_notes: `source: ${file}\nsource_sha256:${sourceHash}`,
    })
    .select("id")
    .single();
  if (workError) throw new Error(`works insert failed: ${workError.message}`);

  const rollback = async (message) => {
    await supabase.from("works").delete().eq("id", work.id);
    throw new Error(`${message} (work row rolled back)`);
  };

  const { error: variantError } = await supabase.from("work_variants").insert({
    work_id: work.id,
    variant_number: 1,
    display_code: `${code}-1`,
    variant_type: "image",
    original_storage_key: originalFile.url,
    thumbnail_storage_key: thumbFile.url,
    width: meta.width,
    height: meta.height,
    status: "ready",
    sort_order: 1,
    is_primary: true,
  });
  if (variantError) await rollback(`work_variants insert failed: ${variantError.message}`);

  for (const label of options.tags) {
    const slug = slugify(label);
    // Reuse an existing tag as-is (never rewrite its label/type); create if new.
    let { data: tag } = await supabase.from("work_tags").select("id").eq("slug", slug).maybeSingle();
    if (!tag) {
      const inserted = await supabase
        .from("work_tags")
        .insert({ slug, label, tag_type: "general" })
        .select("id")
        .single();
      if (inserted.error) await rollback(`work_tags insert failed: ${inserted.error.message}`);
      tag = inserted.data;
    }
    const { error: mapError } = await supabase.from("work_tag_map").insert({ work_id: work.id, tag_id: tag.id });
    if (mapError) await rollback(`work_tag_map insert failed: ${mapError.message}`);
  }

  console.log(`Registered: https://whatif-ep.xyz/works/${options.series}/${code}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
