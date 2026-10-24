# CLAUDE.md

Context for Claude working in this repo. User-facing docs live in [README.md](./README.md); per-plugin docs in `plugins/<name>/README.md`; the release history in [CHANGELOG.md](./CHANGELOG.md).

## Status

- 13 plugins, catalog version `1.2.0` (unreleased). Per-plugin versions live in `marketplace.json`: adv 0.4.0, research-team 1.3.0, knowledgeware 1.9.0, context-engineering 1.1.1, the nine agent packs 1.0.1.
- Work happens on `feature/repo-polish` (24 commits ahead of `main`, never pushed). Andis reviews and merges; don't push without him. At the merge, replace `unreleased` in the CHANGELOG heading with the date.
- Everything validates clean with `./scripts/validate-all.sh` except two pre-existing plugin-directory warnings it reports (a stray `.DS_Store` on disk under `plugins/data`, and four under `plugins/knowledgeware`), which make it end with "validation failed" although the tests and manifests pass.
- `core.hooksPath` is unset in this clone, so the pre-commit drift check doesn't run here; enable it with `git config core.hooksPath scripts/git-hooks`.

## Overview

Public Claude Code plugin marketplace: one catalog at `.claude-plugin/marketplace.json` indexing 13 plugins under `plugins/<name>/`. Two core plugins carry scripts and tests (knowledgeware, research-team), two are experimental (adv, context-engineering), the other nine are agent packs. See the README for what each plugin does and how it's installed.

## File structure

```
eza -TL 2 --icons --git-ignore
```

```
.claude-plugin/marketplace.json     # catalog — source of truth for all plugin metadata
plugins/<name>/
  .claude-plugin/plugin.json        # GENERATED from marketplace.json (do not hand-edit)
  agents/                           # YAML-frontmatter markdown
  skills/<skill>/                   # SKILL.md plus scripts, prompts, templates
  commands/                         # markdown
  tests/                            # adv and knowledgeware only
  README.md
scripts/
  synthesize-plugin-manifests.py    # generator (writes; --check fails on drift)
  check-agent-tools.py              # rejects unknown tool names in agent frontmatter
  validate-all.sh                   # drift check, tool-name check, every test, `claude plugin validate` on all
  git-hooks/pre-commit              # drift check on the staged files
.github/workflows/validate-plugins.yml   # CI: the same checks and tests, plus validate-all with a pinned Claude CLI
CHANGELOG.md                        # one section per release, one subsection per plugin version
```

## Configuration

**Dual manifests.** `marketplace.json` is the only file you edit (the directory listing fields `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl` and `termsOfServiceUrl` go under an entry's `metadata.directory`; the generator hoists them into `plugin.json`, where the validator accepts them, and drops `metadata`); `plugins/<name>/.claude-plugin/plugin.json` is generated from it. `plugin.json` = the catalog entry minus `source`, `category` and `strict` (marketplace-only; `claude plugin validate` warns on them in plugin.json). Formats the validator enforces: `agents` as file paths (`./agents/foo.md`), `skills` as directory paths (`./skills/foo`), `commands`/`hooks` as file paths, `repository` a string URL, `author` an object, `dependencies` an array of plugin names.

**Changing a plugin.**
1. Edit the catalog entry (bump its `version`; Claude Code updates an installed plugin only when the version changes).
2. `python scripts/synthesize-plugin-manifests.py` to regenerate plugin.json.
3. `./scripts/validate-all.sh`.
4. Add a `### <plugin> <version>` subsection under the unreleased heading in CHANGELOG.md, and update the version in the README's catalog table.
5. Commit the catalog, the generated plugin.json and the docs together.

**Tests** (all run by validate-all and CI, no network or accounts needed):
- `bash plugins/adv/tests/dispatch-test.sh [bash-binary]` — adv's dispatcher, run-phase and preflight against fake engines; run it with `/bin/bash` too, since stock macOS has bash 3.2.
- `node plugins/knowledgeware/tests/registry-test.js`, `bash plugins/knowledgeware/tests/svg-lint-test.sh`, `bash plugins/knowledgeware/tests/diagram-digest-test.sh`.
- `python3 scripts/check-agent-tools.py` — only reads `tools:` lines, not `allowed-tools:`, so agents using the latter (adv-review, librarian) aren't checked.

**Testing a plugin from this checkout.** The installed plugins come from the GitHub `main` of this repo (cache under `~/.claude/plugins/cache/swe-marketplace/`), so an agent run in a normal session uses the installed version, not the branch. To run branch code: `claude -p --plugin-dir "$PWD/plugins/<name>" --allowedTools "Bash,Read,Write,Glob,Grep,Agent" "<request>"`.

## Implementation notes

- Don't hand-edit `plugins/*/.claude-plugin/plugin.json`; the generator overwrites it. Don't rename or move the catalog; `/plugin marketplace add` looks for `.claude-plugin/marketplace.json` at the repo root.
- `claude plugin validate <dir>` validates `<dir>/.claude-plugin/plugin.json`; pointed at the repo root it validates the marketplace manifest. Every agent file needs YAML frontmatter or the validator warns.
- Every catalog entry sets `strict: true` (marketplace-only; correctly absent from plugin.json).
- adv calls Codex CLI and Gemini CLI and writes reports to `.claude/reviews/` in whatever repo it runs in; that folder is gitignored here. The free-tier Gemini key on this machine can't finish a review (its quota and per-minute token limits), so adv's Gemini reviewers fall back to Claude in local tests; Codex is signed in with an API key.
- knowledgeware resolves brands from `KNOWLEDGEWARE_BRANDS_DIR` (Andis's private brands in ABDotfiles) before its own `styles/`; only the five generic styles and the fictional `acmecorp` ship here, enforced by `.gitignore`.
- Restart Claude Code (or `/reload-plugins`) after installing or updating a plugin.
