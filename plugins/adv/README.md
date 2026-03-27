# adv — Adversarial Multi-Model Code Review

Adversarial code review plugin that orchestrates Claude, Codex CLI, and Gemini CLI. Five specialized reviewers examine your code in parallel, then cross-examine each other's findings to filter false positives and surface real issues.

## Features

- **5 specialized reviewers** across 3 model engines (Codex, Gemini, Claude)
- **Adversarial cross-examination** with circuit breaker (max 3 rounds)
- **Structured output** with severity tiers: Bug, Nit, Pre-existing
- **Smart scope**: uncommitted changes by default, or commit range / full repo
- **Graceful degradation**: if Codex or Gemini are unavailable, reviewers fall back to Claude
- **Auto-cleanup**: temp files removed after review; consolidated JSON archive preserved
- **Lightweight dispatch commands** for ad-hoc Codex and Gemini queries

## Prerequisites

- `codex` CLI installed and authenticated (`codex login`)
- `gemini` CLI installed and authenticated (set `GOOGLE_API_KEY` or `GEMINI_API_KEY`)
- `gemini` google_search extension — optional, for `/adv-gemini-research`
- `claude` CLI (always available in Claude Code sessions)
- `jq` for JSON parsing (`brew install jq`)
- `git` for scope resolution

### Verify Setup

```bash
bash plugins/adv/skills/dispatch/scripts/dispatch.sh --check-deps
```

## Installation

```
/plugin install /path/to/plugins/adv
```

## Recommended Permissions

Add these to your project's `.claude/settings.local.json` to auto-allow all adv plugin operations:

```json
{
  "permissions": {
    "allow": [
      "Bash(bash \"/Users/<you>/.claude/plugins/cache/swe-marketplace/adv/:*)",
      "Bash(rm -rf .claude/reviews/.tmp)"
    ]
  }
}
```

Replace `/Users/<you>/` with your home directory path. The prefix pattern matches any plugin version, so permissions survive upgrades.

These permissions are safe because:
- `dispatch.sh` runs external models in sandbox/read-only mode
- `preflight.sh` and `run-phase.sh` only call `dispatch.sh` internally
- The `rm` command is scoped to the review temp directory only

## Components

### Agent

- **adv-review** — Full adversarial code review pipeline. Runs 5 reviewers in parallel, cross-examines findings, synthesizes a severity-ranked fix plan.

### Commands

| Command | Description |
|---|---|
| `/adv-codex <prompt>` | Send a prompt to Codex CLI and return the response |
| `/adv-gemini <prompt>` | Send a prompt to Gemini CLI and return the response |
| `/adv-gemini-research <question>` | Deep research query via Gemini with Google Search grounding |

### Skill (Internal)

- **dispatch** — Shared CLI dispatch infrastructure (not user-invocable). Houses `dispatch.sh`, `preflight.sh`, `run-phase.sh`, `scope.sh`, and reviewer prompt templates.

## Usage

### Full Adversarial Review
```
/adv-review                          # Smart default: reviews uncommitted changes
/adv-review --since HEAD~5           # Review changes since a ref
/adv-review --commits abc123..def456 # Review a specific commit range
/adv-review --full                   # Review entire repository
```

**Smart default** (no flags): If you have uncommitted changes, those are reviewed. Otherwise, the last commit is reviewed. If neither has changes, falls back to full repo.

### Output Files

Each review produces two files in `.claude/reviews/`:
- `review-YYYYMMDD-HHMMSS.md` — Human-readable review report with findings and fix plan
- `findings-YYYYMMDD-HHMMSS.json` — Machine-readable metadata (scope, engines, reviewer status, summary counts)

Temporary working files in `.claude/reviews/.tmp/` are automatically cleaned up after each review.

### Ad-Hoc Model Dispatch
```
/adv-codex "Review this function for edge cases"
/adv-gemini "Explain the architecture of this codebase"
/adv-gemini-research "What are the latest best practices for error handling in TypeScript?"
```

## Review Pipeline

1. **Preflight** — Resolve scope, health-check engines, verify dependencies (1 script call)
2. **Parallel Review** — 5 specialized reviewers run simultaneously:
   - Quality (Codex): naming, dead code, complexity
   - Implementation (Gemini): logic bugs, correctness, edge cases
   - Testing (Codex): test coverage gaps, untested paths
   - Simplification (Claude): refactoring, over-engineering
   - Documentation (Gemini): missing/stale comments, unclear APIs
3. **Cross-Examination** — 2-3 rounds of adversarial validation (VALIDATE/DISPUTE/AMEND), with early exit on convergence
4. **Synthesis** — Deduplicate, severity-rank, generate fix plan grouped by file
5. **Cleanup** — Archive metadata to JSON, delete temp files

## Engine Fallbacks

If an external engine is unavailable (auth failure, quota exhaustion, timeout), its reviewers automatically fall back to Claude. The review still runs — with reduced multi-model diversity but full coverage.

| Engine Issue | Behavior |
|---|---|
| Codex unavailable | Quality + Testing reviewers use Claude |
| Gemini unavailable | Implementation + Docs reviewers use Claude |
| Gemini quota (gemini-2.5-pro) | Retries with gemini-2.0-flash, then falls back to Claude |
| Both unavailable | All reviewers use Claude (single-model mode) |

Minimum 2 of 5 reviewers must succeed for the review to proceed.

## Severity Tiers

- 🔴 **Bug** — Breaks correctness, security, or data integrity
- 🟡 **Nit** — Style, naming, minor improvement
- 🟣 **Pre-existing** — Not introduced by recent changes

## Cross-Exam File Naming

During execution, cross-examination results use standardized naming:
- `xr<N>-<engine>.md` — Round N results from a specific engine (e.g., `xr1-codex.md`)
- `prompt-xr<N>.md` — Prepared prompt for round N

## Dispatch Exit Codes

The `dispatch.sh` script returns classified exit codes for programmatic error handling:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Auth failure |
| 3 | Quota exhausted |
| 4 | Timeout |
| 5 | Empty/invalid response |

## API Key Resolution

For Gemini, dispatch.sh resolves API keys in this order:
1. `GOOGLE_API_KEY` environment variable
2. `GEMINI_API_KEY` environment variable
3. `GEMINI_API_KEY` in `~/.env` via 1Password (`op run`)

## License

MIT
