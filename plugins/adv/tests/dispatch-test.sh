#!/usr/bin/env bash
# Tests dispatch.sh, run-phase.sh and preflight.sh against fake codex/gemini/claude/gh
# commands, so no account or network is needed. The fakes answer the way the real CLIs
# do in their JSON modes (Codex CLI 0.163 `exec --json` and `review`, Gemini CLI 0.65
# `-o json`, `claude --output-format json`). Covers: success with model and token
# reporting, auth failure (stderr text and Gemini's JSON error), model not found, quota,
# a hung engine with a child process (timeout), the --output-file error marker, Codex
# review mode through run-phase (scope sentence, adapter, relative paths), the Claude
# fallback, and the --pr scope.
#
# Usage: bash plugins/adv/tests/dispatch-test.sh [bash-binary]
# Run it twice on macOS to cover both shells: once with the default bash and
# once with `/bin/bash` (3.2), which is what a stock Mac has.
set -euo pipefail

SHELL_BIN="$(command -v "${1:-bash}")"   # absolute, so a test can run it with a stripped PATH
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$HERE/../skills/dispatch/scripts"
DISPATCH="$SCRIPTS/dispatch.sh"
RUN_PHASE="$SCRIPTS/run-phase.sh"
PREFLIGHT="$SCRIPTS/preflight.sh"
WORK="$(mktemp -d)"
trap 'pkill -f "adv-test-sleep" 2>/dev/null || true; rm -rf "$WORK"' EXIT
SYS_PATH="/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin"

mkdir -p "$WORK/ok" "$WORK/auth" "$WORK/jsonerr" "$WORK/notfound" "$WORK/quota" "$WORK/hang" "$WORK/home/.codex" "$WORK/repo" "$WORK/prompts"
printf 'model = "gpt-fake"\n' > "$WORK/home/.codex/config.toml"   # the pin Codex's own header reports

fake() {  # fake <dir> <name> <script body>
  printf '#!/bin/bash\n%s\n' "$3" > "$1/$2"
  chmod +x "$1/$2"
}
CLAUDE_OK='[[ " $* " == *" --output-format json "* ]] || { echo "fake claude: no --output-format json" >&2; exit 9; }
printf "%s\n" "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":\"A long enough answer from the fake claude engine for validation.\",\"usage\":{\"input_tokens\":2,\"cache_read_input_tokens\":100,\"cache_creation_input_tokens\":300,\"output_tokens\":12},\"modelUsage\":{\"claude-sonnet-5-5\":{}}}"'
for d in ok auth jsonerr notfound quota hang; do
  fake "$WORK/$d" claude "$CLAUDE_OK"
done
# Codex: `exec` answers in JSONL (a config warning lands in an error item, no event names the model);
# `review` prints its header to stderr and a text report with [P<n>] comments and absolute paths.
fake "$WORK/ok" codex 'case "$1" in
  exec)
    [[ " $* " == *" --json "* ]] || { echo "fake codex: exec without --json" >&2; exit 9; }
    echo "{\"type\":\"thread.started\",\"thread_id\":\"t1\"}"
    echo "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_0\",\"type\":\"error\",\"message\":\"Model metadata for gpt-fake not found.\"}}"
    echo "{\"type\":\"item.completed\",\"item\":{\"id\":\"item_1\",\"type\":\"agent_message\",\"text\":\"A long enough answer from the fake codex engine for validation.\"}}"
    echo "{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":1200,\"cached_input_tokens\":0,\"output_tokens\":34}}" ;;
  review)
    [[ " $* " == *" sandbox_mode=\"read-only\" "* ]] || { echo "fake codex: review without the read-only sandbox" >&2; exit 9; }
    [[ " $* " == *"Review the uncommitted changes"* ]] || { echo "fake codex: review prompt does not name the scope" >&2; exit 9; }
    printf "OpenAI Codex v0.163.0\n--------\nworkdir: %s\nmodel: gpt-fake-review\n--------\n" "$PWD" >&2
    printf "The patch has one defect.\n\nReview comment:\n\n- [P1] Return the right bound — %s/calc.py:18-21\n  Values below low return high.\n- [P3] Rename the loop variable — %s/calc.py:4\n  The name says nothing.\n" "$PWD" "$PWD" ;;
  *) echo "fake codex: unexpected subcommand $1" >&2; exit 9 ;;
esac'
fake "$WORK/ok" gemini '[[ " $* " == *" -o json "* ]] || { echo "fake gemini: no -o json" >&2; exit 9; }
[[ " $* " == *" -m "* ]] && { echo "fake gemini: a model was passed: $*" >&2; exit 9; }
printf "%s\n" "{\"session_id\":\"s1\",\"response\":\"A long enough answer from the fake gemini engine for validation.\",\"stats\":{\"models\":{\"gemini-3-flash-preview\":{\"api\":{\"totalRequests\":1},\"tokens\":{\"prompt\":900,\"candidates\":40,\"total\":940}}}}}"'
fake "$WORK/auth"     gemini 'echo "Error: API key not valid. Please pass a valid API key." >&2; exit 1'
fake "$WORK/auth"     codex  'echo "ERROR: workspace routing discovery unauthorized (401)" >&2; exit 1'
# Gemini's JSON error path: the error object on stdout, nothing useful on stderr
fake "$WORK/jsonerr"  gemini 'echo "{\"error\":{\"type\":\"ApiError\",\"message\":\"API key not valid. Please pass a valid API key.\",\"code\":400}}"; exit 41'
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
# A fake curl with no network: prints 000 and exits 7, as curl does; the CLI must then be tried
mkdir -p "$WORK/probe000"
printf '#!/bin/bash\nprintf 000; exit 7\n' > "$WORK/probe000/curl"; chmod +x "$WORK/probe000/curl"
cp "$WORK/ok/gemini" "$WORK/probe000/gemini"
# A hung engine that starts a child holding stdout open; the timeout must kill both.
fake "$WORK/hang"     codex  'exec -a adv-test-sleep sleep 4321 & wait'
fake "$WORK/hang"     gemini 'exec -a adv-test-sleep sleep 4321 & wait'
# A fake gh for the --pr scope
mkdir -p "$WORK/gh"
fake "$WORK/gh" gh 'case "$1 ${2:-}" in
  "pr view") echo "{\"number\":42,\"baseRefName\":\"main\",\"headRefName\":\"feature/x\",\"headRefOid\":\"abc123\",\"url\":\"https://github.com/o/r/pull/42\"}" ;;
  "pr diff") if [[ " $* " == *" --name-only "* ]]; then printf "calc.py\n"; else printf "diff --git a/calc.py b/calc.py\n--- a/calc.py\n+++ b/calc.py\n@@ -1 +1,2 @@\n+x = 1\n"; fi ;;
  "--version ") echo "gh version 2.0.0 (fake)" ;;
  *) echo "fake gh: unexpected $*" >&2; exit 9 ;;
esac'

pass=0; fail=0
ok()   { echo "ok   $1"; pass=$((pass+1)); }
bad()  { echo "FAIL $1"; fail=$((fail+1)); }
check() {  # check <label> <fakes-dir> <engine> <expected exit> <expected error_type> [extra dispatch args...]
  local label="$1" dir="$2" engine="$3" want_exit="$4" want_type="$5"; shift 5
  local json got_exit got_type marker
  rm -rf "$WORK/repo/.claude" "$WORK/repo/out"
  set +e
  json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/$dir:$SYS_PATH" \
    "$SHELL_BIN" "$DISPATCH" --engine "$engine" --prompt "hi" --output-file out/r.md "$@" 2>/dev/null)
  got_exit=$?
  set -e
  LAST_JSON="$(printf '%s' "$json" | tail -1)"
  got_type=$(printf '%s' "$LAST_JSON" | jq -r '.error_type' 2>/dev/null || echo "?")
  marker=$(head -1 "$WORK/repo/out/r.md" 2>/dev/null || echo "(no output file)")
  if [[ "$got_exit" == "$want_exit" && "$got_type" == "$want_type" ]]; then
    if [[ "$want_exit" != 0 && "$marker" != DISPATCH_ERROR:*error_type=$want_type* ]]; then
      bad "$label: exit and type ok, but output marker is: $marker"; return
    fi
    ok "$label"
  else
    bad "$label: want exit=$want_exit type=$want_type, got exit=$got_exit type=$got_type ($marker)"
  fi
}
# status_is <label> <jq expression that must be true on the last status line>
status_is() {
  if printf '%s' "$LAST_JSON" | jq -e "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1: status line was $LAST_JSON"; fi
}

cd "$WORK/repo" && git init -q . 2>/dev/null || true

check "codex success"            ok       codex  0 none
status_is "codex status reports the model pin and tokens" '.model_used == "gpt-fake" and .tokens_in == 1200 and .tokens_out == 34'
grep -q "^A long enough answer from the fake codex" "$WORK/repo/out/r.md" && ok "codex response is the agent message, not the JSONL" || bad "codex response: $(head -1 "$WORK/repo/out/r.md")"
grep -q "^codex: Model metadata for gpt-fake not found" "$WORK/repo/.claude/reviews/.tmp/dispatch.log" && ok "codex error items go to the log" || bad "codex error item missing from the log"
check "gemini success"           ok       gemini 0 none
status_is "gemini status reports the routed model and tokens" '.model_used == "gemini-3-flash-preview" and .tokens_in == 900 and .tokens_out == 40'
grep -q "^A long enough answer from the fake gemini" "$WORK/repo/out/r.md" && ok "gemini response is the response field" || bad "gemini response: $(head -1 "$WORK/repo/out/r.md")"
check "claude success"           ok       claude 0 none
status_is "claude status reports the model and tokens" '.model_used == "claude-sonnet-5-5" and .tokens_in == 402 and .tokens_out == 12'
check "gemini auth failure"      auth     gemini 2 auth
check "gemini JSON error -> auth" jsonerr gemini 2 auth
check "codex auth failure"       auth     codex  2 auth
check "gemini quota"             quota    gemini 3 quota
check "codex quota"              quota    codex  3 quota
check "codex hang -> timeout"    hang     codex  4 timeout         --timeout 2
check "gemini hang -> timeout"   hang     gemini 4 timeout         --timeout 2
check "gemini model not found"   notfound gemini 6 model_not_found --model gemini-2.5-pro
check "codex model not found"    notfound codex  6 model_not_found --model gpt-nonexistent

# Health check with a key set: the REST probe must report quota without calling the CLI
rm -rf "$WORK/repo/.claude"
json=$(cd "$WORK/repo" && HOME="$WORK/home" GEMINI_API_KEY="fake-key" PATH="$WORK/probe429:$SYS_PATH" \
  "$SHELL_BIN" "$DISPATCH" --engine gemini --health-check 2>/dev/null) || true
got_type=$(printf '%s' "$json" | tail -1 | jq -r '.error_type' 2>/dev/null || echo "?")
if [[ "$got_type" == "quota" ]] && grep -q "HTTP 429" "$WORK/repo/.claude/reviews/.tmp/dispatch.log"; then
  ok "gemini health probe -> quota (429)"
else
  bad "gemini health probe: got type=$got_type"
fi

# Health check with a key set and no network: the probe can't decide, so the CLI is tried and answers
rm -rf "$WORK/repo/.claude"
json=$(cd "$WORK/repo" && HOME="$WORK/home" GEMINI_API_KEY="fake-key" PATH="$WORK/probe000:$SYS_PATH" \
  "$SHELL_BIN" "$DISPATCH" --engine gemini --health-check 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
if printf '%s' "$LAST_JSON" | jq -e '.success == true' >/dev/null 2>&1 && grep -q "no HTTP response" "$WORK/repo/.claude/reviews/.tmp/dispatch.log"; then
  ok "gemini health probe without network -> CLI tried"
else
  bad "gemini health probe without network: $LAST_JSON"
fi

# run-phase review: Codex reviewers in review mode (scope sentence, adapter, relative paths), Gemini on the diff
printf 'quality prompt with the diff\n' > "$WORK/prompts/prompt-quality.md"
printf 'implementation prompt with the diff\n' > "$WORK/prompts/prompt-implementation.md"
rm -rf "$WORK/repo/.claude" "$WORK/repo/out"
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/ok:$SYS_PATH" \
  "$SHELL_BIN" "$RUN_PHASE" --phase review --assignments "quality:codex,implementation:gemini" \
  --prompt-dir "$WORK/prompts" --output-dir out --timeout 20 --gemini-model engine_default \
  --codex-review "Review the uncommitted changes in this repository. Run git diff HEAD." 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "run-phase review summary has models and tokens (and engine_default is not a model)" '.success_count == 2 and .results.quality.engine == "codex" and .results.quality.model_used == "gpt-fake-review" and .results.implementation.model_used == "gemini-3-flash-preview" and .tokens.in == 900 and .tokens.out == 40'
f="$WORK/repo/out/findings-quality.md"
if grep -q '^\- \*\*File:\*\* calc.py:18-21$' "$f" && grep -q 'Severity:\*\* 🔴 Bug (Codex P1)' "$f" && grep -q 'Severity:\*\* 🟡 Nit (Codex P3)' "$f" && grep -q '^## Codex review summary' "$f"; then
  ok "codex review report adapted to adv findings with relative paths"
else
  bad "codex review adapter output:"; sed 's/^/     /' "$f"
fi
p="$WORK/repo/out/prompt-quality.codex-review.md"
if [[ -f "$p" ]] && grep -q "Review the uncommitted changes in this repository" "$p" && ! grep -q "{SCOPE_CONTENT}" "$p" && grep -q "Code Quality Review" "$p"; then
  ok "codex review prompt is the template with the scope sentence"
else
  bad "codex review prompt: $(head -3 "$p" 2>/dev/null)"
fi
[[ "$(printf '%s' "$json" | wc -l | tr -d ' ')" == "0" ]] && ok "run-phase prints only its summary" || bad "run-phase printed $(printf '%s' "$json" | wc -l | tr -d ' ') extra lines"

# run-phase review: Gemini quota -> fallback model (still quota) -> Claude, on the diff prompt
rm -rf "$WORK/repo/.claude" "$WORK/repo/out"
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/quota:$SYS_PATH" \
  "$SHELL_BIN" "$RUN_PHASE" --phase review --assignments "implementation:gemini" \
  --prompt-dir "$WORK/prompts" --output-dir out --timeout 20 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "run-phase falls back to Claude and reports its model" '.success_count == 1 and .results.implementation.engine == "claude" and .results.implementation.fallback_used == true and .results.implementation.model_used == "claude-sonnet-5-5"'
grep -c "quota" "$WORK/repo/.claude/reviews/.tmp/dispatch.log" | grep -q '^2$' && ok "gemini was retried once on the fallback model" || bad "expected two gemini quota failures in the log"

# run-phase cross-exam summary
printf 'xr prompt\n' > "$WORK/prompts/prompt-xr1.md"
rm -rf "$WORK/repo/.claude" "$WORK/repo/out"
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/ok:$SYS_PATH" \
  "$SHELL_BIN" "$RUN_PHASE" --phase cross-exam --round 1 --assignments "codex,gemini" \
  --prompt-dir "$WORK/prompts" --output-dir out --timeout 20 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "run-phase cross-exam summary has models and tokens" '.success_count == 2 and .results.codex.model_used == "gpt-fake" and .results.gemini.model_used == "gemini-3-flash-preview" and .tokens.in == 2100'
status_is "run-phase cross-exam counts zero verdicts without failing" '.verdicts == {validate: 0, dispute: 0, amend: 0, new_findings: 0}'

# preflight --pr: the diff comes from gh, Codex review mode is off, PR metadata is reported
rm -rf "$WORK/repo/.claude"
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/ok:$WORK/gh:$SYS_PATH" \
  "$SHELL_BIN" "$PREFLIGHT" --pr 42 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "preflight --pr resolves the pull request" '.scope.type == "pr" and .scope.range == "#42: feature/x into main" and .scope.codex_review == "" and .scope.pr.number == 42 and .scope.files_changed == 1 and .engines.codex.available == true and .engines.gemini.model == ""'
grep -q "^diff --git a/calc.py" "$WORK/repo/.claude/reviews/.tmp/scope-content.txt" && ok "preflight --pr writes the PR diff" || bad "scope content is not the PR diff"
# Without gh: a PATH holding only what preflight needs before its gh check (the system dirs may hold a real gh)
mkdir -p "$WORK/hermetic"
for t in dirname git jq mkdir; do ln -s "$(command -v $t)" "$WORK/hermetic/$t"; done
err=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/hermetic" "$SHELL_BIN" "$PREFLIGHT" --pr 42 2>&1 >/dev/null) && bad "preflight --pr without gh should fail" || { [[ "$err" == *"needs the GitHub CLI"* ]] && ok "preflight --pr without gh explains the checkout route" || bad "preflight --pr without gh: $err"; }

# preflight on uncommitted changes: the Codex review scope sentence is set
printf 'x = 1\n' > "$WORK/repo/calc.py"; (cd "$WORK/repo" && git add calc.py && git -c user.email=t@t -c user.name=t commit -qm init && printf 'x = 2\n' > calc.py)
rm -rf "$WORK/repo/.claude"
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/ok:$SYS_PATH" "$SHELL_BIN" "$PREFLIGHT" 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "preflight working scope names the scope for codex review" '.scope.type == "working" and (.scope.codex_review | test("git diff HEAD"))'

# preflight on a tree whose only change is a new untracked file: still a working scope, with the file's content
(cd "$WORK/repo" && git add calc.py && git -c user.email=t@t -c user.name=t commit -qm change && printf 'def new():\n    return 1\n' > new.py)
rm -rf "$WORK/repo/.claude" "$WORK/repo/out"   # adv's own .claude/reviews/ must not count as an untracked change either
json=$(cd "$WORK/repo" && HOME="$WORK/home" PATH="$WORK/ok:$SYS_PATH" "$SHELL_BIN" "$PREFLIGHT" 2>/dev/null) || true
LAST_JSON="$(printf '%s' "$json" | tail -1)"
status_is "preflight treats untracked-only changes as a working scope" '.scope.type == "working" and .scope.untracked_files == 1 and .scope.files_changed == 1'
grep -q '^+def new():' "$WORK/repo/.claude/reviews/.tmp/scope-content.txt" && ok "untracked file content is in the scope diff" || bad "untracked file content missing from the scope diff"

leftover=$( (pgrep -fl "adv-test-sleep" || true) | grep -v 'pgrep' || true)
if [[ -z "$leftover" ]]; then ok "no engine processes left behind"; else bad "engine processes left behind:"; printf '%s\n' "$leftover" | sed 's/^/     /'; fi

echo "dispatch-test ($SHELL_BIN): $pass passed, $fail failed"
[[ "$fail" == 0 ]]
