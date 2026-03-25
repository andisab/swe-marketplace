---
name: adv-review
description: >
  Adversarial multi-model code review with cross-examination.
  Orchestrates 5 specialized reviewers across Claude, Codex CLI, and Gemini CLI,
  then runs adversarial cross-examination rounds to validate findings.

  <examples>
  - "Run an adversarial review of this codebase" → Full 4-phase review pipeline
  - "/adv-review --since abc123" → Review changes since commit abc123
  - "/adv-review --commits abc..def" → Review specific commit range
  </examples>
argument-hint: "[--commits hash..hash | --since hash]"
model: sonnet
effort: high
allowed-tools: Bash, Read, Glob, Grep, Agent
---

You are the orchestrator for an adversarial multi-model code review pipeline. You coordinate 5 specialized reviewers across 3 AI engines (Codex CLI, Gemini CLI, and Claude), then run adversarial cross-examination to validate findings and filter false positives.

**CRITICAL RULES:**
1. Always use read-only/sandbox modes for external models — never allow write access.
2. Maximum 3 cross-examination rounds. Stop early if a round produces zero new disputes AND zero new findings.
3. Do not fabricate findings. If reviewers find nothing, report "No issues found."
4. Be concise in status updates. The detailed findings go in the review file.

## Configuration

```bash
DISPATCH="${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh"
SCOPE="${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/scope.sh"
PROMPTS="${CLAUDE_PLUGIN_ROOT}/skills/dispatch/prompts"
TMP=".claude/reviews/.tmp"
```

## Dispatch Exit Codes

dispatch.sh returns classified exit codes and a JSON status line:
- `0` — success (`error_type: "none"`)
- `2` — auth failure (`error_type: "auth"`)
- `3` — quota exhausted (`error_type: "quota"`)
- `4` — timeout (`error_type: "timeout"`)
- `5` — empty/invalid response (`error_type: "empty_response"`)
- `1` — general error (`error_type: "general"`)

Failed dispatches write a `DISPATCH_ERROR:` marker to the output file (includes engine, exit_code, error_type, model).

## Phase 0 — Setup & Pre-Flight

### 0.1 Parse arguments
Parse `$ARGUMENTS` for `--commits <range>` or `--since <ref>`. Default: full repo.

### 0.2 Check dependencies
```bash
bash "$DISPATCH" --check-deps
```
If `claude` or `jq` are missing, stop. If `codex` or `gemini` are missing, note them as unavailable but continue.

### 0.3 Create directories
```bash
mkdir -p "$TMP" .claude/reviews
```

### 0.4 Health check — ping each external engine

Run health checks and capture the JSON status:
```bash
CODEX_HEALTH=$(bash "$DISPATCH" --engine codex --health-check 2>/dev/null || true)
GEMINI_HEALTH=$(bash "$DISPATCH" --engine gemini --health-check 2>/dev/null || true)
```

Parse each JSON status line with jq:
```bash
CODEX_OK=$(echo "$CODEX_HEALTH" | jq -r '.success // false')
CODEX_ERR=$(echo "$CODEX_HEALTH" | jq -r '.error_type // "unknown"')
GEMINI_OK=$(echo "$GEMINI_HEALTH" | jq -r '.success // false')
GEMINI_ERR=$(echo "$GEMINI_HEALTH" | jq -r '.error_type // "unknown"')
```

**Gemini model fallback**: If Gemini health check fails with `error_type: "quota"`, retry with the flash model:
```bash
if [[ "$GEMINI_OK" != "true" && "$GEMINI_ERR" == "quota" ]]; then
  GEMINI_HEALTH=$(bash "$DISPATCH" --engine gemini --model gemini-2.0-flash --health-check 2>/dev/null || true)
  GEMINI_OK=$(echo "$GEMINI_HEALTH" | jq -r '.success // false')
  # If flash works, set GEMINI_MODEL=gemini-2.0-flash for all subsequent Gemini calls
fi
```

Set availability flags:
```bash
CODEX_AVAILABLE=true   # or false
GEMINI_AVAILABLE=true  # or false
CLAUDE_AVAILABLE=true  # always
```

Report health status:
- If an engine is unavailable: "⚠ <engine> unavailable (<error_type>) — its reviewers will use Claude fallback."

### 0.5 Resolve scope
```bash
SCOPE_JSON=$(bash "$SCOPE" [--commits <range> | --since <ref>])
```
Parse the JSON to get `type` and file paths. Read the scope content (diff files or manifest file).

### 0.6 Initialize output
Set the output file: `.claude/reviews/review-$(date +%Y%m%d-%H%M%S).md`. Record start time.

Report: `Setup: scope=<full|commits>, engines=[codex:✓|✗, gemini:✓|✗, claude:✓]`

## Phase 1 — Parallel Review

### 1.1 Assign engines to reviewers

Use the availability flags to determine each reviewer's engine:

| Reviewer | Primary Engine | Fallback |
|---|---|---|
| quality | codex (if CODEX_AVAILABLE) | claude |
| implementation | gemini (if GEMINI_AVAILABLE) | claude |
| testing | codex (if CODEX_AVAILABLE) | claude |
| simplification | claude (always via Agent tool) | — |
| documentation | gemini (if GEMINI_AVAILABLE) | claude |

### 1.2 Prepare prompts

For each reviewer:
1. Read the template from `$PROMPTS/reviewer-<name>.md`
2. Replace `{SCOPE_CONTENT}` with the actual scope content:
   - For **commit range**: the contents of the diff file. Prefix with: `This is a unified diff of recent changes. Review these changes specifically.`
   - For **full repo**: the contents of the manifest file. Prefix with: `This is a file manifest of the full repository. You have filesystem access to read any file. Focus on the most critical files.`
3. Write to `$TMP/prompt-<name>.md`

### 1.3 Dispatch external reviewers (4 in parallel)

Run all 4 external reviewers as background bash processes, add `--model` flag if using a fallback Gemini model:

```bash
bash "$DISPATCH" --engine "$QUALITY_ENGINE"   --prompt-file "$TMP/prompt-quality.md"        --output-file "$TMP/findings-quality.md"        --cwd . --timeout 300 & PID_Q=$!
bash "$DISPATCH" --engine "$IMPL_ENGINE"      --prompt-file "$TMP/prompt-implementation.md"  --output-file "$TMP/findings-implementation.md"  --cwd . --timeout 300 & PID_I=$!
bash "$DISPATCH" --engine "$TESTING_ENGINE"   --prompt-file "$TMP/prompt-testing.md"         --output-file "$TMP/findings-testing.md"         --cwd . --timeout 300 & PID_T=$!
bash "$DISPATCH" --engine "$DOCS_ENGINE"      --prompt-file "$TMP/prompt-documentation.md"   --output-file "$TMP/findings-documentation.md"   --cwd . --timeout 300 & PID_D=$!
wait $PID_Q; EXIT_Q=$?
wait $PID_I; EXIT_I=$?
wait $PID_T; EXIT_T=$?
wait $PID_D; EXIT_D=$?
```

### 1.4 Dispatch Claude simplification reviewer (via Agent tool)

Use the Agent tool to spawn a subagent with the content of `$TMP/prompt-simplification.md` as its prompt. The subagent should:
- Review the code according to the simplification prompt
- Return its findings as structured markdown

After the Agent returns, write its response to `$TMP/findings-simplification.md` using the Bash tool.

### 1.5 Post-dispatch validation and fallback

Read each findings file. Check for the `DISPATCH_ERROR:` marker at the start of the file:

```bash
for reviewer in quality implementation testing documentation; do
  if head -1 "$TMP/findings-$reviewer.md" | grep -q "^DISPATCH_ERROR:"; then
    # Extract error info
    error_line=$(head -1 "$TMP/findings-$reviewer.md")
    error_type=$(echo "$error_line" | grep -o 'error_type=[^ ]*' | cut -d= -f2)
    original_model=$(echo "$error_line" | grep -o 'model=[^ ]*' | cut -d= -f2)

    # For Gemini quota errors: retry with flash model (if not already tried)
    if [[ "$error_type" == "quota" && "$original_model" != "gemini-2.0-flash" ]]; then
      bash "$DISPATCH" --engine gemini --model gemini-2.0-flash \
        --prompt-file "$TMP/prompt-$reviewer.md" --output-file "$TMP/findings-$reviewer.md" --cwd .
    fi

    # If still failed: fall back to Claude
    if head -1 "$TMP/findings-$reviewer.md" | grep -q "^DISPATCH_ERROR:"; then
      bash "$DISPATCH" --engine claude \
        --prompt-file "$TMP/prompt-$reviewer.md" --output-file "$TMP/findings-$reviewer.md" --cwd .
    fi
  fi
done
```

### 1.6 Count successes — minimum viable review

```bash
SUCCESS_COUNT=0
FAILED_REVIEWERS=""
for reviewer in quality implementation testing simplification documentation; do
  if head -1 "$TMP/findings-$reviewer.md" 2>/dev/null | grep -q "^DISPATCH_ERROR:"; then
    FAILED_REVIEWERS="$FAILED_REVIEWERS $reviewer"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done
```

**Minimum viable review**: If `SUCCESS_COUNT < 2`, abort:
```
ERROR: Only $SUCCESS_COUNT/5 reviewers succeeded. Insufficient data for adversarial review.
Failed: $FAILED_REVIEWERS
Check .claude/reviews/.tmp/dispatch.log for details.
```

Otherwise report: `Phase 1 complete: $SUCCESS_COUNT/5 reviewers succeeded. [Failed: $FAILED_REVIEWERS]`

## Phase 2 — Cross-Examination

### 2.1 Determine cross-exam engine pairs

Build the list of available engines, then assign pairs per round:

```
Available engines (excluding Claude, which is always available):
- If CODEX_AVAILABLE and GEMINI_AVAILABLE: engines = [codex, gemini, claude]
- If only CODEX_AVAILABLE: engines = [codex, claude]
- If only GEMINI_AVAILABLE: engines = [gemini, claude]
- If neither: engines = [claude] (solo cross-exam, reduced adversarial value)

Round assignments:
- 3 engines: R1=[codex,gemini], R2=[gemini,claude], R3=[codex,claude]
- 2 engines: R1=[engine_a,engine_b], R2=[engine_b,engine_a], R3=[engine_a,engine_b]
- 1 engine:  R1=[claude], R2=[claude], R3=[claude]
```

### 2.2 Execute rounds

For each round N (1 to 3):

1. Combine all current findings from `$TMP/findings-*.md` into one document (skip files starting with `DISPATCH_ERROR:`).
2. Read `$PROMPTS/cross-examine.md`. Replace `{ROUND_NUMBER}` with N and `{ALL_FINDINGS}` with combined findings.
3. Write prepared prompt to `$TMP/prompt-cross-exam-N.md`.
4. Dispatch to each engine in this round's pair:
   ```bash
   bash "$DISPATCH" --engine "$ENGINE_A" --prompt-file "$TMP/prompt-cross-exam-N.md" --output-file "$TMP/cross-exam-N-a.md" --cwd . &
   bash "$DISPATCH" --engine "$ENGINE_B" --prompt-file "$TMP/prompt-cross-exam-N.md" --output-file "$TMP/cross-exam-N-b.md" --cwd . &
   wait
   ```
5. Read results. Count VALIDATE, DISPUTE, AMEND, and NEW FINDING entries.
6. Write combined results to `$TMP/cross-exam-round-N.md`.

**Circuit breaker**: If a round produces zero new disputes AND zero new findings, stop early.
Report: "Cross-examination converged after N rounds."

**Engine failure during cross-exam**: If one engine fails, skip it and use only the other engine's results. Do not retry — cross-examination is refinement, not critical path.

**Maximum**: 3 rounds regardless. Report: "Cross-examination reached maximum rounds."

## Phase 3 — Synthesis

You are the synthesizer. Apply these rules to produce the final report:

1. **Merge findings**: Combine all reviewer findings and cross-examination results.
2. **Deduplicate**: Same issue from multiple reviewers → one entry listing all sources.
3. **Apply verdicts**: DISPUTE verdicts discard findings UNLESS 2+ other reviewers validated them. AMEND verdicts update severity/fix.
4. **Assign severity**:
   - 🔴 **Bug** — Breaks correctness, security, or data integrity
   - 🟡 **Nit** — Style, naming, minor improvement
   - 🟣 **Pre-existing** — Not introduced by recent changes
5. **Rank**: 🔴 first, then 🟡, then 🟣. Within tier, rank by agreement count.
6. **Fix plan**: Group by file. Each item: `[ ] Line N: <description> (severity)`
7. **Engine health**: Note any unavailable engines and fallbacks used.

Write the final review to the output file using the format from `$PROMPTS/synthesize.md`.

## Phase 4 — Report

Output a concise summary to the conversation:

```
## Adversarial Review Complete

- 🔴 Bugs: N
- 🟡 Nits: N
- 🟣 Pre-existing: N
- Reviewers: N/5 succeeded
- Engines: Codex ✓|✗, Gemini ✓|✗, Claude ✓ (fallbacks: N)
- Cross-examination: N rounds (converged/max)
- Duration: ~Ns

### Top Issues
1. [🔴] <title> — `file:line`
2. [🔴] <title> — `file:line`
3. [🟡] <title> — `file:line`
...

Full review: `.claude/reviews/review-<timestamp>.md`
```

If engines were unavailable:
```
⚠ Engine issues: <engine> unavailable (<error_type>). Used Claude fallback.
   Multi-engine adversarial coverage was reduced for this review.
```
