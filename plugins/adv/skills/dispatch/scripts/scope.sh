#!/usr/bin/env bash
# scope.sh — Git scope resolver for the adv plugin
# Resolves review scope (full repo or commit range) and generates scope artifacts.
set -euo pipefail

COMMITS=""
SINCE=""
TMP_DIR=".claude/reviews/.tmp"

usage() {
  cat <<'EOF'
Usage: scope.sh [OPTIONS]

Options:
  --commits <hash..hash>   Review a specific commit range
  --since <hash>           Review changes since a commit/ref (e.g., HEAD~5)
  -h, --help               Show this help

Default: full repo scope (generates file manifest)
EOF
  exit 1
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --commits) COMMITS="$2"; shift 2 ;;
    --since)   SINCE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *)         echo "ERROR: Unknown argument: $1" >&2; usage ;;
  esac
done

# --- Ensure we're in a git repo ---
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "ERROR: Not inside a git repository. Run /adv-review from the project root." >&2
  exit 1
fi

# --- Create tmp directory ---
mkdir -p "$TMP_DIR"

# --- Resolve scope ---
if [[ -n "$COMMITS" ]]; then
  # Commit range mode — validate the range first
  DIFF_FILE="$TMP_DIR/scope-diff.txt"
  LOG_FILE="$TMP_DIR/scope-log.txt"

  if ! git diff "$COMMITS" > "$DIFF_FILE" 2>"$TMP_DIR/scope-error.txt"; then
    echo "ERROR: Invalid commit range '$COMMITS': $(cat "$TMP_DIR/scope-error.txt")" >&2
    rm -f "$TMP_DIR/scope-error.txt"
    exit 1
  fi
  rm -f "$TMP_DIR/scope-error.txt"

  if ! git log --oneline "$COMMITS" > "$LOG_FILE" 2>/dev/null; then
    echo "ERROR: Cannot resolve commit log for range '$COMMITS'" >&2
    exit 1
  fi

  if [[ ! -s "$DIFF_FILE" ]]; then
    echo "WARNING: No changes found in range $COMMITS" >&2
  fi

  jq -nc \
    --arg type "commits" \
    --arg range "$COMMITS" \
    --arg diff_file "$DIFF_FILE" \
    --arg log_file "$LOG_FILE" \
    '{type: $type, range: $range, diff_file: $diff_file, log_file: $log_file}'

elif [[ -n "$SINCE" ]]; then
  # Since mode — validate the ref first
  DIFF_FILE="$TMP_DIR/scope-diff.txt"
  LOG_FILE="$TMP_DIR/scope-log.txt"

  if ! git rev-parse --verify "$SINCE" &>/dev/null; then
    echo "ERROR: Cannot resolve ref '$SINCE'. Verify the commit hash or ref exists." >&2
    exit 1
  fi

  if ! git diff "$SINCE"..HEAD > "$DIFF_FILE" 2>"$TMP_DIR/scope-error.txt"; then
    echo "ERROR: Failed to diff '$SINCE..HEAD': $(cat "$TMP_DIR/scope-error.txt")" >&2
    rm -f "$TMP_DIR/scope-error.txt"
    exit 1
  fi
  rm -f "$TMP_DIR/scope-error.txt"

  if ! git log --oneline "$SINCE"..HEAD > "$LOG_FILE" 2>/dev/null; then
    echo "WARNING: Cannot resolve commit log for '$SINCE..HEAD'" >&2
  fi

  if [[ ! -s "$DIFF_FILE" ]]; then
    echo "WARNING: No changes found since $SINCE" >&2
  fi

  jq -nc \
    --arg type "commits" \
    --arg range "${SINCE}..HEAD" \
    --arg diff_file "$DIFF_FILE" \
    --arg log_file "$LOG_FILE" \
    '{type: $type, range: $range, diff_file: $diff_file, log_file: $log_file}'

else
  # Full repo mode — filter to code files
  MANIFEST_FILE="$TMP_DIR/scope-manifest.txt"

  # File tree (respecting .gitignore), excluding common non-code files
  git ls-files \
    | grep -vE '\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp[34]|wav|zip|tar|gz|lock|min\.(js|css))$' \
    | grep -vE '(node_modules|vendor|dist|build|\.DS_Store)' \
    > "$MANIFEST_FILE"

  # Append summary stats
  {
    echo "---"
    echo "Total files: $(wc -l < "$MANIFEST_FILE" | tr -d ' ')"
    echo "Languages:"
    sed -n 's/.*\.\([^./]*\)$/\1/p' "$MANIFEST_FILE" | sort | uniq -c | sort -rn | head -10
  } >> "$MANIFEST_FILE"

  jq -nc \
    --arg type "full" \
    --arg manifest_file "$MANIFEST_FILE" \
    '{type: $type, manifest_file: $manifest_file}'
fi
