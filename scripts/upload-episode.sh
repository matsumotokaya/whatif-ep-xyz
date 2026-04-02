#!/usr/bin/env bash
# upload-episode.sh - Add a new episode to WHATIF Gallery
#
# Usage:
#   ./scripts/upload-episode.sh <PNG_FILE> [EPISODE_NUMBER] [PRODUCT_URL]
#
# Example:
#   ./scripts/upload-episode.sh ~/Desktop/0441.png
#   ./scripts/upload-episode.sh ~/Desktop/my-art.png 0441
#   ./scripts/upload-episode.sh ~/Desktop/0441.png 0441 https://whatif.stores.jp/items/xxx
#
# Requirements:
#   - AWS CLI configured with Cloudflare R2 credentials
#   - NEXT_PUBLIC_R2_BASE_URL set in .env.local
#   - ffmpeg installed (brew install ffmpeg)

set -euo pipefail

# ---- Load env ----
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | grep '=' | xargs)
fi

# ---- Config ----
R2_BUCKET="${R2_BUCKET:-whatif-ep}"
R2_PROFILE="${R2_PROFILE:-r2}"
THUMBNAIL_WIDTH=800
THUMBNAIL_QUALITY=85

# ---- Args ----
SOURCE_FILE="${1:-}"
if [ -z "$SOURCE_FILE" ]; then
  echo "Usage: $0 <PNG_FILE> [EPISODE_NUMBER] [PRODUCT_URL]"
  exit 1
fi

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Error: File not found: $SOURCE_FILE"
  exit 1
fi

# ---- Determine episode number ----
EPISODE_NUMBER="${2:-}"
if [ -z "$EPISODE_NUMBER" ]; then
  # Try to extract from filename (e.g. 0441.png → 0441)
  BASENAME=$(basename "$SOURCE_FILE" .png)
  BASENAME=$(basename "$BASENAME" .PNG)
  if [[ "$BASENAME" =~ ^[0-9]{4}$ ]]; then
    EPISODE_NUMBER="$BASENAME"
  else
    echo "Error: Could not detect episode number from filename."
    echo "Pass it explicitly: $0 <file> <number>"
    exit 1
  fi
fi

PRODUCT_URL="${3:-}"

echo "=== WHATIF Episode Upload ==="
echo "Episode : #$EPISODE_NUMBER"
echo "Source  : $SOURCE_FILE"
echo "Bucket  : $R2_BUCKET"
[ -n "$PRODUCT_URL" ] && echo "Product : $PRODUCT_URL"
echo ""

# ---- Generate thumbnail (WebP) ----
TMP_DIR=$(mktemp -d)
THUMBNAIL_PATH="$TMP_DIR/${EPISODE_NUMBER}.jpg"

echo "Generating thumbnail..."
ffmpeg -i "$SOURCE_FILE" \
  -vf "scale=${THUMBNAIL_WIDTH}:-1" \
  -q:v 3 \
  "$THUMBNAIL_PATH" -y -loglevel error

echo "  → $THUMBNAIL_PATH ($(du -sh "$THUMBNAIL_PATH" | cut -f1))"

# ---- Upload to R2 ----
echo "Uploading original..."
aws s3 cp "$SOURCE_FILE" \
  "s3://${R2_BUCKET}/originals/${EPISODE_NUMBER}.png" \
  --profile "$R2_PROFILE" \
  --content-type "image/png"

echo "Uploading thumbnail..."
aws s3 cp "$THUMBNAIL_PATH" \
  "s3://${R2_BUCKET}/thumbnails/${EPISODE_NUMBER}.jpg" \
  --profile "$R2_PROFILE" \
  --content-type "image/jpeg"

# ---- Update episodes.json ----
echo "Updating episodes.json..."

EPISODES_JSON="src/data/episodes.json"
EPISODE_ID=$((10#$EPISODE_NUMBER))

# Build new episode entry
NEW_EPISODE=$(node -e "
const data = JSON.parse(require('fs').readFileSync('$EPISODES_JSON', 'utf-8'));
const existing = data.episodes.find(e => e.id === $EPISODE_ID);
if (existing) {
  console.log('EXISTS');
} else {
  console.log('NEW');
}
")

if [ "$NEW_EPISODE" = "EXISTS" ]; then
  echo "  → Episode #$EPISODE_NUMBER already exists in episodes.json"
else
  node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$EPISODES_JSON', 'utf-8'));
const today = new Date().toISOString().split('T')[0];
data.episodes.push({
  id: $EPISODE_ID,
  number: '$EPISODE_NUMBER',
  title: 'Episode $EPISODE_NUMBER',
  category: '',
  hasOriginalPng: true,
  hasThumbnailJpg: true,
  productUrl: '${PRODUCT_URL}' || null,
  createdAt: today,
});
data.episodes.sort((a, b) => a.id - b.id);
data.total = data.episodes.length;
data.lastUpdated = today;
fs.writeFileSync('$EPISODES_JSON', JSON.stringify(data, null, 2));
console.log('  → Added episode #$EPISODE_NUMBER (total:', data.total, ')');
"
fi

# ---- Cleanup ----
rm -rf "$TMP_DIR"

echo ""
echo "Done! Episode #$EPISODE_NUMBER uploaded successfully."
echo ""
echo "Next steps:"
echo "  1. Commit: git add src/data/episodes.json && git commit -m 'add episode $EPISODE_NUMBER'"
echo "  2. Deploy: git push (Vercel auto-deploy)"
