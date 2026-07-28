# SWE Marketplace

> A curated [Claude Code](https://claude.com/claude-code) plugin marketplace for practical, everyday usage in software engineering — 13 plugins, 53 specialist agents, 15 skills, 3 commands. A few opinionated choices that set it apart from larger awesome-style lists:

- **Curated, not exhaustive.** Every plugin and agent is one I actually use. No vendored grab-bags, no auto-generated stubs of skills the model already has. 
- **SDK-loadable.** Every plugin ships both the catalog entry *and* a per-plugin `plugin.json`, so consumers using the Claude Agent SDK (`ClaudeAgentOptions.plugins=[{"type":"local","path":...}]` or `--plugin-dir`) can load them directly. Many marketplaces only ship the catalog and silently fail to register skills/commands/hooks when loaded that way.
- **CI-guarded drift.** A GitHub Action validates manifest sync on every PR.
- **Zero-warning validation.** Every plugin passes `claude plugin validate` with no errors or warnings. 
= **Most skills & plugins have been run through exhaustive evals.** I am an avid fan of skill-creator and have a custom-build eval harness for building and evaluating plugins. Many of the resources here are fruit borne from that work. 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Validate plugin manifests](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml)
[![Plugins](https://img.shields.io/badge/plugins-13-blue.svg)](./.claude-plugin/marketplace.json)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8A2BE2.svg)](https://docs.claude.com/en/docs/claude-code/plugins)

## Quick start

```bash
# In Claude Code
/plugin marketplace add https://github.com/andisab/swe-marketplace.git
/plugin install context-engineering@swe-marketplace
# Restart Claude Code, then verify with /help or /agents
```

Browse the full catalog with `/plugin marketplace list`. Every plugin is `claude plugin validate`-clean and version-pinned in [`marketplace.json`](./.claude-plugin/marketplace.json).

## What's inside

### `adv` — Adversarial multi-model code review *(v0.2.0)*

Cross-examines code changes using Claude, Codex CLI, and Gemini CLI together. One agent orchestrates 5 specialized reviewers; three commands let you talk to each model directly.

- **Agent:** `adv-review`
- **Skill:** `dispatch` *(shared multi-model CLI infrastructure)*
- **Commands:** `/adv-codex`, `/adv-gemini`, `/adv-gemini-research`

### `context-engineering` — The plugin you use to build other plugins *(v1.1.0)*

End-to-end toolkit for authoring Claude Code resources following Anthropic specs. Templates, examples, and discovery-optimized patterns for every component type.

- **Agent:** `context-engineer`
- **Skills:** `agent-dev`, `skill-dev`, `command-dev`, `hook-dev`, `plugin-dev`, `mcp-tool-dev`, `mcp-server-dev`

### `research-team` — Multi-agent research orchestration *(v1.2.3)*

A `coordinator` skill decomposes a topic into subtopics, spawns parallel `research-specialist` subagents, then hands off to a `research-report-writer` for synthesis. Joplin output supported.

- **Agents:** `research-specialist`, `research-report-writer`
- **Skills:** `coordinator`, `joplin-research`

### `knowledgeware` — Style-driven deliverable suite *(v1.0.0)*

Five skills that share one brandbook format and a central style registry: `slideware` (PowerPoint via pptxgenjs), `slideware-revealjs` (HTML decks via Reveal.js), `study-guide` (multi-page HTML knowledge bases), `chartware` (draw.io architecture diagrams), and `brandware` (registry manager — import, website derivation, logo-asset gathering, chart-styling guidelines). Ships 5 generic styles; brand-specific brandbooks live in a private overlay (`styles/brands/`, gitignored) so proprietary identities never enter the public repo.

- **Skills:** `slideware`, `slideware-revealjs`, `study-guide`, `chartware`, `brandware`

### `dev` — 13 language experts *(v1.0.0)*

| Agent | Focus |
|---|---|
| `dev-python-expert` | Python (general) |
| `dev-fastapi-architect` | FastAPI / async API design |
| `dev-typescript-expert` | TypeScript |
| `dev-javascript-expert` | JavaScript |
| `dev-nodejs-expert` | Node.js |
| `dev-go-expert` | Go |
| `dev-rust-expert` | Rust |
| `dev-cpp-expert` | C++ |
| `dev-kotlin-expert` | Kotlin |
| `dev-php-expert` | PHP |
| `dev-lua-expert` | Lua |
| `dev-perl-expert` | Perl |
| `dev-refactor-agent` | Cross-language refactoring |

### `frontend` — UI and design specialists *(v1.0.0)*

- `fe-react-expert`, `fe-vue-expert`, `fe-nextjs-expert`
- `fe-html-expert`, `fe-css-expert`
- `fe-frontend-designer` *(design systems, UX)*

### `infrastructure` — DevOps, cloud, and platform *(v1.0.0)*

- **Cloud:** `infra-aws-architect`, `infra-gcp-architect`
- **Containers:** `infra-docker-engineer`, `infra-k8s-engineer`
- **IaC:** `infra-terraform-engineer`
- **CI/CD:** `infra-github-actions-expert`, `infra-gitlab-ci-expert`
- **Security:** `infra-security-auditor`

### `databases` — SQL, NoSQL, graph, and vector *(v1.0.0)*

`db-postgres-expert`, `db-mongodb-expert`, `db-neo4j-expert`, `db-cassandra-expert`, `db-mariadb-expert`, `db-sql-expert`, `db-vector-expert`

### `data` — Data science and data engineering *(v1.0.0)*

- **Visualization:** `data-d3-expert`, `data-highcharts-expert`
- **Notebooks:** `data-jupyter-expert`, `data-google-colab-expert`
- **Languages:** `data-r-expert`, `data-python-data-engineer`

### `machine-learning` — ML framework specialists *(v1.0.0)*

`ml-pytorch-expert`, `ml-tensorflow-expert`, `ml-scikit-learn-expert`

### `genai` — Generative AI development *(v1.0.0)*

`genai-langchain-expert` — chains, agents, retrieval workflows. More frameworks on the way.

### `product-management` — PRDs, content, planning *(v1.0.0)*

`pm-prd-writer`, `pm-content-writer`, `pm-project-planner`

### `arch` — System and build orchestration *(v1.0.0)*

`arch-context-agent` *(context management for large codebases)*, `build-orchestrator` *(multi-agent build coordination)*

## Plugin manifests

Two manifests ship together:

- **`.claude-plugin/marketplace.json`** (repo root) — catalog used by `/plugin marketplace add` and `/plugin install`. **Source of truth.**
- **`plugins/<name>/.claude-plugin/plugin.json`** — per-plugin manifest used by SDK consumers loading plugins directly. **Generated** from the matching `marketplace.json` entry.

```bash
python scripts/synthesize-plugin-manifests.py          # regenerate
python scripts/synthesize-plugin-manifests.py --check  # drift check (CI runs this)
./scripts/validate-all.sh                              # full validation
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contribution workflow.

## Other marketplaces worth checking out

| Repository | Stars | Description |
|---|---|---|
| [claudemarketplaces.com](https://claudemarketplaces.com/) | ⭐ 20 | Indexes marketplaces. Thank you, Mert! ([Substack](https://mertbuilds.substack.com/), [Github](https://github.com/mertbuilds)) |
| [wshobson/agents](https://github.com/wshobson/agents) | ⭐ 21,030 | **Arguably the OG.** 185 agents, 16 orchestrators, 153 skills, 100 commands in 80 plugins. Thank you, Seth! |
| [EveryInc/every-marketplace](https://github.com/EveryInc/every-marketplace) | ⭐ 725 | Official Every-Env plugin marketplace. |
| [jeremylongshore/claude-code-plugins-plus](https://github.com/jeremylongshore/claude-code-plugins-plus) | ⭐ 468 | 243 plugins, first 100% compliant with the Anthropic 2025 Skills schema. |
| [ananddtyagi/claude-code-marketplace](https://github.com/ananddtyagi/claude-code-marketplace) | ⭐ 174 | Community-driven marketplace. |
| [Dev-GOM/claude-code-marketplace](https://github.com/Dev-GOM/claude-code-marketplace) | ⭐ 23 | Productivity plugins with hooks, commands, and agents. |
| [jmanhype/claude-code-plugin-marketplace](https://github.com/jmanhype/claude-code-plugin-marketplace) | ⭐ 5 | 19 multi-agent trading and GitHub automation plugins. |
| [kivilaid/plugin-marketplace](https://github.com/kivilaid/plugin-marketplace) | ⭐ 2 | Showcase of every component type. |
| [netresearch/claude-code-marketplace](https://github.com/netresearch/claude-code-marketplace) | ⭐ 3 | Curated skills by Netresearch DTT GmbH. |

> **Safety note:** verify the source of any marketplace before adding it. Plugins can register hooks and MCP servers that run on your machine — read what you're running and review permissions carefully.

## Documentation

[Plugins guide](https://code.claude.com/docs/en/plugins) · [Plugin reference](https://code.claude.com/docs/en/plugins-reference) · [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [Sub-agents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) · [Slash commands](https://code.claude.com/docs/en/slash-commands) · [Hooks](https://code.claude.com/docs/en/hooks-guide)

## Contributing

Contributions welcome — agent tweaks, new plugins, doc fixes, bug reports. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — © Andis A. Blukis.

## Contact

- **GitHub:** [@andisab](https://github.com/andisab)
- **LinkedIn:** [andisab](https://www.linkedin.com/in/andisab)
- **Email:** andis.blukis@gmail.com
