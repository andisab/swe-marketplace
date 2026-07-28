#!/usr/bin/env bash
# render-slides.sh — capture per-slide PNGs from a Reveal.js deck using headless Chromium.
# NOTE: this is the FALLBACK path. Prefer inspecting via Claude in Chrome or Playwright MCP
# when available (see FORMAT.md §Visual review) — use this script when no browser MCP is up.
#
# Usage:
#   render-slides.sh <path-to-index.html> [output-dir] [slide-count]
#
# Defaults:
#   output-dir   = ./preview/
#   slide-count  = auto-detected from <section> count in the HTML
#
# Requirements:
#   - Node.js (npm test puppeteer)
#   - Either:
#       a) puppeteer installed in the deck dir's node_modules, OR
#       b) Chrome / Chromium on PATH (then we fall back to a chrome-headless invocation)
#
# Output: PNG files numbered slide-001.png, slide-002.png, ...

set -euo pipefail

HTML_PATH="${1:-./index.html}"
OUT_DIR="${2:-./preview}"

if [[ ! -f "$HTML_PATH" ]]; then
  echo "render-slides.sh: not a file: $HTML_PATH" >&2
  exit 1
fi

HTML_PATH="$(cd "$(dirname "$HTML_PATH")" && pwd)/$(basename "$HTML_PATH")"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

# Detect slide count from the HTML if not supplied
if [[ "${3:-}" ]]; then
  SLIDE_COUNT="$3"
else
  SLIDE_COUNT=$(grep -c '<section class="layout-' "$HTML_PATH" || true)
  if [[ "$SLIDE_COUNT" == "0" ]]; then
    SLIDE_COUNT=$(grep -c '<section' "$HTML_PATH" || echo 1)
  fi
fi

echo "render-slides.sh: $HTML_PATH → $OUT_DIR ($SLIDE_COUNT slides)"

# Try puppeteer first
PUPPETEER_SCRIPT="$(mktemp -t render-slides.XXXXXX.js)"
cat > "$PUPPETEER_SCRIPT" <<EOF
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

  const slideCount = $SLIDE_COUNT;
  for (let i = 0; i < slideCount; i++) {
    const url = "file://$HTML_PATH#/" + i;
    await page.goto(url, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 200));  // settle fonts
    const fname = "$OUT_DIR/slide-" + String(i + 1).padStart(3, "0") + ".png";
    await page.screenshot({ path: fname, omitBackground: false });
    process.stdout.write("  wrote " + path.relative(process.cwd(), fname) + "\n");
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
EOF

# Pick a node_modules with puppeteer
if [[ -d "$(dirname "$HTML_PATH")/node_modules/puppeteer" ]]; then
  echo "  using puppeteer from deck dir node_modules"
  (cd "$(dirname "$HTML_PATH")" && node "$PUPPETEER_SCRIPT")
  rm -f "$PUPPETEER_SCRIPT"
  exit 0
fi

if command -v npx >/dev/null 2>&1; then
  echo "  trying npx puppeteer (may install on first run)"
  if (cd "$(dirname "$HTML_PATH")" && npx --yes puppeteer-script "$PUPPETEER_SCRIPT" 2>/dev/null); then
    rm -f "$PUPPETEER_SCRIPT"
    exit 0
  fi
fi

rm -f "$PUPPETEER_SCRIPT"

# Fallback: try chrome --headless with --screenshot. Single-slide only (no slide nav).
# This is a last-resort warning — the user should install puppeteer for full coverage.
echo "render-slides.sh: puppeteer not available — falling back to chrome --screenshot (single-slide only)"
echo "  install puppeteer for per-slide screenshots: (cd $(dirname "$HTML_PATH") && npm install puppeteer)"

CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  google-chrome chromium chrome ; do
  if command -v "$candidate" >/dev/null 2>&1 || [[ -x "$candidate" ]]; then
    CHROME="$candidate"; break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo "render-slides.sh: no Chrome/Chromium found. Install one or `npm install puppeteer` in the deck dir." >&2
  exit 1
fi

"$CHROME" --headless --no-sandbox --hide-scrollbars \
  --window-size=1280,720 \
  --screenshot="$OUT_DIR/slide-001.png" \
  "file://$HTML_PATH" >/dev/null 2>&1

echo "  wrote $OUT_DIR/slide-001.png (single slide — install puppeteer for the rest)"
