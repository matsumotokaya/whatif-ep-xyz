#!/usr/bin/env bash
# Generate thumbnails for episodes that have originals but no thumbnail in R2

set -euo pipefail

R2_BUCKET="whatif-ep-xyz"
R2_PROFILE="r2"
TMP_DIR=$(mktemp -d)

echo "Finding missing thumbnails..."
aws s3 ls s3://$R2_BUCKET/originals/ --profile $R2_PROFILE | grep "\.png" | awk '{print $4}' | sed 's/\.png//' | sort > /tmp/originals.txt
aws s3 ls s3://$R2_BUCKET/thumbnails/ --profile $R2_PROFILE | awk '{print $4}' | sed 's/\..*//' | sort | uniq > /tmp/thumbnails.txt
MISSING=$(comm -23 /tmp/originals.txt /tmp/thumbnails.txt)

COUNT=$(echo "$MISSING" | grep -c . || true)
echo "Missing thumbnails: $COUNT"
echo ""

for num in $MISSING; do
  ORIGINAL_PATH="$TMP_DIR/${num}.png"
  THUMBNAIL_PATH="$TMP_DIR/${num}.jpg"

  echo -n "  $num: downloading..."
  aws s3 cp "s3://$R2_BUCKET/originals/${num}.png" "$ORIGINAL_PATH" \
    --profile $R2_PROFILE --no-progress

  echo -n " generating..."
  ffmpeg -i "$ORIGINAL_PATH" -vf "scale=800:-1" -q:v 3 "$THUMBNAIL_PATH" -y -loglevel error

  echo -n " uploading..."
  aws s3 cp "$THUMBNAIL_PATH" "s3://$R2_BUCKET/thumbnails/${num}.jpg" \
    --profile $R2_PROFILE --content-type "image/jpeg" --no-progress

  rm -f "$ORIGINAL_PATH" "$THUMBNAIL_PATH"
  echo " done"
done

rm -rf "$TMP_DIR"
echo ""
echo "Complete! Generated $COUNT thumbnails."
