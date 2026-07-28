#!/usr/bin/env bash
# fetch-resource.sh — download a brandbook CSS file or sample .pptx from a URL.
# Handles Google Drive share links by extracting the file ID and using the direct-download endpoint.
# Usage: bash fetch-resource.sh <url> <dest-path>

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <url> <dest-path>" >&2
  exit 1
fi

URL="$1"
DEST="$2"
DEST_DIR="$(dirname "$DEST")"
mkdir -p "$DEST_DIR"

extract_drive_id() {
  local url="$1"
  if [[ "$url" =~ /file/d/([a-zA-Z0-9_-]+) ]]; then
    echo "${BASH_REMATCH[1]}"; return
  fi
  if [[ "$url" =~ [?&]id=([a-zA-Z0-9_-]+) ]]; then
    echo "${BASH_REMATCH[1]}"; return
  fi
  if [[ "$url" =~ /document/d/([a-zA-Z0-9_-]+) ]] || [[ "$url" =~ /presentation/d/([a-zA-Z0-9_-]+) ]]; then
    echo "${BASH_REMATCH[1]}"; return
  fi
  echo ""
}

is_drive() {
  [[ "$1" =~ drive\.google\.com ]] || [[ "$1" =~ docs\.google\.com ]]
}

if is_drive "$URL"; then
  FILE_ID="$(extract_drive_id "$URL")"
  if [ -z "$FILE_ID" ]; then
    echo "Could not extract a Google Drive file ID from: $URL" >&2
    echo "Expected formats:" >&2
    echo "  https://drive.google.com/file/d/<FILE_ID>/view" >&2
    echo "  https://drive.google.com/open?id=<FILE_ID>" >&2
    exit 2
  fi
  DOWNLOAD_URL="https://drive.google.com/uc?export=download&id=${FILE_ID}"
  echo "→ Fetching Google Drive file ${FILE_ID}" >&2
  # First request: may return HTML (virus-scan / login wall) or the file itself.
  curl -L -sS --fail-with-body -A "Mozilla/5.0" -c /tmp/.gdrive-cookies "$DOWNLOAD_URL" -o "$DEST" || {
    echo "Download failed. The file may require login or sharing as 'Anyone with the link'." >&2
    rm -f "$DEST" 2>/dev/null || true
    exit 3
  }
  # If we got an HTML virus-scan page, it'll contain "uc-download-warning" — extract confirm token.
  if head -c 200 "$DEST" | grep -q "<!DOCTYPE html"; then
    CONFIRM="$(grep -oE 'confirm=[a-zA-Z0-9_-]+' "$DEST" | head -1 | cut -d= -f2 || true)"
    if [ -n "$CONFIRM" ]; then
      curl -L -sS --fail-with-body -A "Mozilla/5.0" -b /tmp/.gdrive-cookies \
        "https://drive.google.com/uc?export=download&confirm=${CONFIRM}&id=${FILE_ID}" -o "$DEST"
    else
      echo "Got HTML (login wall or virus scan)." >&2
      echo "Tell the user to share the file as 'Anyone with the link', or download manually." >&2
      head -c 500 "$DEST" >&2
      echo "" >&2
      rm -f "$DEST"
      exit 4
    fi
  fi
else
  echo "→ Fetching ${URL}" >&2
  curl -L -sS --fail-with-body -A "Mozilla/5.0" "$URL" -o "$DEST"
fi

SIZE=$(wc -c < "$DEST")
echo "✓ Wrote $DEST ($SIZE bytes)"
