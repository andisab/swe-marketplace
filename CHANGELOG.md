# Changelog

Notable changes to the marketplace and its plugins. Each plugin carries its own version in [`marketplace.json`](./.claude-plugin/marketplace.json); a marketplace release (tagged `vX.Y.Z`, matching the catalog version) groups the plugin versions that shipped together. Claude Code updates an installed plugin when its version changes, so every shipped change to a plugin bumps its version.

## [1.1.0] — unreleased

### Agents in every plugin that has them

arch 1.0.1 · context-engineering 1.1.1 · data 1.0.1 · databases 1.0.1 · dev 1.0.1 · frontend 1.0.1 · genai 1.0.1 · infrastructure 1.0.1 · machine-learning 1.0.1 · product-management 1.0.1

- **Fixed:** 49 of 54 agents listed tools Claude Code doesn't have, so most of them had no Edit tool (only whole-file Write) and none could reach Context7. `MultiEdit` is now `Edit`; `Context7` is `mcp__context7__*` plus the plugin-installed form `mcp__plugin_context7_context7__*`; `LS`, `Find` and `FD` are `Glob`; `Docker` and `Git` are `Bash`; `Task` is `Agent`. `infrastructure:security-auditor` also gains `Read`.
- **context-engineering:** the agent-dev and hook-dev skills and the tool-restriction patterns no longer teach `MultiEdit`, `TodoRead` or `NotebookRead`, so new agents don't inherit the problem.

### adv 0.2.1

- **Fixed:** a failed engine call crashed `dispatch.sh` before it wrote its error marker, because the marker used `ERROR_TYPE` before the script set it. `run-phase.sh` then counted that reviewer as successful, so the Gemini quota retry and the Claude fallback never ran, and the review lost that reviewer's findings.
- **Fixed:** engine calls stop after 300 seconds on macOS too. The limit used to depend on GNU `timeout`, which macOS doesn't ship, so a stuck Codex or Gemini call could hang the review. Without `timeout` or `gtimeout`, a python3 watchdog now stops the engine and every process it started, and the call fails with `error_type: timeout`. Gemini calls made through 1Password's `op run` get the same limit, and `--check-deps` now checks for python3.

### knowledgeware 1.8.1

- **Fixed:** HTML decks' title, section, big-number and quote slides now center vertically as their layouts intend. Reveal's inline `display: block` had overridden the layouts' flexbox since 1.1.0, so every slide sat at the top. The presenter view's previews match.
- **Fixed:** the slide number sits bottom-left, clear of the navigation arrows.
- slideware and brandware stop with the plugin install line when they're copied out of the plugin on their own (as skills directories do), instead of failing on missing styles and scripts.
- The canonical-samples reference maps each sample deck to its closest built-in style; it no longer calls an unshipped brandbook the default.

### research-team 1.2.4

- The coordinator skill stops with the plugin install line when its agents aren't available (installed on its own).
- **Fixed:** the report writer read every note in `research_notes/`, so notes from earlier runs on other topics leaked into new reports. Each run now keeps its notes in a folder of its own, such as `research_notes/vector-database-pricing_20261022/`, and the writer reads only that folder. A second run on the same topic and day gets a `-2` folder and report name.

### Marketplace

- CI runs `claude plugin validate` on the catalog and every plugin on each pull request and push, plus a new agent tool-name check, [`scripts/check-agent-tools.py`](./scripts/check-agent-tools.py) (also part of `validate-all.sh`).
- README: a start-here table, a knowledgeware gallery and a Skills Directory badge; the catalog description now matches what the marketplace holds. The plugin-count badge reads the catalog, so it stays current.
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
