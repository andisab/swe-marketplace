#!/usr/bin/env bash
# install-fonts.sh — install a brand's (or any) Google Fonts locally so generated
# materials render correctly, especially .pptx authoring and LibreOffice preview
# rendering (HTML decks load fonts via <link> and don't need this).
#
# Usage:
#   bash install-fonts.sh <brand-or-style-name>   # e.g. acmecorp — installs its sans/serif/mono
#   bash install-fonts.sh "Plus Jakarta Sans" "Lora"   # explicit family names
#   bash install-fonts.sh --check <name>          # report only, install nothing
#
# Fonts are fetched from Google Fonts (TTFs via the css2 API). Families that are
# system/web-safe (Georgia, Arial, ...) or not on Google Fonts are skipped with a note.
# Installed files are named GF-<Family>-<n>.ttf so re-runs overwrite, never duplicate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && { CHECK_ONLY=1; shift; }
[ $# -ge 1 ] || { echo "Usage: install-fonts.sh [--check] <brand|style|font name> ..." >&2; exit 1; }

case "$(uname -s)" in
  Darwin) FONT_DIR="$HOME/Library/Fonts" ;;
  *)      FONT_DIR="$HOME/.local/share/fonts" ;;
esac
mkdir -p "$FONT_DIR"

# System / web-safe families that never need installing
is_system_font() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    georgia|arial|helvetica|"helvetica neue"|verdana|tahoma|"times new roman"|times|courier|"courier new"|monaco|menlo|system-ui|-apple-system|serif|sans-serif|monospace) return 0 ;;
    *) return 1 ;;
  esac
}

# Resolve an argument: registry name → its sans/serif/mono; otherwise literal family
resolve_families() {
  local arg="$1"
  if node "$SCRIPT_DIR/load-style.js" "$arg" 2>/dev/null | python3 -c '
import json, sys
try:
    t = json.load(sys.stdin).get("type", {})
except Exception:
    sys.exit(1)
fams = [t.get(k) for k in ("sans", "serif", "mono") if t.get(k)]
if not fams: sys.exit(1)
print("\n".join(dict.fromkeys(fams)))
'; then return 0; fi
  echo "$arg"
}

installed_matches() {  # any installed file for this family?
  local fam="$1" squashed
  squashed="$(echo "$fam" | tr -d ' ')"
  ls "$FONT_DIR" 2>/dev/null | grep -i -e "$squashed" -e "$(echo "$fam" | tr ' ' '-')" | head -3
}

install_family() {
  local fam="$1" urlfam css urls n=0
  if is_system_font "$fam"; then echo "  ~ $fam: system font, nothing to install"; return; fi
  local existing; existing="$(installed_matches "$fam" || true)"
  if [ -n "$existing" ]; then
    echo "  = $fam: already installed ($(echo "$existing" | head -1))"
    return
  fi
  if [ "$CHECK_ONLY" = 1 ]; then echo "  ! $fam: NOT installed"; return; fi

  urlfam="$(echo "$fam" | sed 's/ /+/g')"
  # Progressively simpler css2 queries: full axes → weight range → 400;700 → plain
  for spec in "family=${urlfam}:ital,wght@0,100..900;1,100..900" \
              "family=${urlfam}:wght@100..900" \
              "family=${urlfam}:wght@400;700" \
              "family=${urlfam}"; do
    css="$(curl -sf "https://fonts.googleapis.com/css2?${spec}" 2>/dev/null || true)"
    [ -n "$css" ] && break
  done
  if [ -z "$css" ]; then echo "  ! $fam: not found on Google Fonts — install manually"; return; fi

  urls="$(echo "$css" | grep -o 'https://fonts\.gstatic\.com/[^) ]*\.ttf' | sort -u)"
  if [ -z "$urls" ]; then echo "  ! $fam: Google Fonts returned no TTF URLs — install manually"; return; fi
  while IFS= read -r u; do
    n=$((n + 1))
    curl -sf "$u" -o "$FONT_DIR/GF-$(echo "$fam" | tr -d ' ')-$n.ttf"
  done <<< "$urls"
  command -v fc-cache >/dev/null 2>&1 && fc-cache -f "$FONT_DIR" >/dev/null 2>&1 || true
  echo "  + $fam: installed $n file(s) → $FONT_DIR"
}

for arg in "$@"; do
  echo "$arg:"
  while IFS= read -r fam; do
    [ -n "$fam" ] && install_family "$fam"
  done <<< "$(resolve_families "$arg")"
done
