# adv — Adversarial Multi-Model Code Review

Adversarial code review plugin that orchestrates Claude, Codex CLI, and Gemini CLI. Five specialized reviewers examine your code in parallel, then cross-examine each other's findings to filter false positives and surface real issues.

## Features

- **5 specialized reviewers** across 3 model engines (Codex, Gemini, Claude)
- **Adversarial cross-examination** with circuit breaker (max 3 rounds)
- **Structured output** with severity tiers: Bug, Nit, Pre-existing
- **Scope control**: full repo, commit range, or since a specific commit
- **Graceful degradation**: if Codex or Gemini are unavailable, reviewers fall back to Claude
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

- **dispatch** — Shared CLI dispatch infrastructure (not user-invocable). Houses `dispatch.sh`, `scope.sh`, and reviewer prompt templates.

## Usage

### Full Adversarial Review
```
/adv-review
/adv-review --since HEAD~5
/adv-review --commits abc123..def456
```

Output: `.claude/reviews/review-YYYYMMDD-HHMMSS.md`

### Ad-Hoc Model Dispatch
```
/adv-codex "Review this function for edge cases"
/adv-gemini "Explain the architecture of this codebase"
/adv-gemini-research "What are the latest best practices for error handling in TypeScript?"
```

## Review Pipeline

1. **Setup** — Resolve scope, health-check engines, create temp directory
2. **Parallel Review** — 5 specialized reviewers run simultaneously:
   - Quality (Codex): naming, dead code, complexity
   - Implementation (Gemini): logic bugs, correctness, edge cases
   - Testing (Codex): test coverage gaps, untested paths
   - Simplification (Claude): refactoring, over-engineering
   - Documentation (Gemini): missing/stale comments, unclear APIs
3. **Cross-Examination** — 2-3 rounds of adversarial validation (VALIDATE/DISPUTE/AMEND), with early exit on convergence
4. **Synthesis** — Deduplicate, severity-rank, generate fix plan grouped by file

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
