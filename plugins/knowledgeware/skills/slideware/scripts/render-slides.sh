#!/usr/bin/env bash
# render-slides.sh — convert a .pptx to per-slide PNG images (for visual QA).
# Pipeline: pptx → PDF (via LibreOffice headless) → PNG (via pdftoppm at 150 DPI).
# Usage: bash render-slides.sh <input.pptx> <output-dir>

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input.pptx> <output-dir>" >&2
  exit 1
fi

INPUT="$1"
OUTDIR="$2"
DPI="${RENDER_DPI:-150}"

[ -f "$INPUT" ] || { echo "Input file not found: $INPUT" >&2; exit 2; }
mkdir -p "$OUTDIR"

SOFFICE=""
for candidate in soffice libreoffice "/Applications/LibreOffice.app/Contents/MacOS/soffice"; do
  if command -v "$candidate" >/dev/null 2>&1 || [ -x "$candidate" ]; then
    SOFFICE="$candidate"; break
  fi
done

if [ -z "$SOFFICE" ]; then
  cat >&2 <<EOF
ERROR: LibreOffice is required to render slides to images.

Install it:
  brew install --cask libreoffice            # macOS
  sudo apt-get install -y libreoffice        # Debian/Ubuntu
  sudo dnf install -y libreoffice            # Fedora

Then re-run this command.
EOF
  exit 3
fi

if ! command -v pdftoppm >/dev/null 2>&1; then
  cat >&2 <<EOF
ERROR: pdftoppm is required (from poppler).

Install it:
  brew install poppler                       # macOS
  sudo apt-get install -y poppler-utils      # Debian/Ubuntu
EOF
  exit 4
fi

TMPDIR="$(mktemp -d -t pptx-render.XXXXXX)"
trap "rm -rf '$TMPDIR'" EXIT

echo "→ Converting to PDF…" >&2
# Use a per-run profile dir so a stale soffice instance can't block us via the user profile lock.
PROFILE_DIR="$(mktemp -d -t soffice-profile.XXXXXX)"
trap "rm -rf '$TMPDIR' '$PROFILE_DIR'" EXIT
SOFFICE_STDERR="$(mktemp -t soffice-err.XXXXXX)"
"$SOFFICE" --headless \
  "-env:UserInstallation=file://$PROFILE_DIR" \
  --convert-to pdf --outdir "$TMPDIR" "$INPUT" >/dev/null 2>"$SOFFICE_STDERR" || {
    echo "soffice exited with error. stderr below:" >&2
    cat "$SOFFICE_STDERR" >&2
    rm -f "$SOFFICE_STDERR"
    exit 5
  }

PDF="$TMPDIR/$(basename "${INPUT%.pptx}").pdf"
if [ ! -f "$PDF" ]; then
  echo "PDF conversion failed (no output PDF). soffice stderr:" >&2
  cat "$SOFFICE_STDERR" >&2
  rm -f "$SOFFICE_STDERR"
  echo "" >&2
  echo "Common causes:" >&2
  echo "  - stale LibreOffice instance holding the profile lock (try: pkill -f soffice)" >&2
  echo "  - .pptx file is malformed (try opening in Keynote/PPT to verify)" >&2
  exit 5
fi
rm -f "$SOFFICE_STDERR"

echo "→ Rasterizing to PNG at ${DPI} DPI…" >&2
pdftoppm -png -r "$DPI" "$PDF" "$OUTDIR/slide"

# Normalize names to zero-padded: slide-01.png, slide-02.png, ...
cd "$OUTDIR"
for f in slide-*.png; do
  num="${f#slide-}"; num="${num%.png}"
  if [[ ${#num} -lt 2 ]]; then mv "$f" "slide-0${num}.png"; fi
done

COUNT=$(ls "$OUTDIR"/slide-*.png 2>/dev/null | wc -l | tr -d ' ')
echo "✓ Rendered $COUNT slide(s) → $OUTDIR/" >&2
ls "$OUTDIR"/slide-*.png 2>/dev/null | head -20
