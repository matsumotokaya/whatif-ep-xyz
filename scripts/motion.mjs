#!/usr/bin/env node
/**
 * Register a short video as a Motion work (Gallery series "motion").
 *
 *   npm run motion -- add <video-file> [--title "..."] [--released YYYY-MM-DD]
 *                         [--poster-at <seconds>] [--keep-audio] [--draft] [--dry-run]
 *
 * Steps: probe → strip audio + encode a full-size and a small preview MP4
 * (silent H.264, faststart) → extract a poster (WebP) → upload to the
 * whatif-assets R2 bucket → insert works + work_variants.
 *
 * - Audio is removed unless --keep-audio (only for audio the user has the
 *   rights to). Card previews are always silent, ≤10 s and ≤30 fps.
 * - The source file's SHA-256 is stored in works.source_notes; the same file
 *   is refused a second time.
 * - --dry-run encodes into a temp folder and prints the plan without uploading
 *   or writing to the database.
 *
 * Configuration: repository-local, gitignored .env.r2backfill.local
 * (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL).
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const run = promisify(execFile);
const SERIES_SLUG = "motion";
const EXPECTED_BUCKET = "whatif-assets";
const EXPECTED_SUPABASE_HOST = "rgqduwojvylkulhyodqg.supabase.co";

function parseArgs(argv) {
  const [command, file, ...rest] = argv;
  const options = { draft: false, dryRun: false, title: null, released: null, posterAt: null, keepAudio: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--draft") options.draft = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--keep-audio") options.keepAudio = true;
    else if (arg === "--title") options.title = rest[++i];
    else if (arg === "--released") options.released = rest[++i];
    else if (arg === "--poster-at") options.posterAt = Number(rest[++i]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (command !== "add" || !file) {
    throw new Error('Usage: npm run motion -- add <video-file> [--title "..."] [--released YYYY-MM-DD] [--poster-at <seconds>] [--keep-audio] [--draft] [--dry-run]');
  }
  if (options.posterAt !== null && !(options.posterAt >= 0)) {
    throw new Error("--poster-at must be a number of seconds");
  }
  if (options.released && !/^\d{4}-\d{2}-\d{2}$/.test(options.released)) {
    throw new Error("--released must be YYYY-MM-DD");
  }
  return { file: path.resolve(file), options };
}

async function probe(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_streams", "-show_format", file,
  ]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === "video");
  if (!video) throw new Error(`No video stream in ${file}`);
  return {
    width: video.width,
    height: video.height,
    duration: Number(info.format.duration),
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
  };
}

async function encode(input, output, { maxWidth, crf, maxrate, keepAudio = false, maxSeconds = null, maxFps = null }) {
  const filters = [`scale='min(${maxWidth},iw)':-2`];
  if (maxFps) filters.push(`fps='min(${maxFps},source_fps)'`);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    ...(maxSeconds ? ["-t", String(maxSeconds)] : []),
    "-map", "0:v:0",
    ...(keepAudio ? ["-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
    "-vf", filters.join(","),
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-maxrate", maxrate, "-bufsize", `${parseInt(maxrate, 10) * 2}M`,
    "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-movflags", "+faststart",
    output,
  ], { maxBuffer: 1024 * 1024 * 16 });
}

async function grabFrame(input, atSeconds, png) {
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(atSeconds), "-i", input, "-frames:v", "1", png,
  ]);
  return (await stat(png)).size;
}

// Poster: an explicit --poster-at time, or else the most detailed of 12 evenly
// spaced frames (largest PNG ≈ most detail). Reels often open on plain title or
// pattern frames, which make poor stills.
async function extractPoster(input, output, duration, posterAt) {
  const dir = path.dirname(output);
  let best = path.join(dir, "poster-src.png");
  if (posterAt !== null) {
    await grabFrame(input, posterAt, best);
  } else {
    let bestSize = -1;
    for (let i = 0; i < 12; i++) {
      const at = (duration * (i + 0.5)) / 12;
      const png = path.join(dir, `frame-${i}.png`);
      const size = await grabFrame(input, at.toFixed(3), png);
      if (size > bestSize) {
        bestSize = size;
        best = png;
      }
    }
  }
  await sharp(best).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 86 }).toFile(output);
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}

async function main() {
  const { file, options } = parseArgs(process.argv.slice(2));
  requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (new URL(process.env.SUPABASE_URL).host !== EXPECTED_SUPABASE_HOST) {
    throw new Error(`Refusing to run against ${process.env.SUPABASE_URL}; expected https://${EXPECTED_SUPABASE_HOST}`);
  }

  const source = await probe(file);
  const sourceStat = await stat(file);
  const sourceHash = await sha256(file);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: series, error: seriesError } = await supabase
    .from("work_series")
    .select("id, slug, number_padding")
    .eq("slug", SERIES_SLUG)
    .single();
  if (seriesError) throw new Error(`Series "${SERIES_SLUG}" not found: ${seriesError.message}`);

  const { data: duplicate } = await supabase
    .from("works")
    .select("display_code")
    .eq("series_id", series.id)
    .ilike("source_notes", `%source_sha256:${sourceHash}%`)
    .maybeSingle();
  if (duplicate) throw new Error(`Already registered as Motion ${duplicate.display_code}`);

  const { data: last } = await supabase
    .from("works")
    .select("sequence_number")
    .eq("series_id", series.id)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sequence = (last?.sequence_number ?? 0) + 1;
  const code = String(sequence).padStart(series.number_padding ?? 4, "0");
  const title = options.title ?? `MOTION ${code}`;
  const released = options.released ?? sourceStat.mtime.toISOString().slice(0, 10);

  const workDir = await mkdtemp(path.join(tmpdir(), "motion-"));
  try {
    const fullPath = path.join(workDir, "video.mp4");
    const previewPath = path.join(workDir, "preview.mp4");
    const posterPath = path.join(workDir, "poster.webp");
    if (options.keepAudio && !source.hasAudio) throw new Error("--keep-audio given but the source has no audio track");
    const audioLabel = !source.hasAudio ? "none" : options.keepAudio ? "kept on detail video" : "removed";
    console.log(`Encoding ${path.basename(file)} (${source.width}x${source.height}, ${source.duration.toFixed(1)}s, audio ${audioLabel})…`);
    await encode(file, fullPath, { maxWidth: 1080, crf: 23, maxrate: "4M", keepAudio: options.keepAudio });
    // Card preview: always silent, first 10 s at ≤30 fps so long videos stay light.
    await encode(file, previewPath, { maxWidth: 540, crf: 30, maxrate: "1M", maxSeconds: 10, maxFps: 30 });
    await extractPoster(file, posterPath, source.duration, options.posterAt);

    if ((await probe(previewPath)).hasAudio) throw new Error("Audio still present in the preview");
    if ((await probe(fullPath)).hasAudio !== options.keepAudio) {
      throw new Error(`Detail video audio mismatch (expected ${options.keepAudio ? "audio" : "silent"})`);
    }
    const full = await probe(fullPath);
    const files = [
      { local: fullPath, name: "video", ext: "mp4", type: "video/mp4" },
      { local: previewPath, name: "preview", ext: "mp4", type: "video/mp4" },
      { local: posterPath, name: "poster", ext: "webp", type: "image/webp" },
    ];
    for (const f of files) {
      f.hash = (await sha256(f.local)).slice(0, 12);
      f.size = (await stat(f.local)).size;
      f.key = `works/${SERIES_SLUG}/${code}/1/${f.name}-${f.hash}.${f.ext}`;
    }

    console.log(`\nMotion ${code}  "${title}"  released ${released}  ${options.draft ? "draft" : "published"}`);
    for (const f of files) console.log(`  ${f.key}  ${(f.size / 1024).toFixed(0)} KB`);

    if (options.dryRun) {
      console.log(`\nDry run: nothing uploaded or written. Encoded files: ${workDir}`);
      return { keepDir: true };
    }

    requireEnv(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"]);
    const bucket = process.env.R2_ASSETS_BUCKET || process.env.R2_BUCKET;
    if (bucket !== EXPECTED_BUCKET) throw new Error(`Refusing bucket "${bucket}"; expected "${EXPECTED_BUCKET}"`);
    const endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const r2 = new S3Client({
      region: "auto",
      endpoint,
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
        Body: await readFile(f.local),
        ContentType: f.type,
        CacheControl: "public, max-age=31536000, immutable",
      }));
      f.url = `${publicBase}/${f.key}`;
    }
    const [video, preview, poster] = files;

    const now = new Date().toISOString();
    const { data: work, error: workError } = await supabase
      .from("works")
      .insert({
        series_id: series.id,
        sequence_number: sequence,
        display_code: code,
        title,
        released_on: released,
        status: options.draft ? "draft" : "published",
        published_at: options.draft ? null : now,
        source_notes: `source: ${file}\nsource_sha256:${sourceHash}`,
      })
      .select("id")
      .single();
    if (workError) throw new Error(`works insert failed: ${workError.message}`);

    const { error: variantError } = await supabase.from("work_variants").insert({
      work_id: work.id,
      variant_number: 1,
      display_code: `${code}-1`,
      variant_type: "video",
      original_storage_key: poster.url,
      thumbnail_storage_key: poster.url,
      video_storage_key: video.url,
      video_preview_storage_key: preview.url,
      video_has_audio: options.keepAudio,
      width: full.width,
      height: full.height,
      status: "ready",
      sort_order: 1,
      is_primary: true,
    });
    if (variantError) {
      await supabase.from("works").delete().eq("id", work.id);
      throw new Error(`work_variants insert failed (work row rolled back): ${variantError.message}`);
    }

    console.log(`\nRegistered: https://whatif-ep.xyz/works/${SERIES_SLUG}/${code}`);
    console.log("Gallery caches refresh within 5 min (series list up to 1 h).");
    return { keepDir: false };
  } finally {
    // Keep the encoded files for inspection after a dry run.
    if (!options.dryRun) await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
