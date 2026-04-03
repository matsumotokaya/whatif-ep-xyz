#!/usr/bin/env bash
# inventory-club-assets.sh
# Build a manifest of legacy The Club assets from Lolipop FTP.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_PATH="${1:-$ROOT_DIR/data/club-assets-manifest.csv}"

FTP_HOST="${FTP_HOST:-ftp.lolipop.jp}"
FTP_USER="${FTP_USER:-chicappa.jp-workflowdesign}"
FTP_PASS="${FTP_PASS:-Sunsuns_001}"
FTP_UPLOADS_DIR="${FTP_UPLOADS_DIR:-whatif-ep/the-club/uploads}"

TMP_DIR="$(mktemp -d)"
TOP_LEVEL_PATH="$TMP_DIR/top_level.txt"
MANIFEST_BODY="$TMP_DIR/manifest_body.csv"
OUTPUT_TMP="$TMP_DIR/club-assets-manifest.csv"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$(dirname "$OUTPUT_PATH")"
touch "$MANIFEST_BODY"

echo "Inventorying legacy The Club assets..."
echo "FTP     : $FTP_HOST/$FTP_UPLOADS_DIR"
echo "Output  : $OUTPUT_PATH"

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" -e "
  set net:timeout 30;
  set net:max-retries 5;
  set net:reconnect-interval-base 5;
  glob -a echo $FTP_UPLOADS_DIR/*;
  quit
" | tr ' ' '\n' > "$TOP_LEVEL_PATH"

printf '%s\n' \
  'legacy_dir,kind,slug,title,description,ftp_zip_path,ftp_thumb_path,storage_key,cover_storage_key,file_name,file_size_bytes,mime_type,is_published,sort_order' \
  > "$OUTPUT_TMP"

while IFS= read -r ftp_entry; do
  [ -n "$ftp_entry" ] || continue

  dir_name="$(basename "$ftp_entry")"
  listing_path="$TMP_DIR/${dir_name}.txt"

  if ! lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" -e "
    set net:timeout 30;
    set net:max-retries 5;
    set net:reconnect-interval-base 5;
    cls -l $ftp_entry;
    quit
  " > "$listing_path"; then
    echo "Skipping $dir_name (listing failed)" >&2
    continue
  fi

  zip_line="$(grep -Ei '\.zip$' "$listing_path" | head -n 1 || true)"
  thumb_line="$(grep -Ei 'thumb\.(jpg|jpeg|png)$' "$listing_path" | head -n 1 || true)"
  zip_name="$(printf '%s' "$zip_line" | awk 'NF {print $NF}')"
  thumb_name="$(printf '%s' "$thumb_line" | awk 'NF {print $NF}')"
  zip_name="$(basename "$zip_name" 2>/dev/null || true)"
  thumb_name="$(basename "$thumb_name" 2>/dev/null || true)"

  if [ -z "$zip_name" ]; then
    echo "Skipping $dir_name (no zip found)" >&2
    continue
  fi

  zip_size="$(printf '%s' "$zip_line" | awk 'NF {print $(NF-4); exit}')"

  ftp_zip_path="$ftp_entry/$zip_name"
  ftp_thumb_path=""
  storage_key=""
  cover_storage_key=""
  title=""
  description=""
  slug=""
  kind=""
  sort_order=""

  if [[ "$dir_name" =~ ^[0-9]{4}$ ]]; then
    kind="wallpaper"
    slug="wallpaper-$dir_name"
    title="PHONE WALLPAPER EPISODE #$dir_name | Smartphone Wallpaper (HD+QHD)"
    description="Download HD + QHD smartphone wallpapers for EPISODE #$dir_name."
    storage_key="club/wallpapers/$dir_name/$zip_name"
    sort_order="$((10#$dir_name))"

    if [ -n "$thumb_name" ]; then
      ftp_thumb_path="$ftp_entry/$thumb_name"
      cover_storage_key="club/wallpapers/$dir_name/$thumb_name"
    fi
  else
    kind="reel"
    slug="$(printf '%s' "$dir_name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
    title="$(printf '%s' "$dir_name" | sed -E 's/^reel_//' | tr '_' ' ')"
    description="Download the premium archive package for $title."
    storage_key="club/reels/$dir_name/$zip_name"
    if [[ "$dir_name" =~ ^reel_([0-9]{4})_ ]]; then
      sort_order="$((100000 + 10#${BASH_REMATCH[1]}))"
    else
      sort_order="999999"
    fi

    if [ -n "$thumb_name" ]; then
      ftp_thumb_path="$ftp_entry/$thumb_name"
      cover_storage_key="club/reels/$dir_name/$thumb_name"
    fi
  fi

  printf '"%s","%s","%s","%s","%s","%s","%s","%s","%s","%s",%s,"%s",true,%s\n' \
    "$dir_name" \
    "$kind" \
    "$slug" \
    "$title" \
    "$description" \
    "$ftp_zip_path" \
    "$ftp_thumb_path" \
    "$storage_key" \
    "$cover_storage_key" \
    "$zip_name" \
    "$zip_size" \
    "application/zip" \
    "${sort_order:-null}" \
    >> "$MANIFEST_BODY"
done < "$TOP_LEVEL_PATH"

sort "$MANIFEST_BODY" >> "$OUTPUT_TMP"
mv "$OUTPUT_TMP" "$OUTPUT_PATH"

row_count="$(( $(wc -l < "$OUTPUT_PATH") - 1 ))"
echo "Manifest created: $row_count items"
