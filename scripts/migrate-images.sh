#!/usr/bin/env bash
# migrate-images.sh - Download images from Lolipop FTP and upload to Cloudflare R2
#
# Usage: ./scripts/migrate-images.sh

set -euo pipefail

FTP_HOST="ftp.lolipop.jp"
FTP_USER="chicappa.jp-workflowdesign"
FTP_PASS="Sunsuns_001"
FTP_DIR="whatif-ep/img/ep_nc"

R2_BUCKET="whatif-ep-xyz"
R2_PROFILE="r2"

TMP_DIR="$(pwd)/tmp_images"
mkdir -p "$TMP_DIR"

echo "=== WHATIF Image Migration ==="
echo "FTP  : $FTP_HOST/$FTP_DIR"
echo "R2   : s3://$R2_BUCKET"
echo "Local: $TMP_DIR"
echo ""

# ---- Step 1: Download all images from FTP ----
echo "[1/2] Downloading from FTP..."
lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" -e "
  set net:timeout 30;
  set net:max-retries 5;
  set net:reconnect-interval-base 5;
  mirror --parallel=5 --verbose $FTP_DIR $TMP_DIR;
  quit
" 2>&1

echo ""
echo "Download complete. Files:"
ls "$TMP_DIR" | wc -l

# ---- Step 2: Upload to R2 ----
echo ""
echo "[2/2] Uploading to R2..."

# Upload PNGs → originals/
echo "  Uploading PNG originals..."
for f in "$TMP_DIR"/*.png "$TMP_DIR"/*.PNG; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  number="${name%.*}"
  aws s3 cp "$f" "s3://$R2_BUCKET/originals/${number,,}.png" \
    --profile "$R2_PROFILE" \
    --content-type "image/png" \
    --no-progress
  echo "  ✓ originals/${number,,}.png"
done

# Upload JPGs → thumbnails/
echo "  Uploading JPG thumbnails..."
for f in "$TMP_DIR"/*.jpg "$TMP_DIR"/*.JPG; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  number="${name%.*}"
  aws s3 cp "$f" "s3://$R2_BUCKET/thumbnails/${number,,}.jpg" \
    --profile "$R2_PROFILE" \
    --content-type "image/jpeg" \
    --no-progress
  echo "  ✓ thumbnails/${number,,}.jpg"
done

echo ""
echo "=== Migration complete! ==="
echo "Originals : $(aws s3 ls s3://$R2_BUCKET/originals/ --profile $R2_PROFILE | wc -l | tr -d ' ') files"
echo "Thumbnails: $(aws s3 ls s3://$R2_BUCKET/thumbnails/ --profile $R2_PROFILE | wc -l | tr -d ' ') files"
echo ""
echo "R2 public URL: https://pub-9339dc326a024891a297479881e66962.r2.dev"
