#!/usr/bin/env bash
# preflight.sh — Combined pre-flight check for the adv plugin
# Runs dependency checks, engine health checks, and scope resolution in one call.
# Outputs a single JSON object to stdout with all results.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH="$SCRIPT_DIR/dispatch.sh"

# --- Defaults ---
COMMITS=""
SINCE=""
FULL=false
TMP_DIR=".claude/reviews/.tmp"

usage() {
  cat <<'EOF'
Usage: preflight.sh [OPTIONS]

Options:
  --commits <hash..hash>   Review a specific commit range
  --since <hash>           Review changes since a commit/ref (e.g., HEAD~5)
  --full                   Full repo scope (file manifest)
  -h, --help               Show this help

Default (no flags): smart scope — uncommitted changes > last commit > full repo
EOF
  exit 1
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --commits) COMMITS="$2"; shift 2 ;;
    --since)   SINCE="$2"; shift 2 ;;
    --full)    FULL=true; shift ;;
    -h|--help) usage ;;
    *)         echo "ERROR: Unknown argument: $1" >&2; usage ;;
  esac
done

# --- Ensure we're in a git repo ---
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo '{"error": "Not inside a git repository"}' >&2
  exit 1
fi

# --- Create directories ---
mkdir -p "$TMP_DIR" .claude/reviews

# ============================================================
# 1. DEPENDENCY CHECKS
# ============================================================
dep_codex=false
dep_gemini=false
dep_claude=false
dep_jq=false

command -v codex &>/dev/null && dep_codex=true
command -v gemini &>/dev/null && dep_gemini=true
command -v claude &>/dev/null && dep_claude=true
command -v jq &>/dev/null && dep_jq=true

# jq is required for this script's own JSON output
if ! $dep_jq; then
  echo "ERROR: jq is required. Install via 'brew install jq'" >&2
  exit 1
fi

# ============================================================
# 2. ENGINE HEALTH CHECKS
# ============================================================
codex_available=false
codex_error="unavailable"
gemini_available=false
gemini_error="unavailable"
gemini_model="gemini-2.5-pro"

if $dep_codex; then
  health_json=$(bash "$DISPATCH" --engine codex --health-check 2>/dev/null || true)
  if echo "$health_json" | jq -e '.success == true' &>/dev/null; then
    codex_available=true
    codex_error="none"
  else
    codex_error=$(echo "$health_json" | jq -r '.error_type // "unknown"' 2>/dev/null || echo "unknown")
  fi
fi

if $dep_gemini; then
  health_json=$(bash "$DISPATCH" --engine gemini --health-check 2>/dev/null || true)
  if echo "$health_json" | jq -e '.success == true' &>/dev/null; then
    gemini_available=true
    gemini_error="none"
  else
    gemini_error=$(echo "$health_json" | jq -r '.error_type // "unknown"' 2>/dev/null || echo "unknown")
    # Gemini quota fallback: try flash model
    if [[ "$gemini_error" == "quota" ]]; then
      health_json=$(bash "$DISPATCH" --engine gemini --model gemini-2.0-flash --health-check 2>/dev/null || true)
      if echo "$health_json" | jq -e '.success == true' &>/dev/null; then
        gemini_available=true
        gemini_error="none"
        gemini_model="gemini-2.0-flash"
      fi
    fi
  fi
fi

# ============================================================
# 3. SCOPE RESOLUTION
# ============================================================
scope_type=""
scope_range=""
scope_files_changed=0
scope_diff_lines=0
scope_untracked=0
CONTENT_FILE="$TMP_DIR/scope-content.txt"

resolve_commits_scope() {
  local range="$1"
  scope_type="commits"
  scope_range="$range"

  if ! git diff "$range" > "$CONTENT_FILE" 2>"$TMP_DIR/scope-error.txt"; then
    echo "ERROR: Invalid commit range '$range': $(cat "$TMP_DIR/scope-error.txt")" >&2
    rm -f "$TMP_DIR/scope-error.txt"
    exit 1
  fi
  rm -f "$TMP_DIR/scope-error.txt"

  scope_diff_lines=$(wc -l < "$CONTENT_FILE" | tr -d ' ')
  scope_files_changed=$(git diff --stat "$range" 2>/dev/null | tail -1 | grep -oE '[0-9]+ files? changed' | grep -oE '[0-9]+' || echo 0)
}

resolve_working_scope() {
  scope_type="working"

  git diff HEAD > "$CONTENT_FILE" 2>/dev/null || true

  # Append staged-only changes that aren't in the working diff
  # (git diff HEAD already includes both staged and unstaged)

  scope_diff_lines=$(wc -l < "$CONTENT_FILE" | tr -d ' ')
  scope_files_changed=$(git diff HEAD --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ files? changed' | grep -oE '[0-9]+' || echo 0)

  # Count untracked files
  scope_untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

  # Append untracked file listing to content if any exist
  if [[ "$scope_untracked" -gt 0 ]]; then
    {
      echo ""
      echo "=== UNTRACKED NEW FILES ==="
      git ls-files --others --exclude-standard 2>/dev/null
    } >> "$CONTENT_FILE"
  fi
}

resolve_full_scope() {
  scope_type="full"

  # File tree (respecting .gitignore), excluding common non-code files
  git ls-files \
    | grep -vE '\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp[34]|wav|zip|tar|gz|lock|min\.(js|css))$' \
    | grep -vE '(node_modules|vendor|dist|build|\.DS_Store)' \
    > "$CONTENT_FILE"

  # Append summary stats
  {
    echo "---"
    echo "Total files: $(wc -l < "$CONTENT_FILE" | tr -d ' ')"
    echo "Languages:"
    sed -n 's/.*\.\([^./]*\)$/\1/p' "$CONTENT_FILE" | sort | uniq -c | sort -rn | head -10
  } >> "$CONTENT_FILE"

  scope_files_changed=$(wc -l < "$CONTENT_FILE" | tr -d ' ')
  scope_diff_lines=0
}

if [[ -n "$COMMITS" ]]; then
  resolve_commits_scope "$COMMITS"
elif [[ -n "$SINCE" ]]; then
  # Validate ref
  if ! git rev-parse --verify "$SINCE" &>/dev/null; then
    echo "ERROR: Cannot resolve ref '$SINCE'" >&2
    exit 1
  fi
  resolve_commits_scope "${SINCE}..HEAD"
elif $FULL; then
  resolve_full_scope
else
  # Smart default: uncommitted changes > last commit > full repo
  working_changes=$(git diff HEAD --stat 2>/dev/null | tail -1 || true)
  if echo "$working_changes" | grep -qE '[0-9]+ files? changed'; then
    resolve_working_scope
  else
    last_commit_changes=$(git diff HEAD~1..HEAD --stat 2>/dev/null | tail -1 || true)
    if echo "$last_commit_changes" | grep -qE '[0-9]+ files? changed'; then
      resolve_commits_scope "HEAD~1..HEAD"
    else
      resolve_full_scope
    fi
  fi
fi

# ============================================================
# 4. OUTPUT JSON
# ============================================================
jq -nc \
  --argjson dep_codex "$dep_codex" \
  --argjson dep_gemini "$dep_gemini" \
  --argjson dep_claude "$dep_claude" \
  --argjson dep_jq "$dep_jq" \
  --argjson codex_available "$codex_available" \
  --arg codex_error "$codex_error" \
  --argjson gemini_available "$gemini_available" \
  --arg gemini_error "$gemini_error" \
  --arg gemini_model "$gemini_model" \
  --arg scope_type "$scope_type" \
  --arg scope_range "$scope_range" \
  --argjson scope_files_changed "$scope_files_changed" \
  --argjson scope_diff_lines "$scope_diff_lines" \
  --argjson scope_untracked "$scope_untracked" \
  --arg content_file "$CONTENT_FILE" \
  '{
    deps: {codex: $dep_codex, gemini: $dep_gemini, claude: $dep_claude, jq: $dep_jq},
    engines: {
      codex: {available: $codex_available, error_type: $codex_error},
      gemini: {available: $gemini_available, error_type: $gemini_error, model: $gemini_model}
    },
    scope: {
      type: $scope_type,
      range: $scope_range,
      files_changed: $scope_files_changed,
      diff_lines: $scope_diff_lines,
      untracked_files: $scope_untracked,
      content_file: $content_file
    }
  }'
