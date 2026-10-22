# SWE Marketplace

> A curated [Claude Code](https://claude.com/claude-code) plugin marketplace for practical, everyday usage in software engineering — 13 plugins, 54 specialist agents, 14 skills, 5 commands and 1 MCP server. A few opinionated choices that set it apart from larger awesome-style lists:

- **Curated, not exhaustive.** Every plugin and agent is one I actually use. No vendored grab-bags, no auto-generated stubs of skills the model already has.
- **SDK-loadable.** Every plugin ships both the catalog entry *and* a per-plugin `plugin.json`, so consumers using the Claude Agent SDK (`ClaudeAgentOptions.plugins=[{"type":"local","path":...}]` or `--plugin-dir`) can load them directly. Many marketplaces only ship the catalog and silently fail to register skills/commands/hooks when loaded that way.
- **CI-guarded drift.** A GitHub Action validates manifest sync on every PR.
- **Zero-warning validation.** Every plugin passes `claude plugin validate` with no errors or warnings, including the plugin-directory checks (README install line, icon).
- **Most skills & plugins have been run through exhaustive evals.** I am an avid fan of skill-creator and have a custom-built eval harness for building and evaluating plugins. Many of the resources here are fruit borne from that work.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Validate plugin manifests](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml)
[![Plugins](https://img.shields.io/badge/plugins-13-blue.svg)](./.claude-plugin/marketplace.json)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8A2BE2.svg)](https://code.claude.com/docs/en/plugins)

## Quick start

```
/plugin install knowledgeware --marketplace andisab/swe-marketplace
```

Run it in Claude Code (v2.1.275 or later); swap in any plugin name from the [catalog](#catalog). The plugin is active as soon as it installs; in a session that was already running, run `/reload-plugins` if prompted. For Claude Desktop, older Claude Code versions, teams and claude.ai, see [Install](#install).

## Install

### Claude Code (CLI)

**In a session.** Add the marketplace once, then install plugins by name. `/plugin install` opens a details panel where you choose the scope (just you, this project, or this machine):

```
/plugin marketplace add andisab/swe-marketplace
/plugin install knowledgeware@swe-marketplace
```

Or do both in one step (v2.1.275+): `/plugin install knowledgeware --marketplace andisab/swe-marketplace`. Run `/plugin` to browse the catalog.

**From a shell** (scripts, dotfiles, CI):

```bash
claude plugin marketplace add andisab/swe-marketplace
claude plugin install knowledgeware@swe-marketplace            # add --scope project|local|user
claude plugin install knowledgeware --marketplace andisab/swe-marketplace   # one step, v2.1.292+
```

**Manage installed plugins:**

| Task | Command |
|---|---|
| List installed plugins | `claude plugin list` |
| Update one plugin | `claude plugin update knowledgeware@swe-marketplace` |
| Update everything from this marketplace | `/plugin` → **Marketplaces** → **Update marketplace** |
| Turn a plugin off or on | `claude plugin disable knowledgeware@swe-marketplace` / `enable` |
| Uninstall a plugin | `claude plugin uninstall knowledgeware@swe-marketplace` |
| Remove the marketplace (and its plugins) | `claude plugin marketplace remove swe-marketplace` |

**For a team.** Commit the marketplace and the plugins you want to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "swe-marketplace": { "source": { "source": "github", "repo": "andisab/swe-marketplace" } }
  },
  "enabledPlugins": {
    "knowledgeware@swe-marketplace": true
  }
}
```

Teammates get the marketplace once they trust the project folder; each then runs `claude plugin install knowledgeware@swe-marketplace --scope project` once.

**From a local clone** (to try changes, or to work offline):

```bash
git clone https://github.com/andisab/swe-marketplace.git
claude plugin marketplace add ./swe-marketplace                # a relative path must start with ./
claude --plugin-dir ./swe-marketplace/plugins/knowledgeware    # load one plugin for a single session, no install
```

### Claude Desktop

**Chat and Cowork:** open **Customize → Plugins → Add**, then either:

- **Add marketplace:** enter `andisab/swe-marketplace` (or `https://github.com/andisab/swe-marketplace`) and install plugins from it. Updates arrive through the marketplace.
- **Upload plugin:** upload a `.zip` of one plugin folder. The zip must contain exactly one `.claude-plugin/plugin.json`. To make one from a clone:

  ```bash
  cd swe-marketplace/plugins && zip -r knowledgeware.zip knowledgeware -x '*.DS_Store'
  ```

**Code tab:** click **+** next to the prompt box, then **Add plugins**, and pick plugins from an added marketplace. Plugins aren't available in cloud sessions or under WSL.

Cowork allows up to 200 MB and 5,000 files per plugin, and up to 25 added marketplaces.

**What runs where.** A plugin bundles several kinds of components, and not every surface runs all of them:

| Surface | Skills & commands | Agents & hooks | Local MCP servers | Everything else (LSP, output styles, settings, `bin/`) |
|---|---|---|---|---|
| Claude Code (CLI, IDE, Desktop Code tab) | ✓ | ✓ | ✓ | ✓ |
| Desktop Cowork | ✓ | ✓ | ✓ | — |
| Desktop Chat, claude.ai | ✓ | — | — | — |

So `adv`'s reviewer agent, `research-team`'s researchers and `knowledgeware`'s librarian need Claude Code or Cowork. Bundled npm dependencies are installed only in Claude Code.

### claude.ai (a single skill)

To use one skill without its plugin, upload it as a zip: **Customize → Skills → + → Create skill → Upload a skill**. The zip must hold the skill's folder, not its contents, and the folder name must match the skill's `name`:

```bash
cd swe-marketplace/plugins/context-engineering/skills && zip -r skill-dev.zip skill-dev
```

Skills need code execution turned on (**Settings → Capabilities → Code execution and file creation**). This works for self-contained skills, such as context-engineering's authoring skills and research-team's `joplin-research`. Skills that run the plugin's scripts (`knowledgeware`, `adv:dispatch`) or spawn agents (`research-team:coordinator`) need the full plugin, installed in Claude Code or Cowork.

### Claude Agent SDK

Every plugin ships its own `plugin.json`, so the SDK can load one straight from a clone: `ClaudeAgentOptions(plugins=[{"type": "local", "path": "swe-marketplace/plugins/knowledgeware"}])`, or `--plugin-dir` on the CLI.

### Requirements

Most plugins are prompts and need nothing else. These need tools on your machine:

| Plugin | Needs | Optional |
|---|---|---|
| `adv` | [Codex CLI](https://github.com/openai/codex) and [Gemini CLI](https://github.com/google-gemini/gemini-cli), signed in | — |
| `knowledgeware` | Node.js (slide builds, registry scripts; the draw.io MCP server runs through `npx`) | LibreOffice + poppler for pptx previews; a browser MCP (Playwright or Claude in Chrome) for visual checks — [details](./plugins/knowledgeware/README.md#requirements) |
| `research-team` | — | A Joplin MCP server, for saving reports to Joplin |

## Catalog

| Plugin | Version | What it's for | Contents |
|---|---|---|---|
| [`adv`](./plugins/adv/) | 0.2.0 | Adversarial multi-model code review: Claude, Codex CLI and Gemini CLI review in parallel, then cross-examine each other's findings. | 1 agent · 1 skill · 3 commands |
| [`context-engineering`](./plugins/context-engineering/) | 1.1.0 | The plugin you use to build other plugins: agents, skills, commands, hooks, plugins, MCP tools and servers, to Anthropic's specs. | 1 agent · 7 skills |
| [`research-team`](./plugins/research-team/) | 1.2.3 | Multi-agent web research: parallel researchers per subtopic, then one synthesized report (Joplin output optional). | 2 agents · 2 skills |
| [`knowledgeware`](./plugins/knowledgeware/) | 1.8.0 | Brand-consistent deliverables: slide decks (PowerPoint, or HTML with a presenter view), offline HTML knowledge bases, diagrams and charts, from one style registry. A librarian keeps sites and decks current. | 1 agent · 4 skills · 2 commands · 1 MCP server |
| [`dev`](./plugins/dev/) | 1.0.0 | Language specialists for 12 languages, plus cross-language refactoring. | 13 agents |
| [`frontend`](./plugins/frontend/) | 1.0.0 | React, Vue, Next.js, HTML and CSS specialists, plus a mockup-to-spec designer. | 6 agents |
| [`infrastructure`](./plugins/infrastructure/) | 1.0.0 | AWS, GCP, Docker, Kubernetes, Terraform, CI/CD and security audits. | 8 agents |
| [`databases`](./plugins/databases/) | 1.0.0 | SQL, NoSQL, graph and vector databases. | 7 agents |
| [`data`](./plugins/data/) | 1.0.0 | Visualization (D3, Highcharts), notebooks (Jupyter, Colab), R, Python data engineering. | 6 agents |
| [`machine-learning`](./plugins/machine-learning/) | 1.0.0 | PyTorch, TensorFlow and scikit-learn. | 3 agents |
| [`genai`](./plugins/genai/) | 1.0.0 | LangChain and LangGraph applications. More frameworks on the way. | 1 agent |
| [`product-management`](./plugins/product-management/) | 1.0.0 | PRDs, project plans, and clear writing. | 3 agents |
| [`arch`](./plugins/arch/) | 1.0.0 | Repository housekeeping: CLAUDE.md context files, and Docker and Make workflows. | 2 agents |

Each plugin's README lists its components and install line. Versions are pinned in [`marketplace.json`](./.claude-plugin/marketplace.json).

### Skills

Claude loads a skill when a task matches its description; you can also call one by name.

| Skill | What it does |
|---|---|
| `knowledgeware:slideware` | Slide decks as PowerPoint, or a single-file HTML deck that runs offline, with a presenter view, session pacing and speaker notes. |
| `knowledgeware:knowledgebase` | Multi-page, offline HTML knowledge bases (field guides, handbooks, runbooks, study guides), built with a maintenance page so they can be kept current. |
| `knowledgeware:chartware` | Architecture diagrams and data charts as Mermaid, hand-authored SVG, or editable draw.io files. |
| `knowledgeware:brandware` | The shared brand registry: import, derive or edit the brandbooks and logos every deliverable uses. |
| `research-team:coordinator` | Runs the research pipeline: splits a topic into subtopics, researches them in parallel, then writes the report. |
| `research-team:joplin-research` | Formatting rules for research notes saved to Joplin. |
| `context-engineering:agent-dev` | Design subagents: frontmatter, system prompt, tool access, example-driven descriptions. |
| `context-engineering:skill-dev` | Design skills whose descriptions trigger at the right moments. |
| `context-engineering:command-dev` | Slash commands: arguments, file references, bash, frontmatter. |
| `context-engineering:hook-dev` | Hooks on lifecycle events: formatting, logging, notifications, permission control. |
| `context-engineering:plugin-dev` | Plugin layout, manifests and marketplace distribution. |
| `context-engineering:mcp-tool-dev` | Individual MCP tools: schemas, descriptions, input validation. |
| `context-engineering:mcp-server-dev` | Complete MCP servers in Python (FastMCP) or TypeScript, packaged for `uvx` or `npx`. |
| `adv:dispatch` | Shared scripts behind adv's review and commands; not called directly. |

### Commands

| Command | What it does |
|---|---|
| `/knowledgeware:librarian status \| plan \| sweep` | Report what's due across a library of sites and decks, write an update plan, or fact-check one knowledgebase site against primary sources. Built for weekly scheduled runs. |
| `/knowledgeware:kb-maintain <site>` | Deprecated alias for `librarian sweep`, kept so existing scheduled jobs keep working. |
| `/adv:adv-codex <prompt>` | Send a prompt to Codex CLI and return its answer. |
| `/adv:adv-gemini <prompt>` | Send a prompt to Gemini CLI and return its answer. |
| `/adv:adv-gemini-research <query>` | Deep research through Gemini, grounded in Google Search. |

### Agents

Claude hands a task to an agent when it matches the agent's description; you can also ask for one by name or pick it from `/agents`.

<details>
<summary><b>All 54 agents</b>, by plugin</summary>

| Plugin | Agent | Use it for |
|---|---|---|
| adv | `adv-review` | Five reviewers across Claude, Codex CLI and Gemini CLI, then cross-examination to filter false positives. |
| context-engineering | `context-engineer` | Designing and building Claude Code resources with the context-engineering skills. |
| research-team | `research-specialist` | Researching one subtopic through web search and saving a short, cited note. |
| research-team | `research-report-writer` | Synthesizing the research notes into a structured report. |
| knowledgeware | `librarian` | What's due across sites and decks, update plans, and fact-check sweeps of knowledgebase sites. |
| dev | `dev-python-expert` | Modern Python: async, type safety, FastAPI / Pydantic / SQLAlchemy patterns. |
| dev | `dev-fastapi-architect` | Production FastAPI services: Pydantic v2, async SQLAlchemy 2.0, auth, API design. |
| dev | `dev-typescript-expert` | TypeScript 5.7+: strict typing, generics, type-level programming. |
| dev | `dev-javascript-expert` | Modern JavaScript: async patterns, code quality, performance. |
| dev | `dev-nodejs-expert` | Node.js 22+: ES modules, streams, event-driven architecture, security. |
| dev | `dev-go-expert` | Idiomatic Go: concurrency and performance. |
| dev | `dev-rust-expert` | Idiomatic Rust: ownership, concurrency, the type system. |
| dev | `dev-cpp-expert` | Modern, efficient C++. |
| dev | `dev-kotlin-expert` | Idiomatic Kotlin: coroutines, extension functions, memory. |
| dev | `dev-php-expert` | Modern, secure PHP applications. |
| dev | `dev-lua-expert` | Efficient, idiomatic Lua. |
| dev | `dev-perl-expert` | Perl scripting: regular expressions, text processing, CPAN. |
| dev | `dev-refactor-agent` | Refactoring in any language, without changing behavior. |
| frontend | `fe-react-expert` | React 19+: hooks, concurrent rendering, Server Components, performance. |
| frontend | `fe-vue-expert` | Vue 3: Composition API, script setup, TypeScript, Pinia, Nuxt 3. |
| frontend | `fe-nextjs-expert` | Next.js 15+: App Router, Server Components, streaming. |
| frontend | `fe-html-expert` | Semantic, accessible, well-structured HTML. |
| frontend | `fe-css-expert` | Modern CSS: Grid, Flexbox, container queries, layers, nesting. |
| frontend | `fe-frontend-designer` | Turning mockups and wireframes into implementation specs. |
| infrastructure | `infra-aws-architect` | AWS architecture: service selection, cost, security. |
| infrastructure | `infra-gcp-architect` | Google Cloud architecture: GCE, GKE, Cloud Run, App Engine. |
| infrastructure | `infra-docker-engineer` | Docker and Compose: image optimization, multi-container dev environments. |
| infrastructure | `infra-k8s-engineer` | Kubernetes: manifests, Helm charts, operators, GKE and EKS. |
| infrastructure | `infra-terraform-engineer` | Terraform: modules, state management, multi-cloud provisioning. |
| infrastructure | `infra-github-actions-expert` | GitHub Actions: reusable workflows, OIDC, matrix builds, hardening. |
| infrastructure | `infra-gitlab-ci-expert` | GitLab CI/CD pipelines: configuration, optimization, security. |
| infrastructure | `infra-security-auditor` | Codebase security audits with a prioritized remediation report. |
| databases | `db-postgres-expert` | PostgreSQL 16+: tuning, indexing, replication, architecture. |
| databases | `db-mongodb-expert` | MongoDB 6/7: document modeling, aggregation, sharding. |
| databases | `db-neo4j-expert` | Neo4j 5: graph modeling, Cypher, GDS, APOC. |
| databases | `db-cassandra-expert` | Cassandra 4/5: data modeling, CQL, cluster tuning. |
| databases | `db-mariadb-expert` | MariaDB 10/11: replication, Galera clustering, performance. |
| databases | `db-sql-expert` | Advanced SQL and execution-plan tuning across major engines. |
| databases | `db-vector-expert` | Vector search: pgvector, Pinecone, Weaviate, Qdrant, FAISS. |
| data | `data-d3-expert` | Custom interactive visualizations in D3 v7+. |
| data | `data-highcharts-expert` | Interactive charts with Highcharts Core, Stock, Maps and Gantt. |
| data | `data-jupyter-expert` | Production-ready Jupyter and JupyterLab notebooks. |
| data | `data-google-colab-expert` | Google Colab workflows: GPU/TPU sessions, GitHub integration. |
| data | `data-r-expert` | R for statistics and data science: tidyverse, tidymodels, Quarto. |
| data | `data-python-data-engineer` | Python data pipelines: Pandas, Polars, PySpark, Airflow. |
| machine-learning | `ml-pytorch-expert` | Deep learning models in PyTorch. |
| machine-learning | `ml-tensorflow-expert` | Developing and deploying TensorFlow models. |
| machine-learning | `ml-scikit-learn-expert` | scikit-learn: preprocessing, model selection, pipelines, tuning. |
| genai | `genai-langchain-expert` | LangChain and LangGraph: LCEL chains, RAG, multi-agent systems. |
| product-management | `pm-prd-writer` | Product requirements documents. |
| product-management | `pm-project-planner` | Turning a PRD into a development task list. |
| product-management | `pm-content-writer` | Clear articles and outlines on complex topics. |
| arch | `arch-context-agent` | Keeping CLAUDE.md files in sync with the repository. |
| arch | `build-orchestrator` | Docker and Make workflows: images, containers, volumes, build targets. |

</details>

## Plugin manifests

Two manifests ship together:

- **`.claude-plugin/marketplace.json`** (repo root) — catalog used by `/plugin marketplace add` and `/plugin install`. **Source of truth.**
- **`plugins/<name>/.claude-plugin/plugin.json`** — per-plugin manifest used by SDK consumers loading plugins directly. **Generated** from the matching `marketplace.json` entry. Each plugin's icon sits beside it (`icon.png`).

```bash
python scripts/synthesize-plugin-manifests.py          # regenerate
python scripts/synthesize-plugin-manifests.py --check  # drift check (CI runs this)
./scripts/validate-all.sh                              # full validation
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contribution workflow.

## Other marketplaces worth checking out

| Repository | Stars (Aug 2026) | Description |
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

**Claude Code:** [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) · [Plugins guide](https://code.claude.com/docs/en/plugins) · [Plugin reference](https://code.claude.com/docs/en/plugins-reference) · [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [Sub-agents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) · [Slash commands](https://code.claude.com/docs/en/slash-commands) · [Hooks](https://code.claude.com/docs/en/hooks-guide)

**Claude Desktop and claude.ai:** [Plugins](https://claude.com/docs/plugins/overview) · [Plugins in Cowork](https://claude.com/docs/cowork/guide/plugins) · [What runs where](https://claude.com/docs/plugins/platform-support) · [Using skills](https://support.claude.com/en/articles/12512180-using-skills-in-claude)

## Contributing

Contributions welcome — agent tweaks, new plugins, doc fixes, bug reports. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — © Andis A. Blukis. Plugin icons use [Lucide](https://lucide.dev) glyphs (ISC license).

## Contact

- **GitHub:** [@andisab](https://github.com/andisab)
- **LinkedIn:** [andisab](https://www.linkedin.com/in/andisab)
- **Email:** andis.blukis@gmail.com
