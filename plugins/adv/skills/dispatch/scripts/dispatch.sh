#!/usr/bin/env bash
# dispatch.sh — Multi-model CLI dispatcher for the adv plugin
# Dispatches prompts to Codex, Gemini, or Claude CLIs and captures responses.
#
# Exit codes:
#   0  — success
#   1  — general error (bad args, missing CLI)
#   2  — auth failure (invalid/expired API key)
#   3  — quota exhaustion (rate limit or daily cap)
#   4  — timeout (engine exceeded time limit)
#   5  — empty/invalid response (engine returned nothing useful)
set -euo pipefail

# --- API key resolution ---
# Map GEMINI_API_KEY → GOOGLE_API_KEY if available
export GOOGLE_API_KEY="${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}}"

# Detect if we need 1Password for Gemini API key
NEED_OP_FOR_GEMINI=false
if [[ -z "${GOOGLE_API_KEY:-}" ]] && command -v op &>/dev/null && [[ -f "$HOME/.env" ]]; then
  if grep -q "GEMINI_API_KEY" "$HOME/.env" 2>/dev/null; then
    NEED_OP_FOR_GEMINI=true
  fi
fi

# Ensure common tool locations are in PATH
NVM_NODE_DIR="$(ls -d "$HOME/.nvm/versions/node/"* 2>/dev/null | tail -1 || true)"
export PATH="$HOME/.local/bin${NVM_NODE_DIR:+:$NVM_NODE_DIR/bin}:$PATH"

# --- Defaults ---
ENGINE=""
PROMPT=""
PROMPT_FILE=""
CWD="."
TIMEOUT=300
OUTPUT_FILE=""
RESEARCH=false
CHECK_DEPS=false
HEALTH_CHECK=false
MODEL=""
LOG_DIR=".claude/reviews/.tmp"
MIN_RESPONSE_LENGTH=20  # Minimum chars for a valid response

usage() {
  cat <<'EOF'
Usage: dispatch.sh --engine <codex|gemini|claude> [OPTIONS]

Options:
  --engine <engine>       Required. Target engine: codex, gemini, or claude
  --prompt <string>       Prompt text (mutually exclusive with --prompt-file)
  --prompt-file <path>    Read prompt from file
  --model <model>         Override default model for the engine
  --cwd <path>            Working directory (default: .)
  --timeout <seconds>     Max execution time (default: 300)
  --output-file <path>    Write response to this file
  --research              Gemini only: enable grounded search
  --check-deps            Check prerequisites and exit
  --health-check          Quick ping to verify engine is responsive
  -h, --help              Show this help

Exit codes:
  0  success     2  auth failure     4  timeout
  1  general     3  quota exhausted  5  empty response
EOF
  exit 1
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine)       ENGINE="$2"; shift 2 ;;
    --prompt)       PROMPT="$2"; shift 2 ;;
    --prompt-file)  PROMPT_FILE="$2"; shift 2 ;;
    --model)        MODEL="$2"; shift 2 ;;
    --cwd)          CWD="$2"; shift 2 ;;
    --timeout)      TIMEOUT="$2"; shift 2 ;;
    --output-file)  OUTPUT_FILE="$2"; shift 2 ;;
    --research)     RESEARCH=true; shift ;;
    --check-deps)   CHECK_DEPS=true; shift ;;
    --health-check) HEALTH_CHECK=true; shift ;;
    -h|--help)      usage ;;
    *)              echo "ERROR: Unknown argument: $1" >&2; usage ;;
  esac
done

# --- Dependency check mode ---
check_deps() {
  local ok=true

  if command -v codex &>/dev/null; then
    echo "OK: codex $(codex --version 2>/dev/null | head -1)"
  else
    echo "MISSING: codex — Install via 'npm install -g @openai/codex'"
    ok=false
  fi

  if command -v gemini &>/dev/null; then
    echo "OK: gemini $(gemini --version 2>/dev/null | head -1)"
  else
    echo "MISSING: gemini — Install via 'npm install -g @google/gemini-cli'"
    ok=false
  fi

  if command -v claude &>/dev/null; then
    echo "OK: claude available"
  else
    echo "MISSING: claude — Should be available in Claude Code sessions"
    ok=false
  fi

  if command -v jq &>/dev/null; then
    echo "OK: jq $(jq --version 2>/dev/null)"
  else
    echo "MISSING: jq — Install via 'brew install jq'"
    ok=false
  fi

  # Check Gemini google_search extension
  if command -v gemini &>/dev/null; then
    if gemini extensions list 2>/dev/null | grep -qi "google.search\|google_search"; then
      echo "OK: gemini google_search extension"
    else
      echo "NOTE: gemini google_search extension not found — /adv-gemini-research may have limited grounding"
    fi
  fi

  # Check Gemini API key availability
  if [[ -n "${GOOGLE_API_KEY:-}" ]]; then
    echo "OK: GOOGLE_API_KEY set"
  elif $NEED_OP_FOR_GEMINI; then
    echo "OK: GEMINI_API_KEY available via 1Password"
  else
    echo "NOTE: No Gemini API key found — set GOOGLE_API_KEY or GEMINI_API_KEY, or add to ~/.env for 1Password resolution"
  fi

  if $ok; then
    echo "All required dependencies available."
    exit 0
  else
    echo "Some dependencies missing. Install them before using the adv plugin."
    exit 1
  fi
}

if $CHECK_DEPS; then
  check_deps
fi

# --- Validation ---
if [[ -z "$ENGINE" ]]; then
  echo "ERROR: --engine is required" >&2
  usage
fi

# Health check mode: quick ping with minimal prompt
if $HEALTH_CHECK; then
  PROMPT="Reply with exactly: OK"
  TIMEOUT=30
  MIN_RESPONSE_LENGTH=1
fi

if [[ -z "$PROMPT" && -z "$PROMPT_FILE" ]]; then
  echo "ERROR: --prompt or --prompt-file is required" >&2
  usage
fi

# Read prompt from file if specified
if [[ -n "$PROMPT_FILE" ]]; then
  if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ERROR: Prompt file not found: $PROMPT_FILE" >&2
    exit 1
  fi
  PROMPT="$(cat "$PROMPT_FILE")"
fi

# Verify engine CLI is available
case "$ENGINE" in
  codex)
    if ! command -v codex &>/dev/null; then
      echo "ERROR: codex CLI not found. Install via 'npm install -g @openai/codex'" >&2
      exit 1
    fi
    ;;
  gemini)
    if ! command -v gemini &>/dev/null; then
      echo "ERROR: gemini CLI not found. Install via 'npm install -g @google/gemini-cli'" >&2
      exit 1
    fi
    ;;
  claude)
    if ! command -v claude &>/dev/null; then
      echo "ERROR: claude CLI not found" >&2
      exit 1
    fi
    ;;
  *)
    echo "ERROR: Unknown engine: $ENGINE. Must be codex, gemini, or claude." >&2
    exit 1
    ;;
esac

# --- Ensure log directory exists ---
mkdir -p "$LOG_DIR"

# --- Utilities ---
get_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

# Portable timeout: use GNU timeout/gtimeout if available, else run directly
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout"
fi

run_with_timeout() {
  local secs="$1"; shift
  if [[ -n "$TIMEOUT_CMD" ]]; then
    "$TIMEOUT_CMD" "$secs" "$@"
  else
    "$@"
  fi
}

# Classify errors from stderr log content
# Reads the last 50 lines of dispatch.log and returns an exit code
classify_error() {
  local log_tail
  log_tail="$(tail -50 "$LOG_DIR/dispatch.log" 2>/dev/null || true)"

  # Auth failures — check first as quota errors sometimes also mention auth
  if echo "$log_tail" | grep -qi "API_KEY_INVALID\|API key not valid\|invalid.*api.*key\|unauthorized\|401\|403\|permission.denied\|forbidden\|credentials\|not.authenticated"; then
    return 2  # auth failure
  # Quota / rate limit
  elif echo "$log_tail" | grep -qi "quota\|rate.limit\|429\|too many requests\|TerminalQuota\|exceeded.*limit\|capacity\|overloaded\|resource.exhausted"; then
    return 3  # quota exhausted
  # Timeout
  elif echo "$log_tail" | grep -qi "timeout\|timed.out\|SIGTERM\|SIGKILL\|124\|deadline.exceeded"; then
    return 4  # timeout
  else
    return 1  # general error
  fi
}

# Validate response content
validate_response() {
  local response="$1"
  local len=${#response}

  # Empty response
  if [[ $len -eq 0 ]]; then
    echo "ERROR: Engine returned empty response" >>"$LOG_DIR/dispatch.log"
    return 5
  fi

  # Too short (likely an error message, not real content)
  if [[ $len -lt $MIN_RESPONSE_LENGTH ]]; then
    echo "WARN: Engine returned very short response ($len chars): $response" >>"$LOG_DIR/dispatch.log"
    # Don't fail for short responses — some health checks are short
  fi

  # Response is just an error message
  if echo "$response" | head -3 | grep -qi "^error\|^fatal\|^exception\|An unexpected critical error"; then
    echo "ERROR: Engine returned an error message instead of content" >>"$LOG_DIR/dispatch.log"
    return 5
  fi

  return 0
}

# --- Dispatch functions ---
START_MS=$(get_ms)
RESPONSE=""
EXIT_CODE=0

dispatch_codex() {
  local -a codex_args=(exec --full-auto -s read-only -C "$CWD")
  # Only pass -m if explicitly overridden; otherwise use codex config default
  if [[ -n "$MODEL" ]]; then
    codex_args+=(-m "$MODEL")
  fi
  codex_args+=("$PROMPT")
  run_with_timeout "$TIMEOUT" codex "${codex_args[@]}" 2>>"$LOG_DIR/dispatch.log"
}

dispatch_gemini() {
  local gemini_args=(-p "$PROMPT" -m "${MODEL:-gemini-2.5-pro}" --sandbox --approval-mode plan -o text)

  if $RESEARCH; then
    if gemini extensions list 2>/dev/null | grep -qi "google.search\|google_search"; then
      gemini_args+=(-e google_search)
    else
      echo "WARN: google_search extension not available, running without grounded search" >>"$LOG_DIR/dispatch.log"
    fi
  fi

  if $NEED_OP_FOR_GEMINI; then
    # Write args to a temp file so op-wrapped bash can read them cleanly
    local tmp_args
    tmp_args="$(mktemp)"
    printf '%s\0' "${gemini_args[@]}" > "$tmp_args"
    op run --env-file="$HOME/.env" -- bash -c \
      'export GOOGLE_API_KEY="${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}}"; mapfile -d "" args < "$1"; exec gemini "${args[@]}"' \
      _ "$tmp_args" 2>>"$LOG_DIR/dispatch.log"
    local op_exit=$?
    rm -f "$tmp_args"
    return $op_exit
  else
    run_with_timeout "$TIMEOUT" gemini "${gemini_args[@]}" 2>>"$LOG_DIR/dispatch.log"
  fi
}

dispatch_claude() {
  local -a claude_args=(--print --model "${MODEL:-sonnet}")
  claude_args+=("$PROMPT")
  run_with_timeout "$TIMEOUT" claude "${claude_args[@]}" 2>>"$LOG_DIR/dispatch.log"
}

# --- Execute dispatch ---
case "$ENGINE" in
  codex)  RESPONSE="$(dispatch_codex)"  || EXIT_CODE=$? ;;
  gemini) RESPONSE="$(dispatch_gemini)" || EXIT_CODE=$? ;;
  claude) RESPONSE="$(dispatch_claude)" || EXIT_CODE=$? ;;
esac

END_MS=$(get_ms)
DURATION_MS=$(( END_MS - START_MS ))

# --- Classify failures ---
if [[ $EXIT_CODE -ne 0 ]]; then
  # Try to classify the specific error type
  classify_error || EXIT_CODE=$?
fi

# --- Validate response ---
VALIDATED=true
if [[ $EXIT_CODE -eq 0 ]]; then
  if ! validate_response "$RESPONSE"; then
    EXIT_CODE=5
    VALIDATED=false
  fi
fi

# --- Write output ---
if [[ -n "$OUTPUT_FILE" ]]; then
  mkdir -p "$(dirname "$OUTPUT_FILE")"
  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "$RESPONSE" > "$OUTPUT_FILE"
  else
    # Write error marker so the orchestrator knows this file is a failure
    echo "DISPATCH_ERROR: engine=$ENGINE exit_code=$EXIT_CODE error_type=$ERROR_TYPE model=${MODEL:-engine_default} duration_ms=$DURATION_MS" > "$OUTPUT_FILE"
  fi
fi

# --- Status line ---
SUCCESS=true
ERROR_TYPE="none"
if [[ $EXIT_CODE -ne 0 ]]; then
  SUCCESS=false
  case $EXIT_CODE in
    2) ERROR_TYPE="auth" ;;
    3) ERROR_TYPE="quota" ;;
    4) ERROR_TYPE="timeout" ;;
    5) ERROR_TYPE="empty_response" ;;
    *) ERROR_TYPE="general" ;;
  esac
fi

jq -nc \
  --arg engine "$ENGINE" \
  --argjson success "$SUCCESS" \
  --arg output_file "${OUTPUT_FILE:-}" \
  --argjson duration_ms "$DURATION_MS" \
  --argjson exit_code "$EXIT_CODE" \
  --arg error_type "$ERROR_TYPE" \
  --arg model "${MODEL:-engine_default}" \
  '{engine: $engine, success: $success, output_file: $output_file, duration_ms: $duration_ms, exit_code: $exit_code, error_type: $error_type, model: $model}'

exit "$EXIT_CODE"
