# CLAUDE.md

Context for Claude working in this repo. User-facing docs live in [README.md](./README.md); per-plugin docs in `plugins/<name>/README.md`; the release history in [CHANGELOG.md](./CHANGELOG.md).

## Status

- 11 plugins. The last tagged catalog release is `v1.2.0` (`metadata.version` in `marketplace.json`); CHANGELOG's `[1.3.0] — unreleased` section collects what has merged since. Per-plugin versions live in `marketplace.json`: adv 0.4.0, research-team 1.3.0, knowledgeware 1.13.0, context-engineering 1.1.1, the seven agent packs 1.0.2.
- Work happens on short-lived branches off `main`, one PR each (#13–#20 so far; #20, slideware v2 with the tooling pass, is open). Andis reviews and merges, with `--admin` when branch protection asks for a review; don't push to `main`. Open each PR against `main`, not a stacked branch. At a catalog release, set `metadata.version`, replace `unreleased` in the CHANGELOG heading with the date, and tag `vX.Y.Z`.
- `./scripts/validate-all.sh` passes clean. It unsets `NODE_OPTIONS` (cmux preloads a module that breaks every node call) and deletes untracked `.DS_Store` files under `plugins/`, which `claude plugin validate` would otherwise warn on.
- `core.hooksPath` is unset in this clone, so the pre-commit check doesn't run here; enable it with `git config core.hooksPath scripts/git-hooks`.
- Shelved: the agent pack refactor, planned below under §Shelved plan. Pick it up from there.
- Todo: build out slideware's slide pattern catalogue (`plugins/knowledgeware/skills/slideware/html/catalog/`, 14 patterns plus core as of 2026-11-04). Candidates: the AI-SDLC workshop deck (`~/Documents/Knowledgebases/AI-SDLC-Advanced-Workshop.html`: cycle diagram, staircase, decision matrix with dot ratings, layered checks, fan-out, glossary, code with notes) and further generic layouts from decks as they're built. One file per pattern, written to `catalog/README.md` §Writing a pattern and checked with `cli.js gallery` in two brands. Andis curates the catalogue: propose candidates, don't add them unasked.

## Overview

Public Claude Code plugin marketplace: one catalog at `.claude-plugin/marketplace.json` indexing 11 plugins under `plugins/<name>/`. Two core plugins carry scripts and tests (knowledgeware, research-team), two are experimental (adv, context-engineering), the other seven are agent packs. See the README for what each plugin does and how it's installed.

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
  check-readme-catalog.py           # README catalog tables vs marketplace.json (names and versions)
  check-agent-tools.py              # agent tool grants: a tools line, real tool names, declared MCP servers
  tests/                            # unittest suite for the three scripts above
  validate-all.sh                   # every check below, shellcheck, ruff, every test, `claude plugin validate` on all
  cut-release.sh                    # fast-forwards release/<plugin> for the directory
  git-hooks/pre-commit              # drift and README checks on the staged files
ruff.toml                           # ruff: correctness rules only (pyflakes, pycodestyle errors, bugbear)
.github/workflows/validate-plugins.yml   # CI: the same checks and tests, plus validate-all with a pinned Claude CLI
CHANGELOG.md                        # one section per release, one subsection per plugin version
```

## Configuration

**Dual manifests.** `marketplace.json` is the only file you edit (the directory listing fields `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl` and `termsOfServiceUrl` go under an entry's `metadata.directory`; the generator hoists them into `plugin.json`, where the validator accepts them, and drops `metadata`); `plugins/<name>/.claude-plugin/plugin.json` is generated from it. `plugin.json` = the catalog entry minus `source`, `category` and `strict` (marketplace-only; `claude plugin validate` warns on them in plugin.json). Formats the validator enforces: `agents` as file paths (`./agents/foo.md`), `skills` as directory paths (`./skills/foo`), `commands`/`hooks` as file paths, `repository` a string URL, `author` an object, `dependencies` an array of plugin names.

**Changing a plugin.**
1. Edit the catalog entry (bump its `version`; Claude Code updates an installed plugin only when the version changes).
2. `python scripts/synthesize-plugin-manifests.py` to regenerate plugin.json.
3. `./scripts/validate-all.sh`.
4. Add a `### <plugin> <version>` subsection under the unreleased heading in CHANGELOG.md, and update the version in the README's catalog table (`check-readme-catalog.py` fails until you do).
5. Commit the catalog, the generated plugin.json and the docs together.

**Tests** (all run by validate-all and CI, no network or accounts needed):
- `bash plugins/adv/tests/dispatch-test.sh [bash-binary]` — adv's dispatcher, run-phase and preflight against fake engines; run it with `/bin/bash` too, since stock macOS has bash 3.2.
- `node plugins/knowledgeware/tests/registry-test.js`, `bash plugins/knowledgeware/tests/svg-lint-test.sh`, `bash plugins/knowledgeware/tests/diagram-digest-test.sh`, `node plugins/knowledgeware/tests/slideware-engine-test.js` (the HTML deck engine without a browser: regions, new and refresh, lanes, check, the PowerPoint zip).
- `python3 scripts/check-agent-tools.py` — reads `tools:` and `allowed-tools:`. Every agent needs one; built-in names must be real; an `mcp__<server>__` name must be a server the agent's own plugin declares in `mcpServers` (bare or as `plugin_<plugin>_<server>`), or one in its `OPTIONAL_MCP_SERVERS` (only `conventions` today, for context-engineer).
- `python3 scripts/check-readme-catalog.py` — every catalog plugin appears once in the README's catalog tables at its catalog version, and nothing else does.
- `python3 -m unittest discover -s scripts/tests` — the generator and both checks, each copied into a fixture repository and run there, so a test never reads or writes this checkout.
- Lint: `shellcheck -S warning` on every tracked shell script and the git hook, `ruff check .` with `ruff.toml` (templates under context-engineering are excluded; they hold `{placeholder}` names). Both run in CI; validate-all skips a linter that isn't installed, with a note.

**Cutting a directory release.** Anthropic's plugin directory follows one git ref per submitted plugin, and each submitted plugin tracks `release/<plugin>` (knowledgeware since 2026-10-26), so work on `main` never reaches the directory on its own. To release, bump the plugin's version on `main` as usual, then run `scripts/cut-release.sh <plugin>` (`--dry-run` to preview). It fast-forwards `origin/release/<plugin>` to `origin/main`, refusing when the version on `main` isn't higher than the released one or the branch isn't an ancestor of `main`. The directory scans the new commit on its next check, or at once with the push webhook. Release branches are unprotected on purpose; nothing else pushes to them. GitHub marketplace installs keep tracking `main`, so those users get every bump and directory users get the cuts. The tracked branch is edited on the plugin's Settings tab in claude.ai/directory/manage, except while a version is with a reviewer.

**Testing a plugin from this checkout.** The installed plugins come from the GitHub `main` of this repo (cache under `~/.claude/plugins/cache/swe-marketplace/`), so an agent run in a normal session uses the installed version, not the branch. To run branch code: `claude -p --plugin-dir "$PWD/plugins/<name>" --allowedTools "Bash,Read,Write,Glob,Grep,Agent" "<request>"`.

## Implementation notes

- Don't hand-edit `plugins/*/.claude-plugin/plugin.json`; the generator overwrites it. Don't rename or move the catalog; `/plugin marketplace add` looks for `.claude-plugin/marketplace.json` at the repo root.
- `claude plugin validate <dir>` validates `<dir>/.claude-plugin/plugin.json`; pointed at the repo root it validates the marketplace manifest. Every agent file needs YAML frontmatter or the validator warns.
- Every catalog entry sets `strict: true` (marketplace-only; correctly absent from plugin.json).
- adv calls Codex CLI and Gemini CLI and writes reports to `.claude/reviews/` in whatever repo it runs in; that folder is gitignored here. The free-tier Gemini key on this machine can't finish a review (its quota and per-minute token limits), so adv's Gemini reviewers fall back to Claude in local tests; Codex is signed in with an API key.
- knowledgeware keeps a user's own resources in the knowledgeware home (`scripts/home.js`: `$KNOWLEDGEWARE_HOME`, default `~/.claude/knowledgeware`, with `brands/` and `slideware/catalog/`). Brands resolve from `KNOWLEDGEWARE_BRANDS_DIR` when set (Andis's private brands in ABDotfiles), else the home's `brands/`, before the plugin's own `styles/`; the plugin's slide pattern catalogue is `skills/slideware/html/catalog/`, which Andis curates (Claude asks before adding to it); only the five generic styles and the fictional `acmecorp` ship here, enforced by `.gitignore`.
- Restart Claude Code (or `/reload-plugins`) after installing or updating a plugin.
- **Where a shared contract lives (knowledgeware).** The skill that defines an artifact owns its contract: brandware owns the brandbook (definition, token schema, assets); knowledgebase owns the maintenance spec, for sites and for decks' spec pages. Mechanics live next to the code that implements them (a format's token mapping in that format's guide, a builder's fields in its reference). Every other file keeps one sentence and a link. When a feature touches several skills, write it once in the owner's file and link from the rest; the review-mode PR described one feature in five places, which is what this rule prevents.

## Shelved plan: agent pack refactor

Planned 2026-11-03, not started. The agent packs are uneven. Measured over the 53 agents that day (arch's two have since been removed):

| Band | Agents | Problem |
|---|---|---|
| Under 100 lines | 16: ten in dev, all three in machine-learning, fe-html and others | Generic checklists the model already follows. Eight have a one-line description with no triggers or examples. |
| 100 to 1,000 lines | 30 | Mostly usable; descriptions and examples are uneven. |
| Over 1,000 lines | 7: five in data, fe-css, infra-docker-engineer | Reference manuals, loaded into the system prompt of every delegation. |

**Target shape for an agent.**
- Description: one sentence of scope, "Use when…" triggers, and two or three `<example>` blocks, one of them a near miss that should not delegate. Delegation reads only this.
- Body of 150 to 400 lines holding what the base model gets wrong or does inconsistently: current versions, decision rules, house conventions, an output contract, what not to do. Generic advice goes.
- Reference material moves to a skill in the same plugin (`skills/<topic>/references/`, read on demand), or is cut where it restates public docs.
- Tools stay least-privilege (`check-agent-tools.py` enforces the grant); model stays `sonnet` unless there's a reason.

**Steps, one PR per pack, each pack to its next minor version.**
1. Checks first: a shape check (description with examples; body between 100 and 400 lines) as warnings, turned into failures once every pack passes.
2. Settle overlaps before rewriting: javascript, typescript and nodejs in dev; sql, postgres and mariadb in databases; d3 and highcharts in data.
3. The seven heavy agents: split core from reference.
4. The sixteen thin agents: rewrite with domain decision rules and examples, or remove the ones that add nothing over the base model.
5. The middle band: descriptions, examples, trims.
6. Verify delegation per agent: two or three prompts that should delegate and one or two near misses that shouldn't, run with `claude -p --plugin-dir`, or as an evalkit suite; record the results in the PR.

Pack order: data, dev, frontend, infrastructure, databases, machine-learning, product-management.

**Open decisions for Andis:** which overlapping agents merge or go; whether reference material moves into skills or is cut; the bar a thin agent must clear to stay.
