---
name: dispatch
description: Shared multi-model CLI dispatch infrastructure for the adv plugin. Houses dispatch.sh, preflight.sh, run-phase.sh, scope.sh, and reviewer prompt templates used by the adv-review agent and adv-* commands.
user-invocable: false
---

# Dispatch Infrastructure

This skill provides shared infrastructure for multi-model CLI dispatch. It is NOT user-invocable — it exists as reference material for the `adv-review` orchestrator agent and the `adv-*` commands.

## Available Engines

| Engine | CLI | Non-Interactive Flags | Sandbox Flag |
|---|---|---|---|
| codex | `codex exec` | `--skip-git-repo-check -C <cwd> --json` (`--full-auto` was removed in Codex CLI 0.163) | `-s read-only` |
| codex (`--codex-review`) | `codex review` | `-c model="..."` when a model is set; run from `<cwd>` (no `-C`, `-m` or `--json` in 0.163); the prompt names the git scope, because the scope flags can't be combined with a prompt | `-c sandbox_mode="read-only"` |
| gemini | `gemini` | `-p <prompt> --skip-trust -o json` (`--skip-trust` is required for headless runs since Gemini CLI 0.65) | `--approval-mode plan` (read-only; `--sandbox` broke API calls on macOS in 0.65) |
| claude | `claude` | `--print --output-format json` | N/A (always sandboxed) |

No model flag is passed unless the caller sets one. Each CLI then uses its own current default. Every engine is asked for JSON, which is where the text, the model that answered and the token counts live: Codex `exec --json` prints JSONL events (`item.completed` with `agent_message` text or `error` warnings, `turn.completed` with usage; no event names the model, so the status line reports the `--model` argument or the pin in `~/.codex/config.toml`), Gemini `-o json` prints one object (`response`, `stats.models` keyed by the model that answered, `warnings`, `error`), and `claude --output-format json` prints one object (`result`, `is_error`, `usage`, `modelUsage`). `codex review` prints a text report, which `codex-review-adapter.py` turns into adv's finding format. Tested with Codex CLI 0.163.0 and Gemini CLI 0.65.0 (October 2026).

## Scripts

### preflight.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/preflight.sh`

Combined pre-flight check: dependency verification, engine health checks, and scope resolution in a single call.

```bash
# Smart default (uncommitted changes > last commit > full repo)
bash preflight.sh

# Explicit scope modes
bash preflight.sh --commits abc123..def456
bash preflight.sh --since HEAD~5
bash preflight.sh --full
bash preflight.sh --pr 42
```

**Arguments**:
- `--commits <range>` — Review a specific commit range.
- `--since <ref>` — Review changes since a commit/ref.
- `--full` — Full repo file manifest.
- `--pr <number|url>` — Review a GitHub pull request's diff, read with `gh pr diff`; nothing is checked out. Needs the `gh` CLI.
- _(no flags)_ — Smart default: uncommitted changes > last commit > full repo.

**Output**: Single JSON object to stdout:
```json
{
  "deps": {"codex": true, "gemini": true, "claude": true, "jq": true},
  "engines": {
    "codex": {"available": true, "error_type": "none"},
    "gemini": {"available": true, "error_type": "none", "model": ""}
  },
  "scope": {
    "type": "working",
    "files_changed": 5,
    "diff_lines": 120,
    "untracked_files": 2,
    "codex_review": "Review the uncommitted changes in this repository. Run `git diff HEAD` ...",
    "pr": null,
    "content_file": ".claude/reviews/.tmp/scope-content.txt"
  }
}
```

**Scope types**: `working` (uncommitted changes), `commits` (commit range/since), `full` (file manifest), `pr` (a pull request's diff; `scope.pr` carries `number`, `baseRefName`, `headRefName`, `headRefOid` and `url`).

`scope.codex_review` is the sentence that names a local diff scope for Codex's review mode (see run-phase `--codex-review`). It's empty for `full` and `pr`, where Codex can't read the scope from the repository on disk.

Internally calls `dispatch.sh --health-check` for engine verification, including automatic Gemini flash fallback on quota errors.

### run-phase.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/run-phase.sh`

Parallel dispatch orchestrator for review and cross-examination phases. Handles dispatch, validation, and fallback in a single call.

```bash
# Review phase — dispatch 4 reviewers in parallel
bash run-phase.sh --phase review \
  --assignments "quality:codex,implementation:gemini,testing:codex,documentation:gemini" \
  --prompt-dir "$TMP" --output-dir "$TMP" --timeout 300

# Cross-exam phase — dispatch 2 engines in parallel
bash run-phase.sh --phase cross-exam --round 1 \
  --assignments "codex,gemini" \
  --prompt-dir "$TMP" --output-dir "$TMP" --timeout 300
```

**Arguments**:
- `--phase <review|cross-exam>` — Required. Phase type.
- `--assignments <spec>` — Required. Engine assignments.
  - Review: `"quality:codex,implementation:gemini,testing:codex,documentation:gemini"`
  - Cross-exam: `"codex,gemini"` (just engine names)
- `--prompt-dir <path>` — Directory containing prepared prompt files.
- `--output-dir <path>` — Directory for output files.
- `--timeout <seconds>` — Timeout per dispatch (default: 300).
- `--round <N>` — Cross-exam round number (required for cross-exam phase).
- `--gemini-model <model>` — Override the Gemini model. By default no model is passed and the CLI uses its own current default.
- `--codex-review <scope>` — Review phase only. Runs the Codex reviewers through `codex review` instead of `codex exec`. `<scope>` is preflight's `scope.codex_review` sentence; run-phase writes `prompt-<reviewer>.codex-review.md` from the reviewer template with that sentence in place of the diff, and Codex reads the changes from the repository itself. A Codex reviewer that falls back to Claude uses `prompt-<reviewer>.md` (the diff) instead.

**File naming conventions**:
- Review prompts: `prompt-<reviewer>.md` (e.g., `prompt-quality.md`); Codex review mode adds `prompt-<reviewer>.codex-review.md`
- Review findings: `findings-<reviewer>.md` (e.g., `findings-quality.md`)
- Dispatch status lines: `status-<reviewer>.json` and `status-xr<N>-<engine>.json`
- Cross-exam prompts: `prompt-xr<N>.md` (e.g., `prompt-xr1.md`)
- Cross-exam results: `xr<N>-<engine>.md` (e.g., `xr1-codex.md`, `xr1-gemini.md`)

**Output**: one JSON summary line on stdout (the dispatch status lines go to the status files):
```json
{
  "phase": "review",
  "results": {
    "quality": {"engine": "codex", "status": "success", "fallback_used": false, "model_used": "gpt-6.1-sol", "tokens_in": 18200, "tokens_out": 1900, "duration_ms": 41000}
  },
  "success_count": 4,
  "failed": [],
  "tokens": {"in": 61000, "out": 7400}
}
```

Cross-exam output has the same per-engine fields plus verdict counts:
```json
{
  "phase": "cross-exam",
  "round": 1,
  "results": {"codex": {"status": "success", "model_used": "gpt-6.1-sol", "tokens_in": 22000, "tokens_out": 2100, "duration_ms": 50000}},
  "tokens": {"in": 44000, "out": 4000},
  "verdicts": {"validate": 8, "dispute": 2, "amend": 1, "new_findings": 0}
}
```

**Fallback logic** (review phase only):
1. If Gemini dispatch fails with quota or the model isn't found, retries with the fallback model (`ADV_GEMINI_FALLBACK_MODEL`, default `gemini-3-flash-preview`)
2. If still failed, falls back to Claude
3. Final status reported in JSON output

### dispatch.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh`

Core single-model CLI dispatcher. Called internally by `preflight.sh` and `run-phase.sh`, and directly by the `/adv-codex`, `/adv-gemini`, `/adv-gemini-research` commands.

```bash
# Basic dispatch
bash dispatch.sh --engine codex --prompt "Review this code" --cwd /path/to/repo

# With output file and prompt file
bash dispatch.sh --engine gemini --prompt-file /path/to/prompt.md --output-file /tmp/findings.md

# Research mode (Gemini only)
bash dispatch.sh --engine gemini --research --prompt "Latest TypeScript best practices"

# Codex review mode: the prompt names the git scope, Codex reads the repository at --cwd
bash dispatch.sh --engine codex --codex-review --cwd . --prompt-file prompt-quality.codex-review.md

# Check prerequisites
bash dispatch.sh --check-deps

# Health check
bash dispatch.sh --engine codex --health-check
```

**Arguments**:
- `--engine <codex|gemini|claude>` — Required. Target engine.
- `--prompt <string>` — The prompt text. Mutually exclusive with `--prompt-file`.
- `--prompt-file <path>` — Read prompt from a file.
- `--model <model>` — Model for the engine. Default: none passed, so the CLI uses its own current default; `ADV_CODEX_MODEL`, `ADV_GEMINI_MODEL` and `ADV_CLAUDE_MODEL` set a default per engine.
- `--cwd <path>` — Working directory for the CLI (default: current dir).
- `--timeout <seconds>` — Max execution time (default: 300).
- `--output-file <path>` — Write response to this file.
- `--research` — Gemini only: enable grounded search.
- `--codex-review` — Codex only: run `codex review` instead of `codex exec`. The prompt must name the git scope (Codex's own scope flags can't be combined with a prompt). The report is rewritten by `codex-review-adapter.py` into adv's finding blocks: paths made relative to `--cwd`, Codex priorities P0–P2 mapped to 🔴 Bug and P3 to 🟡 Nit, the original priority kept in the Severity line.
- `--check-deps` — Check for required CLIs and exit with report.
- `--health-check` — Quick ping to verify engine is responsive (60s timeout, minimal prompt; for Gemini, a REST probe first).

**Exit Codes** (classified by error type):
| Code | Meaning | Orchestrator Action |
|---|---|---|
| 0 | Success | Use response |
| 1 | General error | Log and fall back to Claude |
| 2 | Auth failure | Mark engine unavailable, fall back |
| 3 | Quota exhausted | Try the Gemini fallback model (`gemini-3-flash-preview` unless `ADV_GEMINI_FALLBACK_MODEL` is set), then fall back to Claude |
| 6 | Model not found | Same fallback as quota |
| 4 | Timeout | Mark engine unavailable, fall back |
| 5 | Empty/invalid response | Retry once, then fall back |

**Output Contract**:
- Response text (markdown) is written to `--output-file` if specified.
- On failure, the output file contains `DISPATCH_ERROR: engine=<e> exit_code=<n> duration_ms=<ms>` so the orchestrator can detect failures by reading the file.
- A JSON status line is printed to stdout: `{"engine":"codex","success":true,"output_file":"/path","duration_ms":12345,"exit_code":0,"error_type":"none","model":"engine_default","model_used":"gpt-6.1-sol","tokens_in":18200,"tokens_out":1900}`. `model` is what was requested; `model_used` is what answered (Gemini's auto mode routes per call, and `claude` reports the full model id). Tokens are 0 for `codex review`, whose text report has no usage.
- Stderr is logged to `.claude/reviews/.tmp/dispatch.log`, along with the config warnings and errors the JSON carries

**API Key Resolution** (Gemini):
1. Checks `GOOGLE_API_KEY` env var
2. Falls back to `GEMINI_API_KEY` env var
3. If neither set and `op` + `~/.env` available, wraps Gemini calls with `op run --env-file` to inject from 1Password

### codex-review-adapter.py
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/codex-review-adapter.py`

Reads a `codex review` report on stdin and writes adv finding blocks (`### Finding:` with File, Severity, Title, Description). `--root <dir>` makes the absolute paths relative. A report with no `- [P<n>]` comments (such as `No findings.`) passes through unchanged. `dispatch.sh --codex-review` runs it; it has no other caller.

### scope.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/scope.sh`

Standalone git scope resolver. Used by the ad-hoc commands. The orchestrator uses `preflight.sh` instead (which includes scope resolution).

```bash
# Smart default (uncommitted changes > last commit > full repo)
bash scope.sh

# Explicit modes
bash scope.sh --commits abc123..def456
bash scope.sh --since HEAD~5
bash scope.sh --full
```

**Output**: JSON to stdout with scope type and artifact paths.

## Prompts

Reviewer prompt templates are in `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/prompts/`:

| File | Reviewer | Engine |
|---|---|---|
| `reviewer-quality.md` | Code quality | Codex |
| `reviewer-implementation.md` | Implementation correctness | Gemini |
| `reviewer-testing.md` | Test coverage | Codex |
| `reviewer-simplification.md` | Simplification opportunities | Claude |
| `reviewer-documentation.md` | Documentation completeness | Gemini |
| `cross-examine.md` | Cross-examination template | All |
| `synthesize.md` | Final synthesis template | Orchestrator |

Each reviewer prompt contains a `{SCOPE_CONTENT}` placeholder that the orchestrator replaces with the actual scope content (diff or manifest) before dispatch.
