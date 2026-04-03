#!/usr/bin/env bash
# upload-club-assets.sh
# Upload The Club assets from Lolipop FTP to Cloudflare R2 based on a manifest CSV.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST_PATH="${1:-$ROOT_DIR/data/club-assets-manifest.csv}"

FTP_HOST="${FTP_HOST:-ftp.lolipop.jp}"
FTP_USER="${FTP_USER:-chicappa.jp-workflowdesign}"
FTP_PASS="${FTP_PASS:-Sunsuns_001}"
R2_BUCKET="${R2_BUCKET:-whatif-ep-xyz}"
R2_PROFILE="${R2_PROFILE:-r2}"

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "Manifest not found: $MANIFEST_PATH" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Uploading The Club assets..."
echo "Manifest : $MANIFEST_PATH"
echo "Bucket   : $R2_BUCKET"

tail -n +2 "$MANIFEST_PATH" | while IFS=, read -r legacy_dir kind slug title description ftp_zip_path ftp_thumb_path storage_key cover_storage_key file_name file_size_bytes mime_type is_published sort_order; do
  zip_path="$(printf '%s' "$ftp_zip_path" | sed 's/^"//; s/"$//')"
  thumb_path="$(printf '%s' "$ftp_thumb_path" | sed 's/^"//; s/"$//')"
  upload_key="$(printf '%s' "$storage_key" | sed 's/^"//; s/"$//')"
  cover_key="$(printf '%s' "$cover_storage_key" | sed 's/^"//; s/"$//')"

  zip_basename="$(basename "$zip_path")"
  local_zip="$TMP_DIR/$zip_basename"

  echo "Fetching $zip_path"
  lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" -e "
    set net:timeout 30;
    set net:max-retries 5;
    get $zip_path -o $local_zip;
    quit
  " >/dev/null

  echo "Uploading s3://$R2_BUCKET/$upload_key"
  aws s3 cp "$local_zip" "s3://$R2_BUCKET/$upload_key" \
    --profile "$R2_PROFILE" \
    --content-type "application/zip" \
    --no-progress

  rm -f "$local_zip"

  if [ -n "$thumb_path" ] && [ -n "$cover_key" ]; then
    thumb_basename="$(basename "$thumb_path")"
    local_thumb="$TMP_DIR/$thumb_basename"

    echo "Fetching $thumb_path"
    lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" -e "
      set net:timeout 30;
      set net:max-retries 5;
      get $thumb_path -o $local_thumb;
      quit
    " >/dev/null

    echo "Uploading s3://$R2_BUCKET/$cover_key"
    aws s3 cp "$local_thumb" "s3://$R2_BUCKET/$cover_key" \
      --profile "$R2_PROFILE" \
      --content-type "image/jpeg" \
      --no-progress

    rm -f "$local_thumb"
  fi
done

echo "Upload complete."
