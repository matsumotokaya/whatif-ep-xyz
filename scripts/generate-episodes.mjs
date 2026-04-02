// Generate episodes.json from old project data files
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oldDataDir = join(__dirname, "../../whatif-ep-xyz-v1/data");
const outputPath = join(__dirname, "../data/episodes.json");

// Read source data
const meta = JSON.parse(readFileSync(join(oldDataDir, "meta.json"), "utf-8"));
const productUrls = JSON.parse(
  readFileSync(join(oldDataDir, "product-urls.json"), "utf-8")
);

const episodes = [];

for (const [filename, info] of Object.entries(meta)) {
  const number = filename.replace(".png", "");
  const id = parseInt(number, 10);
  const product = productUrls[number];

  episodes.push({
    id,
    number,
    title: info.title || `Episode ${number}`,
    category: info.category || "",
    hasOriginalPng: true,
    hasThumbnailJpg: id <= 369, // JPG thumbnails exist for first ~369
    productUrl: product?.url || null,
    createdAt: "", // will be populated later if needed
  });
}

// Sort by id
episodes.sort((a, b) => a.id - b.id);

const output = {
  episodes,
  total: episodes.length,
  lastUpdated: new Date().toISOString().split("T")[0],
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Generated ${episodes.length} episodes → ${outputPath}`);
