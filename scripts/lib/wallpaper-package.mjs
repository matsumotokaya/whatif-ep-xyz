import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const SPECS = {
  portrait: { role: 'portrait_master', width: 1440, height: 2560 },
  landscape: { role: 'landscape_master', width: 2560, height: 1440 },
  feed: { role: 'instagram_feed', width: 1080, height: 1350 },
};
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateIdentity(value) {
  if (!value || value.version !== 1 || !['episode', 'reel', 'experiment', 'remix'].includes(value.series)
    || !Number.isSafeInteger(value.workNumber) || value.workNumber < 1
    || !Number.isSafeInteger(value.variant) || value.variant < 1) {
    throw new Error('Invalid package identity (version, series, workNumber, variant).');
  }
}

async function imageInfo(bytes) {
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  if ((metadata.pages ?? 1) !== 1) throw new Error('Animated/multi-page images are not supported.');
  const swapped = (metadata.orientation ?? 1) >= 5;
  return {
    width: swapped ? metadata.height : metadata.width,
    height: swapped ? metadata.width : metadata.height,
  };
}

export function checkRatio(slot, width, height) {
  const spec = SPECS[slot];
  if (!spec || !width || !height || width * spec.height !== height * spec.width) {
    throw new Error(`${slot}: expected ${spec?.width}:${spec?.height}, received ${width}x${height}. Prepare an explicit crop first; automatic cropping is disabled.`);
  }
}

// All inputs are checked before creating any output. No network or credentials.
export async function preparePackage(manifestPath, outputDir) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  validateIdentity(manifest);
  const inputs = {};
  for (const slot of Object.keys(SPECS)) {
    const file = manifest.sources?.[slot];
    if (typeof file !== 'string' || !file) throw new Error(`Missing source: ${slot}`);
    const absolute = path.resolve(path.dirname(manifestPath), file);
    const bytes = await readFile(absolute);
    const info = await imageInfo(bytes);
    checkRatio(slot, info.width, info.height);
    inputs[slot] = { bytes, info, filename: path.basename(absolute) };
  }
  // Never replace an existing reviewed package silently.
  await mkdir(outputDir, { recursive: false });
  const assets = {};
  for (const [slot, spec] of Object.entries(SPECS)) {
    const input = inputs[slot];
    const full = await sharp(input.bytes).rotate().resize(spec.width, spec.height, { fit: 'fill' }).png().toBuffer();
    const thumb = await sharp(full).resize({ width: 720, height: 720, fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
    const file = `${slot}.png`;
    const thumbnail = `${slot}-thumb.jpg`;
    await writeFile(path.join(outputDir, file), full, { flag: 'wx' });
    await writeFile(path.join(outputDir, thumbnail), thumb, { flag: 'wx' });
    assets[slot] = {
      ...spec, file, thumbnail, sha256: digest(full), thumbnailSha256: digest(thumb),
      source: { filename: input.filename, ...input.info, sha256: digest(input.bytes) },
    };
  }
  const pack = { version: 1, series: manifest.series, workNumber: manifest.workNumber, variant: manifest.variant, assets };
  await writeFile(path.join(outputDir, 'package.json'), JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
  return pack;
}

export async function loadPackage(packagePath) {
  const pack = JSON.parse(await readFile(packagePath, 'utf8'));
  validateIdentity(pack);
  const root = await realpath(path.dirname(packagePath));
  const files = {};
  for (const [slot, spec] of Object.entries(SPECS)) {
    const asset = pack.assets?.[slot];
    if (!asset || asset.role !== spec.role || asset.width !== spec.width || asset.height !== spec.height) {
      throw new Error(`Invalid package asset: ${slot}`);
    }
    const readAsset = async (filename) => {
      if (typeof filename !== 'string' || path.basename(filename) !== filename) throw new Error('Package paths must be plain filenames.');
      const target = await realpath(path.join(root, filename));
      if (path.dirname(target) !== root) throw new Error('Package symlinks cannot escape its directory.');
      return readFile(target);
    };
    const full = await readAsset(asset.file);
    const thumb = await readAsset(asset.thumbnail);
    if (digest(full) !== asset.sha256 || digest(thumb) !== asset.thumbnailSha256) throw new Error(`Package checksum mismatch: ${slot}`);
    const info = await imageInfo(full);
    if (info.width !== spec.width || info.height !== spec.height) throw new Error(`Package dimensions mismatch: ${slot}`);
    const thumbInfo = await imageInfo(thumb);
    checkRatio(slot, thumbInfo.width, thumbInfo.height);
    if (Math.max(thumbInfo.width, thumbInfo.height) > 720) throw new Error('Thumbnail too large.');
    files[slot] = { full, thumb };
  }
  return { pack, files };
}
