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
#   6  — model not found (the requested model doesn't exist or isn't on this plan)
#
# Models: no model is passed unless --model or one of ADV_CODEX_MODEL,
# ADV_GEMINI_MODEL, ADV_CLAUDE_MODEL is set, so each CLI uses its own current
# default. Tested with Codex CLI 0.163.0 and Gemini CLI 0.65.0.
#
# Every engine is asked for JSON (codex exec --json, gemini -o json, claude
# --output-format json), which is where the text, the model that answered and
# the token counts live. The status line reports them as model_used, tokens_in
# and tokens_out. Output that isn't JSON is kept as the response text as is.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TESTED_CODEX_VERSION="0.163.0"
TESTED_GEMINI_VERSION="0.65.0"

# --- API key resolution ---
# Map GEMINI_API_KEY → GOOGLE_API_KEY if available (an empty exported value would still count as "set")
if [[ -z "${GOOGLE_API_KEY:-}" && -n "${GEMINI_API_KEY:-}" ]]; then
  export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi

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
CODEX_REVIEW=false
LOG_DIR=".claude/reviews/.tmp"
MIN_RESPONSE_LENGTH=20  # Minimum chars for a valid response

usage() {
  cat <<'EOF'
Usage: dispatch.sh --engine <codex|gemini|claude> [OPTIONS]

Options:
  --engine <engine>       Required. Target engine: codex, gemini, or claude
  --prompt <string>       Prompt text (mutually exclusive with --prompt-file)
  --prompt-file <path>    Read prompt from file
  --model <model>         Model for the engine (default: the CLI's own default, or
                          ADV_CODEX_MODEL / ADV_GEMINI_MODEL / ADV_CLAUDE_MODEL)
  --cwd <path>            Working directory (default: .)
  --timeout <seconds>     Max execution time (default: 300)
  --output-file <path>    Write response to this file
  --research              Gemini only: enable grounded search
  --codex-review          Codex only: run `codex review` (its review mode) instead of
                          `codex exec`; the prompt must name the git scope to review
  --check-deps            Check prerequisites and exit
  --health-check          Quick ping to verify engine is responsive
  -h, --help              Show this help

Exit codes:
  0  success     2  auth failure     4  timeout         6  model not found
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
    --codex-review) CODEX_REVIEW=true; shift ;;
    --check-deps)   CHECK_DEPS=true; shift ;;
    --health-check) HEALTH_CHECK=true; shift ;;
    -h|--help)      usage ;;
    *)              echo "ERROR: Unknown argument: $1" >&2; usage ;;
  esac
done

# --- Dependency check mode ---
# version_at_least <have> <want>: true when <have> sorts at or above <want>
version_at_least() {
  [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" == "$2" ]]
}

check_deps() {
  local ok=true
  local v

  if command -v codex &>/dev/null; then
    # A broken npm install leaves `codex` on PATH but it can't run (missing native binary)
    if v="$(codex --version 2>/dev/null | head -1)" && [[ -n "$v" ]]; then
      echo "OK: codex $v"
      v="${v##* }"
      if ! version_at_least "$v" "$TESTED_CODEX_VERSION"; then
        echo "NOTE: codex $v is older than the $TESTED_CODEX_VERSION this plugin was tested with — update via 'npm install -g @openai/codex@latest'"
      fi
    else
      echo "BROKEN: codex is on PATH but 'codex --version' fails — reinstall via 'npm install -g @openai/codex@latest'"
      ok=false
    fi
  else
    echo "MISSING: codex — Install via 'npm install -g @openai/codex'"
    ok=false
  fi

  if command -v gemini &>/dev/null; then
    if v="$(gemini --version 2>/dev/null | head -1)" && [[ -n "$v" ]]; then
      echo "OK: gemini $v"
      if ! version_at_least "$v" "$TESTED_GEMINI_VERSION"; then
        echo "NOTE: gemini $v is older than the $TESTED_GEMINI_VERSION this plugin was tested with — update via 'npm install -g @google/gemini-cli@latest'"
      fi
    else
      echo "BROKEN: gemini is on PATH but 'gemini --version' fails — reinstall via 'npm install -g @google/gemini-cli@latest'"
      ok=false
    fi
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

  # Times each call, and stops stuck ones when GNU timeout is absent
  if command -v python3 &>/dev/null; then
    echo "OK: $(python3 --version 2>&1)"
  else
    echo "MISSING: python3 — Install via 'brew install python'"
    ok=false
  fi

  if command -v gh &>/dev/null; then
    echo "OK: gh $(gh --version 2>/dev/null | head -1 | awk '{print $3}')"
  else
    echo "NOTE: gh not found — the --pr review scope needs the GitHub CLI"
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
  TIMEOUT=60  # Gemini's first sandboxed run of a session took ~40 s in testing
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
# Each call logs to its own file, so parallel dispatches can't blame one engine's
# error on another. It's appended to dispatch.log at the end.
CALL_LOG="$LOG_DIR/dispatch-$$.log"
: > "$CALL_LOG"

# --- Utilities ---
get_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

# Portable timeout: GNU timeout/gtimeout if available, else a python3 watchdog
# (macOS ships neither). Both exit 124 on timeout and signal the engine's whole
# process group, so a child the CLI started can't keep the output pipe open.
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
    python3 -c '
import os, signal, subprocess, sys
child = subprocess.Popen(sys.argv[2:], start_new_session=True)
def stop(sig):
    try:
        os.killpg(child.pid, sig)
    except ProcessLookupError:
        pass
def forward(sig, _frame):
    stop(sig)
    sys.exit(128 + sig)
for s in (signal.SIGHUP, signal.SIGINT, signal.SIGTERM):
    signal.signal(s, forward)
try:
    rc = child.wait(timeout=float(sys.argv[1]))
except subprocess.TimeoutExpired:
    stop(signal.SIGTERM)
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    stop(signal.SIGKILL)
    sys.exit(124)
sys.exit(128 - rc if rc < 0 else rc)
' "$secs" "$@"
  fi
}

# Classify errors from stderr log content
# Reads the last 50 lines of this call's log and returns an exit code
classify_error() {
  local log_tail
  log_tail="$(tail -50 "$CALL_LOG" 2>/dev/null || true)"

  # Auth failures — check first as quota errors sometimes also mention auth.
  # "could not resolve item" is 1Password failing to supply the key (e.g. two vault items share a title).
  if echo "$log_tail" | grep -qi "API_KEY_INVALID\|API key not valid\|invalid.*api.*key\|unauthorized\|401\|403\|permission.denied\|forbidden\|credentials\|not.authenticated\|could not resolve item\|could not refresh"; then
    return 2  # auth failure
  # Quota / rate limit
  elif echo "$log_tail" | grep -qi "quota\|rate.limit\|429\|too many requests\|TerminalQuota\|exceeded.*limit\|capacity\|overloaded\|resource.exhausted"; then
    return 3  # quota exhausted
  # Model missing or not on this plan (Gemini: ModelNotFoundError / code: 404; Codex: 404 "does not exist or you do not have access")
  elif echo "$log_tail" | grep -qi "ModelNotFoundError\|does not exist or you do not have access\|unexpected status 404\|code: 404"; then
    return 6  # model not found
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
    echo "ERROR: Engine returned empty response" >>"$CALL_LOG"
    return 5
  fi

  # Too short (likely an error message, not real content)
  if [[ $len -lt $MIN_RESPONSE_LENGTH ]]; then
    echo "WARN: Engine returned very short response ($len chars): $response" >>"$CALL_LOG"
    # Don't fail for short responses — some health checks are short
  fi

  # Response is just an error message
  if echo "$response" | head -3 | grep -qi "^error\|^fatal\|^exception\|An unexpected critical error"; then
    echo "ERROR: Engine returned an error message instead of content" >>"$CALL_LOG"
    return 5
  fi

  return 0
}

# --- Gemini REST probe (health check only) ---
# Gemini CLI answers a 429 by retrying with backoff and switching models without
# saying so, so an exhausted quota looks like a hung engine. One generateContent
# request through the REST API reports quota (429), a bad key (400/401/403) or a
# missing model (404) in about a second. The key goes to curl as a request header
# and is written nowhere.
gemini_rest_probe() {
  local model="$1" body code
  body="$(mktemp)"
  local probe='curl -s -m 20 -o "$0" -w "%{http_code}" -H "x-goog-api-key: ${GOOGLE_API_KEY:-$GEMINI_API_KEY}" -H "Content-Type: application/json" "https://generativelanguage.googleapis.com/v1beta/models/$1:generateContent" -d "{\"contents\":[{\"parts\":[{\"text\":\"Reply with exactly: OK\"}]}]}"'
  # curl prints 000 (and exits non-zero) when no HTTP response came back; nothing at all means curl never ran
  if $NEED_OP_FOR_GEMINI; then
    code=$(op run --env-file="$HOME/.env" -- sh -c "$probe" "$body" "$model" 2>>"$CALL_LOG") || true
  else
    code=$(sh -c "$probe" "$body" "$model" 2>>"$CALL_LOG") || true
  fi
  case "$code" in
    200) rm -f "$body"; return 0 ;;
    000) echo "WARN: REST probe for $model got no HTTP response (network problem?); trying the CLI anyway" >>"$CALL_LOG"; rm -f "$body"; return 0 ;;
    "")
      rm -f "$body"
      if $NEED_OP_FOR_GEMINI; then
        # op itself failed (locked vault, missed prompt, ambiguous item): the CLI would fail the same way
        echo "ERROR: 1Password could not supply the Gemini key for the REST probe (see the op message above)" >>"$CALL_LOG"
        return 2
      fi
      echo "WARN: REST probe for $model produced no HTTP code; trying the CLI anyway" >>"$CALL_LOG"
      return 0 ;;
  esac
  {
    echo "ERROR: REST probe for $model returned HTTP $code:"
    jq -r '.error.message // .' "$body" 2>/dev/null | head -5 || head -c 400 "$body"
  } >>"$CALL_LOG"
  rm -f "$body"
  case "$code" in
    429) return 3 ;;
    404) return 6 ;;
    400|401|403) return 2 ;;
    *)   return 1 ;;
  esac
}

# --- Dispatch functions ---
# Every engine gets </dev/null: codex exec and gemini -p both read extra input from an open stdin
# and wait for it to close, which under the watchdog looked like a hung engine.
START_MS=$(get_ms)
RESPONSE=""
EXIT_CODE=0

dispatch_codex() {
  # Pass a model only when set; otherwise Codex picks its current default model
  local model="${MODEL:-${ADV_CODEX_MODEL:-}}"
  if $CODEX_REVIEW; then
    # `codex review` is Codex's review mode: a review-tuned prompt, and it may run the code to confirm
    # a finding. It has no -C, -m or --json (Codex CLI 0.163), its scope flags (--uncommitted, --base,
    # --commit) can't be combined with a prompt, and its report is text, so: run it from the target
    # directory, pin the model with -c, let the prompt name the scope, and adapt the report below.
    local -a codex_args=(review -c 'sandbox_mode="read-only"')
    if [[ -n "$model" ]]; then
      codex_args+=(-c "model=\"$model\"")
    fi
    codex_args+=("$PROMPT")
    (cd "$CWD" && run_with_timeout "$TIMEOUT" codex "${codex_args[@]}" </dev/null 2>>"$CALL_LOG")
  else
    # --full-auto was removed in Codex CLI 0.163; the read-only sandbox needs no approvals.
    # --skip-git-repo-check lets --cwd point outside a repository.
    local -a codex_args=(exec -s read-only --skip-git-repo-check -C "$CWD" --json)
    if [[ -n "$model" ]]; then
      codex_args+=(-m "$model")
    fi
    codex_args+=("$PROMPT")
    run_with_timeout "$TIMEOUT" codex "${codex_args[@]}" </dev/null 2>>"$CALL_LOG"
  fi
}

dispatch_gemini() {
  # --approval-mode plan is Gemini's read-only mode. --sandbox is left out on purpose: in Gemini CLI
  # 0.65 on macOS its seatbelt profile broke the API calls ("fetch failed", 70 s of retries).
  # --skip-trust: Gemini CLI 0.65+ refuses headless runs in folders it hasn't been told to trust.
  # No -m by default: the CLI's auto mode picks its current models (gemini-2.5-pro was retired in Oct 2026).
  local gemini_args=(-p "$PROMPT" --approval-mode plan --skip-trust -o json)
  local model="${MODEL:-${ADV_GEMINI_MODEL:-}}"
  if [[ -n "$model" ]]; then
    gemini_args+=(-m "$model")
  fi

  if $RESEARCH; then
    if gemini extensions list 2>/dev/null | grep -qi "google.search\|google_search"; then
      gemini_args+=(-e google_search)
    else
      echo "WARN: google_search extension not available, running without grounded search" >>"$CALL_LOG"
    fi
  fi

  if $NEED_OP_FOR_GEMINI; then
    # op injects GEMINI_API_KEY from ~/.env; Gemini CLI reads that variable itself.
    # (An earlier bash -c/mapfile wrapper needed bash 4.4+, which stock macOS lacks.)
    run_with_timeout "$TIMEOUT" op run --env-file="$HOME/.env" -- gemini "${gemini_args[@]}" </dev/null 2>>"$CALL_LOG"
  else
    run_with_timeout "$TIMEOUT" gemini "${gemini_args[@]}" </dev/null 2>>"$CALL_LOG"
  fi
}

dispatch_claude() {
  local -a claude_args=(--print --output-format json --model "${MODEL:-${ADV_CLAUDE_MODEL:-sonnet}}")
  claude_args+=("$PROMPT")
  run_with_timeout "$TIMEOUT" claude "${claude_args[@]}" </dev/null 2>>"$CALL_LOG"
}

# --- Execute dispatch ---
PROBE_FAILED=false
if $HEALTH_CHECK && [[ "$ENGINE" == "gemini" ]] && { [[ -n "${GOOGLE_API_KEY:-}${GEMINI_API_KEY:-}" ]] || $NEED_OP_FOR_GEMINI; }; then
  # Probe the model the call would use, or the fallback model when the CLI picks its own
  gemini_rest_probe "${MODEL:-${ADV_GEMINI_MODEL:-${ADV_GEMINI_FALLBACK_MODEL:-gemini-3-flash-preview}}}" || { EXIT_CODE=$?; PROBE_FAILED=true; }
fi

RAW=""
if ! $PROBE_FAILED; then
  case "$ENGINE" in
    codex)  RAW="$(dispatch_codex)"  || EXIT_CODE=$? ;;
    gemini) RAW="$(dispatch_gemini)" || EXIT_CODE=$? ;;
    claude) RAW="$(dispatch_claude)" || EXIT_CODE=$? ;;
  esac
fi

END_MS=$(get_ms)
DURATION_MS=$(( END_MS - START_MS ))

# --- Parse the engine's output ---
# The text, the model that answered and the token counts come out of each CLI's JSON.
# Output that isn't JSON (an older CLI, a crash) is kept as the response text as is.
MODEL_USED=""
TOKENS_IN=0
TOKENS_OUT=0

parse_codex() {
  if $CODEX_REVIEW; then
    # Text report; the header on stderr names the model. The adapter rewrites the comments into adv's finding format.
    RESPONSE="$(printf '%s\n' "$RAW" | python3 -I "$SCRIPT_DIR/codex-review-adapter.py" --root "$CWD" 2>>"$CALL_LOG" || printf '%s' "$RAW")"
    MODEL_USED="$(grep -m1 '^model: ' "$CALL_LOG" 2>/dev/null | cut -d' ' -f2- || true)"
    return
  fi
  # JSONL events: agent_message items carry the text, error items carry config warnings and failures,
  # turn.completed carries the usage. No event names the model.
  local text usage
  text="$(printf '%s\n' "$RAW" | jq -rR 'fromjson? | select(.type == "item.completed" and .item.type == "agent_message") | .item.text' 2>/dev/null || true)"
  if [[ -n "$text" ]]; then
    RESPONSE="$text"
  else
    RESPONSE="$RAW"
  fi
  printf '%s\n' "$RAW" | jq -rR 'fromjson? | select(.type == "item.completed" and .item.type == "error") | "codex: " + .item.message' >>"$CALL_LOG" 2>/dev/null || true
  usage="$(printf '%s\n' "$RAW" | jq -rR 'fromjson? | select(.type == "turn.completed") | "\(.usage.input_tokens // 0) \(.usage.output_tokens // 0)"' 2>/dev/null | tail -1 || true)"
  if [[ -n "$usage" ]]; then
    TOKENS_IN="${usage%% *}"
    TOKENS_OUT="${usage##* }"
  fi
}

# The model Codex ran: the --model argument, else the pin in config.toml (what Codex's own header shows), else its default
codex_model_used() {
  local m="${MODEL:-${ADV_CODEX_MODEL:-}}"
  if [[ -z "$m" ]]; then
    m="$(sed -n 's/^model *= *"\([^"]*\)".*/\1/p' "${CODEX_HOME:-$HOME/.codex}/config.toml" 2>/dev/null | head -1 || true)"
  fi
  echo "${m:-engine default}"
}

parse_gemini() {
  # One JSON object: response, stats.models (the only place the routed model is visible), warnings, error
  if ! printf '%s' "$RAW" | jq -e 'type == "object"' >/dev/null 2>&1; then
    RESPONSE="$RAW"
    return
  fi
  RESPONSE="$(printf '%s' "$RAW" | jq -r '.response // ""')"
  printf '%s' "$RAW" | jq -r '(.warnings // [])[] | "gemini: " + .' >>"$CALL_LOG" 2>/dev/null || true
  if printf '%s' "$RAW" | jq -e '.error' >/dev/null 2>&1; then
    printf '%s' "$RAW" | jq -r '.error | "gemini error \(.type // "")\(if .code then " (code \(.code))" else "" end): \(.message // "")"' >>"$CALL_LOG" 2>/dev/null || true
    if [[ $EXIT_CODE -eq 0 ]]; then EXIT_CODE=1; fi
  fi
  MODEL_USED="$(printf '%s' "$RAW" | jq -r '(.stats.models // {}) | keys | join("+")')"
  local usage
  usage="$(printf '%s' "$RAW" | jq -r '[(.stats.models // {})[] | .tokens // {}] | "\(map(.prompt // 0) | add // 0) \(map(.candidates // 0) | add // 0)"' 2>/dev/null || true)"
  if [[ -n "$usage" ]]; then
    TOKENS_IN="${usage%% *}"
    TOKENS_OUT="${usage##* }"
  fi
}

parse_claude() {
  # One JSON object: result, is_error, usage, modelUsage keyed by the model that answered
  if ! printf '%s' "$RAW" | jq -e '.type == "result"' >/dev/null 2>&1; then
    RESPONSE="$RAW"
    return
  fi
  RESPONSE="$(printf '%s' "$RAW" | jq -r '.result // ""')"
  if printf '%s' "$RAW" | jq -e '.is_error == true' >/dev/null 2>&1; then
    echo "claude: $RESPONSE" >>"$CALL_LOG"
    if [[ $EXIT_CODE -eq 0 ]]; then EXIT_CODE=1; fi
  fi
  MODEL_USED="$(printf '%s' "$RAW" | jq -r '(.modelUsage // {}) | keys | join("+")')"
  local usage
  usage="$(printf '%s' "$RAW" | jq -r '.usage // {} | "\((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) \(.output_tokens // 0)"' 2>/dev/null || true)"
  if [[ -n "$usage" ]]; then
    TOKENS_IN="${usage%% *}"
    TOKENS_OUT="${usage##* }"
  fi
}

RESPONSE=""
if ! $PROBE_FAILED; then
  case "$ENGINE" in
    codex)  parse_codex ;;
    gemini) parse_gemini ;;
    claude) parse_claude ;;
  esac
fi
if [[ "$ENGINE" == "codex" && -z "$MODEL_USED" ]]; then
  MODEL_USED="$(codex_model_used)"
fi
if [[ -z "$MODEL_USED" ]]; then
  MODEL_USED="${MODEL:-engine default}"
fi

# --- Classify failures ---
if $PROBE_FAILED; then
  :  # the REST probe already classified the failure
elif [[ $EXIT_CODE -eq 124 ]]; then
  EXIT_CODE=4  # run_with_timeout stopped the engine
elif [[ $EXIT_CODE -ne 0 ]]; then
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

# --- Status ---
SUCCESS=true
ERROR_TYPE="none"
if [[ $EXIT_CODE -ne 0 ]]; then
  SUCCESS=false
  case $EXIT_CODE in
    2) ERROR_TYPE="auth" ;;
    3) ERROR_TYPE="quota" ;;
    4) ERROR_TYPE="timeout" ;;
    5) ERROR_TYPE="empty_response" ;;
    6) ERROR_TYPE="model_not_found" ;;
    *) ERROR_TYPE="general" ;;
  esac
fi

# Fold this call's log into the shared log for the review's record
cat "$CALL_LOG" >> "$LOG_DIR/dispatch.log" 2>/dev/null || true
rm -f "$CALL_LOG"

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
jq -nc \
  --arg engine "$ENGINE" \
  --argjson success "$SUCCESS" \
  --arg output_file "${OUTPUT_FILE:-}" \
  --argjson duration_ms "$DURATION_MS" \
  --argjson exit_code "$EXIT_CODE" \
  --arg error_type "$ERROR_TYPE" \
  --arg model "${MODEL:-engine_default}" \
  --arg model_used "$MODEL_USED" \
  --argjson tokens_in "${TOKENS_IN:-0}" \
  --argjson tokens_out "${TOKENS_OUT:-0}" \
  '{engine: $engine, success: $success, output_file: $output_file, duration_ms: $duration_ms, exit_code: $exit_code, error_type: $error_type, model: $model, model_used: $model_used, tokens_in: $tokens_in, tokens_out: $tokens_out}'

exit "$EXIT_CODE"
