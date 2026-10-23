#!/usr/bin/env bash
# Tests dispatch.sh against fake codex/gemini/claude commands, so no account or
# network is needed. Covers: success, auth failure, model not found, quota, a hung
# engine with a child process (timeout), and the --output-file error marker.
#
# Usage: bash plugins/adv/tests/dispatch-test.sh [bash-binary]
# Run it twice on macOS to cover both shells: once with the default bash and
# once with `/bin/bash` (3.2), which is what a stock Mac has.
set -euo pipefail

SHELL_BIN="${1:-bash}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH="$HERE/../skills/dispatch/scripts/dispatch.sh"
WORK="$(mktemp -d)"
trap 'pkill -f "adv-test-sleep" 2>/dev/null || true; rm -rf "$WORK"' EXIT

mkdir -p "$WORK/ok" "$WORK/auth" "$WORK/notfound" "$WORK/quota" "$WORK/hang" "$WORK/home" "$WORK/repo"

fake() {  # fake <dir> <name> <script body>
  printf '#!/bin/bash\n%s\n' "$3" > "$1/$2"
  chmod +x "$1/$2"
}
for d in ok auth notfound quota hang; do
  fake "$WORK/$d" claude 'echo "A long enough answer from the fake claude engine for validation."'
done
fake "$WORK/ok"       codex  'echo "A long enough answer from the fake codex engine for validation."'
fake "$WORK/ok"       gemini 'echo "A long enough answer from the fake gemini engine for validation."'
fake "$WORK/auth"     gemini 'echo "Error: API key not valid. Please pass a valid API key." >&2; exit 1'
fake "$WORK/auth"     codex  'echo "ERROR: workspace routing discovery unauthorized (401)" >&2; exit 1'
fake "$WORK/notfound" gemini 'echo "Error when talking to Gemini API ModelNotFoundError: This model mode" >&2; echo "  code: 404" >&2; exit 1'
fake "$WORK/notfound" codex  'echo "ERROR: unexpected status 404 Not Found: The model \`x\` does not exist or you do not have access to it." >&2; exit 1'
fake "$WORK/quota"    gemini 'echo "status: RESOURCE_EXHAUSTED, quota exceeded" >&2; exit 1'
fake "$WORK/quota"    codex  'echo "ERROR: 429 Too Many Requests" >&2; exit 1'
# A fake curl for the REST probe: honours -o <file> and -w, answers HTTP 429 with Google's quota body.
mkdir -p "$WORK/probe429"
cat > "$WORK/probe429/curl" <<'CURL'
#!/bin/bash
out=""; while [[ $# -gt 0 ]]; do case "$1" in -o) out="$2"; shift 2 ;; *) shift ;; esac; done
echo '{"error":{"code":429,"message":"You exceeded your current quota. Please retry in 1h30m.","status":"RESOURCE_EXHAUSTED"}}' > "$out"
printf 429
CURL
chmod +x "$WORK/probe429/curl"
fake "$WORK/probe429" gemini 'echo "the CLI must not be called when the probe fails"; sleep 30'
# A hung engine that starts a child holding stdout open; the timeout must kill both.
fake "$WORK/hang"     codex  'exec -a adv-test-sleep sleep 4321 & wait'
fake "$WORK/hang"     gemini 'exec -a adv-test-sleep sleep 4321 & wait'

pass=0; fail=0
check() {  # check <label> <fakes-dir> <engine> <expected exit> <expected error_type> [extra dispatch args...]
  local label="$1" dir="$2" engine="$3" want_exit="$4" want_type="$5"; shift 5
  local out json got_exit got_type marker
  rm -rf "$WORK/repo/.claude" "$WORK/repo/out"
  set +e
  json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/$dir:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin" \
    "$SHELL_BIN" "$DISPATCH" --engine "$engine" --prompt "hi" --output-file out/r.md "$@" 2>/dev/null)
  got_exit=$?
  set -e
  got_type=$(printf '%s' "$json" | tail -1 | jq -r '.error_type' 2>/dev/null || echo "?")
  marker=$(head -1 "$WORK/repo/out/r.md" 2>/dev/null || echo "(no output file)")
  if [[ "$got_exit" == "$want_exit" && "$got_type" == "$want_type" ]]; then
    if [[ "$want_exit" != 0 && "$marker" != DISPATCH_ERROR:*error_type=$want_type* ]]; then
      echo "FAIL $label: exit and type ok, but output marker is: $marker"; fail=$((fail+1)); return
    fi
    echo "ok   $label"; pass=$((pass+1))
  else
    echo "FAIL $label: want exit=$want_exit type=$want_type, got exit=$got_exit type=$got_type ($marker)"; fail=$((fail+1))
  fi
}

cd "$WORK/repo" && git init -q . 2>/dev/null || true

check "codex success"            ok       codex  0 none
check "gemini success"           ok       gemini 0 none
check "claude success"           ok       claude 0 none
check "gemini auth failure"      auth     gemini 2 auth
check "codex auth failure"       auth     codex  2 auth
check "gemini quota"             quota    gemini 3 quota
check "codex quota"              quota    codex  3 quota
check "codex hang -> timeout"    hang     codex  4 timeout         --timeout 2
check "gemini hang -> timeout"   hang     gemini 4 timeout         --timeout 2
check "gemini model not found"   notfound gemini 6 model_not_found --model gemini-2.5-pro
check "codex model not found"    notfound codex  6 model_not_found --model gpt-nonexistent

# Health check with a key set: the REST probe must report quota without calling the CLI
rm -rf "$WORK/repo/.claude"
json=$(cd "$WORK/repo" && HOME="$WORK/home" GEMINI_API_KEY="fake-key" PATH="$WORK/probe429:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin" \
  "$SHELL_BIN" "$DISPATCH" --engine gemini --health-check 2>/dev/null) || true
got_type=$(printf '%s' "$json" | tail -1 | jq -r '.error_type' 2>/dev/null || echo "?")
if [[ "$got_type" == "quota" ]] && grep -q "HTTP 429" "$WORK/repo/.claude/reviews/.tmp/dispatch.log"; then
  echo "ok   gemini health probe -> quota (429)"; pass=$((pass+1))
else
  echo "FAIL gemini health probe: got type=$got_type"; fail=$((fail+1))
fi

leftover=$( (pgrep -f "adv-test-sleep" || true) | wc -l | tr -d ' ')
if [[ "$leftover" == "0" ]]; then echo "ok   no engine processes left behind"; pass=$((pass+1)); else echo "FAIL $leftover engine processes left behind"; fail=$((fail+1)); fi

echo "dispatch-test ($SHELL_BIN): $pass passed, $fail failed"
[[ "$fail" == 0 ]]
