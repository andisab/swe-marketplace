---
name: dispatch
description: Shared multi-model CLI dispatch infrastructure for the adv plugin. Houses dispatch.sh, scope.sh, and reviewer prompt templates used by the adv-review agent and adv-* commands.
user-invocable: false
---

# Dispatch Infrastructure

This skill provides shared infrastructure for multi-model CLI dispatch. It is NOT user-invocable — it exists as reference material for the `adv-review` orchestrator agent and the `adv-*` commands.

## Available Engines

| Engine | CLI | Non-Interactive Flag | Sandbox Flag |
|---|---|---|---|
| codex | `codex exec` | `--full-auto` | `-s read-only` |
| gemini | `gemini` | `-p <prompt>` | `--sandbox --approval-mode plan` |
| claude | `claude` | `--print` | N/A (always sandboxed) |

## Scripts

### dispatch.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh`

Dispatches a prompt to an external model CLI and captures the response.

```bash
# Basic dispatch
bash dispatch.sh --engine codex --prompt "Review this code" --cwd /path/to/repo

# With output file
bash dispatch.sh --engine gemini --prompt "Find bugs" --output-file /tmp/findings.md

# With prompt file (reads prompt from file instead of --prompt)
bash dispatch.sh --engine claude --prompt-file /path/to/prompt.md --cwd .

# Research mode (Gemini only)
bash dispatch.sh --engine gemini --research --prompt "Latest TypeScript best practices"

# Check prerequisites
bash dispatch.sh --check-deps
```

**Arguments**:
- `--engine <codex|gemini|claude>` — Required. Target engine.
- `--prompt <string>` — The prompt text. Mutually exclusive with `--prompt-file`.
- `--prompt-file <path>` — Read prompt from a file.
- `--model <model>` — Override the default model for the engine.
- `--cwd <path>` — Working directory for the CLI (default: current dir).
- `--timeout <seconds>` — Max execution time (default: 300).
- `--output-file <path>` — Write response to this file.
- `--research` — Gemini only: enable grounded search.
- `--check-deps` — Check for required CLIs and exit with report.
- `--health-check` — Quick ping to verify engine is responsive (30s timeout, minimal prompt).

**Exit Codes** (classified by error type):
| Code | Meaning | Orchestrator Action |
|---|---|---|
| 0 | Success | Use response |
| 1 | General error | Log and fall back to Claude |
| 2 | Auth failure | Mark engine unavailable, fall back |
| 3 | Quota exhausted | Try model fallback (Gemini: `gemini-2.0-flash`), then fall back |
| 4 | Timeout | Mark engine unavailable, fall back |
| 5 | Empty/invalid response | Retry once, then fall back |

**Output Contract**:
- Response text (markdown) is written to `--output-file` if specified.
- On failure, the output file contains `DISPATCH_ERROR: engine=<e> exit_code=<n> duration_ms=<ms>` so the orchestrator can detect failures by reading the file.
- A JSON status line is printed to stdout: `{"engine":"codex","success":true,"output_file":"/path","duration_ms":12345,"exit_code":0,"error_type":"none","model":"default"}`
- Stderr is logged to `.claude/reviews/.tmp/dispatch.log`

**API Key Resolution** (Gemini):
1. Checks `GOOGLE_API_KEY` env var
2. Falls back to `GEMINI_API_KEY` env var
3. If neither set and `op` + `~/.env` available, wraps Gemini calls with `op run --env-file` to inject from 1Password

### scope.sh
**Path**: `${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/scope.sh`

Resolves the review scope (full repo or commit range) and generates scope artifacts.

```bash
# Full repo (default)
bash scope.sh

# Commit range
bash scope.sh --commits abc123..def456

# Since a specific commit
bash scope.sh --since HEAD~5
```

**Output**: JSON to stdout with scope type and artifact paths:
```json
{"type":"full","manifest_file":".claude/reviews/.tmp/scope-manifest.txt"}
{"type":"commits","diff_file":".claude/reviews/.tmp/scope-diff.txt","log_file":".claude/reviews/.tmp/scope-log.txt"}
```

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
