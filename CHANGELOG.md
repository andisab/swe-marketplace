# Changelog

Notable changes to the marketplace and its plugins. Each plugin carries its own version in [`marketplace.json`](./.claude-plugin/marketplace.json); a marketplace release (tagged `vX.Y.Z`, matching the catalog version) groups the plugin versions that shipped together. Claude Code updates an installed plugin when its version changes, so every shipped change to a plugin bumps its version.

## [1.1.0] — unreleased

### Agents in every plugin that has them

arch 1.0.1 · context-engineering 1.1.1 · data 1.0.1 · databases 1.0.1 · dev 1.0.1 · frontend 1.0.1 · genai 1.0.1 · infrastructure 1.0.1 · machine-learning 1.0.1 · product-management 1.0.1

- **Fixed:** 49 of 54 agents listed tools Claude Code doesn't have, so most of them had no Edit tool (only whole-file Write) and none could reach Context7. `MultiEdit` is now `Edit`; `Context7` is `mcp__context7__*` plus the plugin-installed form `mcp__plugin_context7_context7__*`; `LS`, `Find` and `FD` are `Glob`; `Docker` and `Git` are `Bash`; `Task` is `Agent`. `infrastructure:security-auditor` also gains `Read`.
- **context-engineering:** the agent-dev and hook-dev skills and the tool-restriction patterns no longer teach `MultiEdit`, `TodoRead` or `NotebookRead`, so new agents don't inherit the problem.
- **context-engineering:** the context-engineer agent and four skills couldn't reach conventions-mcp. They called `search_conventions` and `get_convention`, which conventions-mcp 1.1.1 renamed to `find_conventions` and `read_convention`, and they expected the server name `Conventions`, while conventions-mcp's README registers it as `conventions`. Both now match conventions-mcp 1.1.2, and the README gives the `claude mcp add` line.

### adv 0.3.0

Tested against Codex CLI 0.163.0 and Gemini CLI 0.65.0 (October 2026). Both CLIs changed enough since adv 0.2.0 that every engine call had been failing.

- **Fixed:** Codex calls failed on `--full-auto`, which Codex CLI 0.163 removed; the read-only sandbox doesn't need approvals, so the flag is gone. Gemini calls failed on the trusted-folder check that Gemini CLI 0.65 applies to headless runs; adv now passes `--skip-trust`. Gemini's `--sandbox` is no longer passed either, because in 0.65 on macOS it broke the CLI's API calls and every call spent 70 seconds retrying; `--approval-mode plan` keeps Gemini read-only.
- **Fixed:** adv no longer names models. `gemini-2.5-pro` (the default) and `gemini-2.0-flash` (the quota fallback) were both retired in 2026 and returned 404. Each CLI now uses its own current default (`gpt-6.1-sol` and Gemini's auto mode at the time of testing); `ADV_CODEX_MODEL`, `ADV_GEMINI_MODEL`, `ADV_CLAUDE_MODEL` and `ADV_GEMINI_FALLBACK_MODEL` (default `gemini-3-flash-preview`) override them. A model that doesn't exist or isn't on your plan is reported as `model_not_found` (exit 6) and triggers the same fallback as a quota failure.
- **Fixed:** a failed engine call crashed `dispatch.sh` before it wrote its error marker, because the marker used `ERROR_TYPE` before the script set it. `run-phase.sh` then counted that reviewer as successful, so the Gemini quota retry and the Claude fallback never ran, and the review lost that reviewer's findings.
- **Fixed:** engine calls stop after 300 seconds on macOS too. The limit used to depend on GNU `timeout`, which macOS doesn't ship, so a stuck Codex or Gemini call could hang the review. Without `timeout` or `gtimeout`, a python3 watchdog now stops the engine and every process it started, and the call fails with `error_type: timeout`. Gemini calls made through 1Password's `op run` get the same limit, and `--check-deps` now checks for python3.
- **Fixed:** each engine call logs to its own file before it's folded into `dispatch.log`, so parallel reviewers can't have another engine's error attributed to them. The 1Password path no longer needs bash 4.4 (stock macOS has 3.2), and an `op` failure to supply the key is reported as `auth`.
- The Gemini health check first sends one request through the REST API, because Gemini CLI answers an exhausted quota by retrying and switching models in silence, which looked like a hung engine. The probe reports quota (429), a bad key or a missing model in about a second, and the review falls back to Claude at once instead of after a 300-second timeout per call.
- `--check-deps` prints each CLI's version, notes when one is older than the tested version, and reports `BROKEN` when a CLI is on `PATH` but can't run. The health check allows 60 seconds instead of 30, since Gemini's first run of a session took about 40.
- `plugins/adv/tests/dispatch-test.sh` runs `dispatch.sh` against fake engines (success, auth, quota, hang, model not found) on any bash; `validate-all.sh` and CI run it.

### knowledgeware 1.9.0

- **One folder per style or brand.** Every registry entry is now `<name>/brand.md` with `tokens.json`, `assets/`, an optional `css/` and `starters/`, and a README beside it, the same shape for the five default styles, for `styles/brands/` and for `$KNOWLEDGEWARE_BRANDS_DIR`. The older flat layout (`<name>.md`, `tokens/<name>.json`, `<name>/assets/`) is still read, and a folder wins over a flat file of the same name, so installed brands keep working. A new `scripts/registry.js` holds the search order and both layouts; `load-style.js`, `list-styles.js` and the slideware html converter go through it, and the token cache is rebuilt next to `brand.md` after a miss instead of only being read.
- **The five default styles gain assets.** Each has an original mark for light and dark backgrounds (`assets/mark.svg`, `assets/mark-dark.svg`), a stylesheet with the tokens as CSS variables, base typography and the style's motif classes (`css/<name>.css`, with the dark palette under `prefers-color-scheme` and `data-theme`), a YAML precision layer in `brand.md`, and a README. The four light styles gain a designed dark palette, and dark-first style-3 gains a light one (`paletteLight`, the mirror of `paletteDark`).
- **Brandbook spec:** optional `paletteDark` and `paletteLight`, `type.headingTracking`, `type.labelTracking`, `layout.containerPx` and `layout.gutterPx`. Loaders pass them through, and the html converter writes `paletteDark` into the frontmatter it generates.
- **Per-project brand:** a `.knowledgeware` file (one line naming a registry entry) in a project or any parent directory is checked before the `DEFAULT` markers, so a repository can pin its brand.
- **chartware:** a geometry lint for SVG, `skills/chartware/scripts/svg-lint.py`, with no dependencies. It reports diagonal edge segments, stacked edges, shared attach points, edges through or too close to nodes, crossings over budget, labels on lines or off their node's centre, anything outside the viewBox or inside the padding, fonts under 10, `<tspan>` without `x`, missing markers, duplicate ids, selectors not namespaced under the root class, the root's accessibility wiring, and the complexity budget. SKILL.md gains that budget (9 nodes, 12 edges, 2 accent roles, 2 crossings; 5 lifelines or lanes), a lint step before the screenshot loop, and a pre-delivery checklist. `tests/svg-lint-test.sh` checks every template passes and a broken diagram trips each rule.
- **chartware:** four more SVG chart templates, each lint-clean and rendered in light and dark: `waterfall.svg` (a bridge with a written conservation check), `heatmap.svg` (five discrete buckets as opacity steps of one hue, outlined cells for missing data), `slopegraph.svg` (two periods with direct labels and collision nudging) and `dumbbell.svg` (before and after per row). `svg-charts.md` §3 has the rules for each. Two more follow the same conventions: `gantt.svg` (phases, pill bars by status, a milestone diamond, a dashed today line) and `sankey.svg` (two node columns with flat-tangent ribbons that stack without crossing inside a node, conservation in the data).
- **chartware:** size presets for charts that leave the page (document, HTML slide 1280×720, PowerPoint 960×540, 4:3, social card, print), each with its font floor, margins and export rule, in `svg-charts.md` §1.
- **chartware:** an icon sprite, `templates/svg/icons.svg`, with 96 `currentColor` symbols on a 24-unit grid: 63 outline icons from Tabler Icons 3.49.0 (MIT) and 33 brand marks from Simple Icons 16.35.0 (CC0). `scripts/build-icons.py` regenerates it from the npm packages, `references/icons.md` lists the symbols and the `<defs>` + `<use>` pattern, and the lint reports a `<use>` that names a symbol the file doesn't define.
- **chartware:** import and redraw. `scripts/diagram-digest.py extract` turns a draw.io file (plain or compressed), a Mermaid flowchart, an Excalidraw scene or a chartware SVG into a digest of nodes, edges, groups and labels; `ledger` compares an original with its redraw and lists every node as kept, renamed, merged, dropped or added, and every edge as kept, relabelled, dropped or added. SKILL.md gains the contract: extract, decide format/size/detail/audience, redraw from the template, deliver the ledger with a reason per drop. `tests/diagram-digest-test.sh` covers the four formats and the ledger.
- `plugins/knowledgeware/tests/registry-test.js` covers both layouts, shadowing, cache paths, markers and the loaders; `validate-all.sh` and CI run it.

- **Fixed:** HTML decks' title, section, big-number and quote slides now center vertically as their layouts intend. Reveal's inline `display: block` had overridden the layouts' flexbox since 1.1.0, so every slide sat at the top. The presenter view's previews match.
- **Fixed:** the slide number sits bottom-left, clear of the navigation arrows.
- slideware and brandware stop with the plugin install line when they're copied out of the plugin on their own (as skills directories do), instead of failing on missing styles and scripts.
- The canonical-samples reference maps each sample deck to its closest built-in style; it no longer calls an unshipped brandbook the default.

### research-team 1.3.0

- The `joplin-research` skill is replaced by `report-formats`. The old skill held one person's Joplin stylesheet rules (548 lines) and loaded for any request mentioning a "summary" or "research document", whether or not Joplin was involved. The new skill writes plain Markdown by default, which renders the same in VS Code, Cursor and GitHub, and applies an Obsidian profile (properties block, callouts) or a Joplin profile (`>[toc]`) when the request names the editor. A Joplin skill the user installs in `~/.claude/skills/` takes precedence.
- Six report types with section lists: technical survey, technical rundown, decision brief, landscape scan, what's new, and source summary (article, paper, whitepaper or book). The writer picks the type from the findings, or the one the request asks for.
- A folder named in the request ("save it in ~/Obsidian/Research") replaces `~/Documents/Claude/Research` as the base for that run's notes and report.

- The coordinator skill stops with the plugin install line when its agents aren't available (installed on its own).
- **Fixed:** the report writer read every note in `research_notes/`, so notes from earlier runs on other topics leaked into new reports. Each run now keeps its notes in a folder of its own, such as `research_notes/vector-database-pricing_20261022/`, and the writer reads only that folder. A second run on the same topic and day gets a `-2` folder and report name.

### Marketplace

- CI runs `claude plugin validate` on the catalog and every plugin on each pull request and push, plus a new agent tool-name check, [`scripts/check-agent-tools.py`](./scripts/check-agent-tools.py) (also part of `validate-all.sh`).
- README: a start-here table, a knowledgeware gallery (five images: decks in three styles, the presenter view, two knowledge-base pages, the five styles light and dark, eight charts and a diagram in the Warm Sage style, all rendered by the plugins and screenshotted; sources in `docs/gallery/`); the catalog is grouped into core plugins, experimental plugins and agent packs, and the list of other marketplaces is replaced by one FAQ answer pointing at `claude-plugins-official` and a Skills Directory badge; the catalog description now matches what the marketplace holds. The plugin-count badge reads the catalog, so it stays current.
- Every README rewritten for first-time users: a step-by-step first install with what you should see, a FAQ (cost, what runs on your machine and what leaves it, context cost, updates, agents vs asking Claude), troubleshooting, and in each plugin README examples with where the output lands, plus that plugin's own questions. Claims the plugins don't back up are gone, such as context-engineering's settings options, which nothing reads, research-team's unmeasured speedups, and adv's `/adv-review` command, which doesn't exist (adv-review is an agent).

## [1.0.0] — 2026-10-21

### knowledgeware 1.8.0

- **slideware (HTML):** a presenter view replacing Reveal's speaker window: previous, current and next slides with draggable borders and show/hide toggles, formatted notes, session pacing editable in the header, and hidden slides left out of the pace plan. Reveal.js is inlined, so decks run offline. Entrance motion, on by default.
- **slideware (PowerPoint):** speaker notes open with a cue line holding each slide's planned time window; hidden slides; one shared notes, pacing and hidden-slide contract for both formats.
- **librarian** agent replaces kb-maintainer: `status`, `plan` and `sweep` across a library of sites and decks. `/knowledgeware:kb-maintain` stays as a deprecated alias for `librarian sweep`.
- **knowledgebase:** the link check covers numbered page names, anchors and local files; the table of contents no longer contains link-like text that tripped anchor checks; font variables for headings, body and code.

### Marketplace

- Install guide for Claude Code, Claude Desktop, claude.ai and the Agent SDK; the full catalog of skills, commands and agents; a README and icon for every plugin.
- An opt-in pre-commit hook that checks generated manifests against the catalog.

## Before 1.0.0

Condensed from the git history; these versions weren't tagged.

- **knowledgeware 1.0.0 → 1.7.2** (2026-07-28 → 2026-08-18): four skills: slideware (PowerPoint and HTML, unified in 1.1.0), knowledgebase (renamed from study-guide in 1.2.0), chartware (Mermaid, SVG and draw.io, with the bundled draw.io MCP server) and brandware; the `DEFAULT` brand marker and a user-owned brands directory (`KNOWLEDGEWARE_BRANDS_DIR`); a two-layer brandbook spec; the maintenance contract, the kb-maintainer agent and deck provenance.
- **adv 0.1.0 → 0.2.0** (2026-03-24 → 2026-03-26): adversarial multi-model code review across Claude, Codex CLI and Gemini CLI; preflight checks, run phases and smart scope.
- **research-team 1.0.0 → 1.2.3** (2025-11-19 → 2026-05-20): parallel researchers with verified output manifests; the coordinator moved from an agent to a main-thread skill so it can spawn subagents; retries for killed researchers; output under `~/Documents/Claude/Research`.
- **context-engineering 1.0.0 → 1.1.0** (2025-11-19 → 2026-04-22): skills for agents, commands, hooks, plugins and skills, renamed to `*-dev`; MCP tool and server skills; alignment with Anthropic's skills guide and plugin docs.
- **dev, frontend, infrastructure, databases, data, machine-learning, genai, product-management, arch 1.0.0** (2025-11-20): specialist agents by domain.
- **Marketplace** (2026-05-05): per-plugin `plugin.json` files generated from the catalog, so SDK loaders and `--plugin-dir` register every component; a CI drift check.
