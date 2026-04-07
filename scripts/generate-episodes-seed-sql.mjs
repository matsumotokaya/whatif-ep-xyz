import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = join(__dirname, "../src/data/episodes.json");

function sqlString(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlDate(value) {
  if (!value) {
    return "null";
  }
  return sqlString(value);
}

function sqlTimestampFromDate(value) {
  if (!value) {
    return "null";
  }
  return sqlString(`${value}T00:00:00Z`);
}

const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
const episodes = raw.episodes ?? [];

const rows = episodes.map((episode) => {
  const thumbnailStorageKey = episode.hasThumbnailJpg
    ? `thumbnails/${episode.number}.jpg`
    : null;

  return `(
  ${episode.id},
  ${sqlString(episode.number)},
  ${sqlString(episode.title)},
  ${sqlString(episode.category ?? "")},
  ${sqlString(episode.productUrl ?? null)},
  ${sqlDate(episode.createdAt || null)},
  ${sqlString(`originals/${episode.number}.png`)},
  ${sqlString(thumbnailStorageKey)},
  true,
  ${sqlTimestampFromDate(episode.createdAt || null)}
)`;
});

const sql = `begin;

insert into public.episodes (
  id,
  number,
  title,
  category,
  product_url,
  released_on,
  original_storage_key,
  thumbnail_storage_key,
  is_published,
  published_at
)
values
${rows.join(",\n")}
on conflict (id) do update
set
  number = excluded.number,
  title = excluded.title,
  category = excluded.category,
  product_url = excluded.product_url,
  released_on = excluded.released_on,
  original_storage_key = excluded.original_storage_key,
  thumbnail_storage_key = excluded.thumbnail_storage_key,
  is_published = excluded.is_published,
  published_at = excluded.published_at,
  updated_at = timezone('utc'::text, now());

commit;
`;

process.stdout.write(sql);
