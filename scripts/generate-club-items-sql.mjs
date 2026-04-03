#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifestPath = process.argv[2] || path.join(rootDir, "data", "club-assets-manifest.csv");
const outputPath = process.argv[3] || path.join(rootDir, "data", "club-items-upsert.sql");

const raw = fs.readFileSync(manifestPath, "utf8").trim();
const lines = raw.split("\n");
const header = lines.shift();

if (!header) {
  throw new Error("Manifest is empty");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function sqlString(value) {
  if (value === "" || value == null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function resolveSortOrder(row) {
  if (row.sortOrder && row.sortOrder !== "null") {
    return row.sortOrder;
  }

  const reelMatch = row.legacyDir.match(/^reel_(\d{4})_/);
  if (reelMatch) {
    return String(100000 + Number(reelMatch[1]));
  }

  return "999999";
}

const rows = lines
  .filter(Boolean)
  .map((line) => {
    const [
      legacyDir,
      kind,
      slug,
      title,
      description,
      ftpZipPath,
      ftpThumbPath,
      storageKey,
      coverStorageKey,
      fileName,
      fileSizeBytes,
      mimeType,
      isPublished,
      sortOrder,
    ] = parseCsvLine(line);

    return {
      legacyDir,
      kind,
      slug,
      title,
      description,
      ftpZipPath,
      ftpThumbPath,
      storageKey,
      coverStorageKey,
      fileName,
      fileSizeBytes,
      mimeType,
      isPublished,
      sortOrder,
    };
  });

const sql = rows
  .map((row) => {
    const publishedAt = row.isPublished === "true" ? "timezone('utc'::text, now())" : "null";
    const sortOrder = resolveSortOrder(row);

    return `insert into public.club_items (
  slug,
  title,
  description,
  kind,
  cover_image_url,
  storage_key,
  file_name,
  file_size_bytes,
  mime_type,
  is_published,
  published_at,
  sort_order
) values (
  ${sqlString(row.slug)},
  ${sqlString(row.title)},
  ${sqlString(row.description)},
  ${sqlString(row.kind)},
  ${sqlString(row.coverStorageKey)},
  ${sqlString(row.storageKey)},
  ${sqlString(row.fileName)},
  ${row.fileSizeBytes || "null"},
  ${sqlString(row.mimeType)},
  ${row.isPublished === "true" ? "true" : "false"},
  ${publishedAt},
  ${sortOrder}
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  kind = excluded.kind,
  cover_image_url = excluded.cover_image_url,
  storage_key = excluded.storage_key,
  file_name = excluded.file_name,
  file_size_bytes = excluded.file_size_bytes,
  mime_type = excluded.mime_type,
  is_published = excluded.is_published,
  published_at = excluded.published_at,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc'::text, now());`;
  })
  .join("\n\n");

fs.writeFileSync(outputPath, `${sql}\n`);
console.log(`Wrote ${rows.length} upserts to ${outputPath}`);
