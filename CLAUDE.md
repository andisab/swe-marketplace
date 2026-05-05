# CLAUDE.md

Context for Claude working in this repo. User-facing docs live in [README.md](./README.md).

## What this repo is

Public Claude Code plugin marketplace. 12 plugins under `plugins/<name>/`, indexed by a single catalog at `.claude-plugin/marketplace.json`.

## Repo layout

```
.claude-plugin/marketplace.json   # catalog — source of truth for all plugin metadata
plugins/<name>/
  .claude-plugin/plugin.json      # GENERATED from marketplace.json (do not hand-edit)
  agents/                         # YAML-frontmatter markdown
  skills/                         # subdirs, each a skill
  commands/                       # markdown
  README.md
scripts/
  synthesize-plugin-manifests.py  # generator (writes; --check fails on drift)
  validate-all.sh                 # runs `claude plugin validate` on catalog + every plugin
.github/workflows/validate-plugins.yml  # CI drift guard
```

Tree command: `eza -TL 2 --icons --git-ignore`

## Dual-manifest convention (added in commit a673778, 2026-05-04)

Two manifests ship together:

- **`.claude-plugin/marketplace.json`** — catalog used by `/plugin marketplace add` + `/plugin install`. Source of truth.
- **`plugins/<name>/.claude-plugin/plugin.json`** — per-plugin manifest. Required by SDK consumers that load plugins directly via `ClaudeAgentOptions.plugins=[{"type":"local","path":...}]` / CLI `--plugin-dir`. Without it, those consumers silently fail to register skills/commands/hooks.

The two are kept in sync by a generator. **Marketplace.json is the only file you edit.**

### Field rules (enforced by the generator)

`plugin.json` = the matching `marketplace.json` entry **minus** `source`, `category`, `strict` (those are marketplace-only; `claude plugin validate` warns on them in plugin.json).

Verbatim from marketplace entry: `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `agents`, `skills`, `commands`, `hooks`, `mcp`, `dependencies`.

Required formats (per `claude plugin validate`):
- `agents`: file paths — `["./agents/foo.md"]`, **not** parent dirs.
- `skills`: subdir paths — `["./skills/coordinator"]`.
- `commands` / `hooks`: file paths.
- `repository`: string URL, not `{type, url}`.
- `author`: object `{name, email?, url?}`, not bare string.
- `dependencies`: array of plugin names, not version-pinned object map.

## Common workflows

### Adding or editing a plugin

1. Edit the entry in `.claude-plugin/marketplace.json`.
2. Run `python scripts/synthesize-plugin-manifests.py` to regenerate the per-plugin `plugin.json`.
3. Run `./scripts/validate-all.sh` to check the catalog and every plugin with the Claude CLI.
4. Commit both `marketplace.json` and the regenerated `plugin.json`.

### Verifying sync (what CI does)

```bash
python scripts/synthesize-plugin-manifests.py --check
```

Exits non-zero if any `plugin.json` is missing or drifted from `marketplace.json`. Pure Python — runs on any GitHub runner. Fix by running the generator without `--check`.

### Full validation (run locally before merging)

```bash
./scripts/validate-all.sh
```

Runs `claude plugin validate` on the catalog and every `plugins/<name>/`. Fails on any error or warning. Requires the `claude` CLI on PATH (not preinstalled on stock GitHub runners — the CI workflow runs it conditionally).

## When NOT to touch what

- **Don't hand-edit** `plugins/*/.claude-plugin/plugin.json` — the next generator run will overwrite it. Edit `marketplace.json` instead.
- **Don't add** `source` / `category` / `strict` to `plugin.json` manually — the generator strips them.
- **Don't change** the catalog filename or location — `/plugin marketplace add` looks for `.claude-plugin/marketplace.json` at the repo root.

## Gotchas

- `adv` is the only plugin with `strict: true` in the catalog. That's a marketplace-only flag and is correctly absent from `plugin.json`.
- `claude plugin validate <dir>` validates `<dir>/.claude-plugin/plugin.json`. Pointing it at the repo root validates the marketplace manifest instead.
- Every agent file needs YAML frontmatter; otherwise the validator emits a per-agent warning. Existing agents already comply.
- Restart Claude Code after installing or updating a plugin.

## Status

- 12 plugins, all validating clean (no errors, no warnings) as of 2026-05-04.
- Catalog version `1.0.0`. Per-plugin versions in `marketplace.json`.
- CI workflow `validate-plugins.yml` runs the drift check on PRs touching `marketplace.json`, `plugins/**`, or the scripts.
