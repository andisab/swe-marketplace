# SWE Marketplace

Claude Code plugins for everyday software engineering work. They make slide decks, knowledge-base sites and diagrams, review your code with three models at once, research a topic with parallel agents, help you build your own plugins, and add 54 specialist agents for languages, frameworks, clouds and databases. Each plugin installs on its own, so you add only what you'll use.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Validate plugin manifests](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml)
[![Plugins](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fandisab%2Fswe-marketplace%2Fmain%2F.claude-plugin%2Fmarketplace.json&query=%24.plugins.length&label=plugins&color=blue)](./.claude-plugin/marketplace.json)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8A2BE2.svg)](https://code.claude.com/docs/en/plugins)
[![Skills Directory: Grade A](https://www.skillsdirectory.com/api/skills/andisab-slideware/badge)](https://www.skillsdirectory.com/authors/andisab)

## Start here

Find the row that matches what you want to do, install that plugin, and then ask Claude for something like the example.

| You want to… | Install | Then ask Claude |
|---|---|---|
| Make slide decks, knowledge-base sites or diagrams in one consistent style | [`knowledgeware`](./plugins/knowledgeware/) | *"Make a 6-slide HTML deck on our Q3 results in style-3"* |
| Get a second and third opinion on code changes | [`adv`](./plugins/adv/) | *"Use the adv-review agent to review my uncommitted changes"* |
| Research a topic with parallel agents and get one written report | [`research-team`](./plugins/research-team/) | *"Use research-team to research vector database pricing"* |
| Build your own agents, skills, hooks, plugins or MCP servers | [`context-engineering`](./plugins/context-engineering/) | *"Help me create a skill that drafts our release notes"* |
| Bring in a specialist for a language, framework, cloud or database | [`dev`](./plugins/dev/), [`frontend`](./plugins/frontend/), [`infrastructure`](./plugins/infrastructure/), [`databases`](./plugins/databases/), [`data`](./plugins/data/), [`machine-learning`](./plugins/machine-learning/), [`genai`](./plugins/genai/) | *"Have the Terraform engineer review this module"* |
| Write PRDs and project plans | [`product-management`](./plugins/product-management/) | *"Draft a PRD for single sign-on"* |
| Keep CLAUDE.md files accurate as the code changes | [`arch`](./plugins/arch/) | *"Update CLAUDE.md for the changes on this branch"* |

To install one, run this in Claude Code (v2.1.275 or later), with any plugin name from the table in place of `knowledgeware`:

```
/plugin install knowledgeware --marketplace andisab/swe-marketplace
```

[Install](#install) shows what you'll see at each step, and covers older Claude Code versions, Claude Desktop, teams, claude.ai and the Agent SDK. The [catalog](#catalog) lists every skill, command and agent.

## What knowledgeware makes

<table>
<tr>
<td width="33%"><a href="docs/images/decks.jpg"><img src="docs/images/decks.jpg" alt="Four slides from the sample PowerPoint decks: a statistics slide, a dark three-card slide, a dark metrics table and a five-step process flow"></a></td>
<td width="33%"><a href="docs/images/presenter.jpg"><img src="docs/images/presenter.jpg" alt="Presenter view of an HTML deck: previous, current and next slides across the top, formatted speaker notes below, and a session timer in the header"></a></td>
<td width="33%"><a href="docs/images/knowledgebase.jpg"><img src="docs/images/knowledgebase.jpg" alt="A knowledge-base page with sidebar navigation, an on-page table of contents, a table with a Last verified stamp, and a Mermaid decision diagram"></a></td>
</tr>
<tr>
<td><b>PowerPoint decks</b> in a built-in style or your own brand.</td>
<td><b>HTML decks</b> that run offline, with a presenter view: notes, pacing timer, previous and next slides.</td>
<td><b>Knowledge-base sites</b> with navigation, diagrams and dated verification stamps.</td>
</tr>
</table>

## Install

### Your first plugin in Claude Code

These steps install knowledgeware. Every other plugin installs the same way.

1. In a Claude Code session, run:

   ```
   /plugin install knowledgeware --marketplace andisab/swe-marketplace
   ```

   The first time, Claude Code shows the marketplace source, `andisab/swe-marketplace`, and asks you to confirm adding it.

2. Claude Code opens the plugin's details, which list what it will install. Choose **Install for you (user scope)** to have the plugin in every project on this machine. The other two scopes turn it on for the current repository only.

3. Read the last line of the install summary. `Plugin is now active.` means you can use it right away. If it says `Run /reload-plugins to apply.`, Claude Code runs that reload for you.

4. Type `/knowledgeware:` in the prompt box, and you should see the plugin's skills, such as `/knowledgeware:slideware`. You don't have to call a skill by name, because Claude loads it when your request matches. Ask for a deck, and the slideware skill takes over.

On Claude Code older than v2.1.275, add the marketplace first and then install the plugin by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install knowledgeware@swe-marketplace
```

The part after the `@` is the name the marketplace registers under, `swe-marketplace`. The repository it comes from is `andisab/swe-marketplace`. Run `/plugin` with no arguments to browse every plugin in the marketplace.

### From a shell

Use these in scripts, dotfiles or CI:

```bash
claude plugin marketplace add andisab/swe-marketplace
claude plugin install knowledgeware@swe-marketplace            # add --scope project|local|user
claude plugin install knowledgeware --marketplace andisab/swe-marketplace   # one step, v2.1.292+
```

Plugins installed from a shell load the next time you start Claude Code, or after `/reload-plugins` in a session that's already open.

### Manage installed plugins

| Task | Command |
|---|---|
| List installed plugins | `claude plugin list` |
| Turn on automatic updates | `/plugin` → **Marketplaces** → **swe-marketplace** → **Enable auto-update** |
| Update one plugin | `claude plugin update knowledgeware@swe-marketplace` |
| Update everything from this marketplace | `/plugin` → **Marketplaces** → **swe-marketplace** → **Update marketplace** |
| See what a plugin adds to each session | `claude plugin details knowledgeware@swe-marketplace` |
| Turn a plugin off or on | `claude plugin disable knowledgeware@swe-marketplace` / `enable` |
| Uninstall a plugin | `claude plugin uninstall knowledgeware@swe-marketplace` |
| Remove the marketplace and its plugins | `claude plugin marketplace remove swe-marketplace` |

### For a team

Commit the marketplace and the plugins you want to the project's `.claude/settings.json`:

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

Teammates get the marketplace once they trust the project folder. Each of them then runs `claude plugin install knowledgeware@swe-marketplace --scope project` once, because enabling a plugin in settings doesn't download it.

### From a local clone

Use a clone to try changes or to work offline:

```bash
git clone https://github.com/andisab/swe-marketplace.git
claude plugin marketplace add ./swe-marketplace                # a relative path must start with ./
claude --plugin-dir ./swe-marketplace/plugins/knowledgeware    # load one plugin for a single session, no install
```

### Claude Desktop

**Chat and Cowork.** Open **Customize → Plugins → Add**, and then choose one of two options:

- **Add marketplace.** Enter `andisab/swe-marketplace` (or `https://github.com/andisab/swe-marketplace`) and install plugins from it. Updates arrive through the marketplace.
- **Upload plugin.** Upload a `.zip` of one plugin folder. The zip must contain exactly one `.claude-plugin/plugin.json`. To make one from a clone, run:

  ```bash
  cd swe-marketplace/plugins && zip -r knowledgeware.zip knowledgeware -x '*.DS_Store'
  ```

**Code tab.** Click **+** next to the prompt box, choose **Add plugins**, and pick plugins from a marketplace you've added. Plugins aren't available in cloud sessions or under WSL.

Cowork allows up to 200 MB and 5,000 files per plugin, and up to 25 added marketplaces.

### What runs where

A plugin bundles several kinds of components, and not every Claude app runs all of them:

| Where you use Claude | Skills and commands | Agents and hooks | Local MCP servers | LSP servers, output styles, settings, `bin/` |
|---|---|---|---|---|
| Claude Code (terminal, IDE, Desktop Code tab) | ✓ | ✓ | ✓ | ✓ |
| Desktop Cowork | ✓ | ✓ | ✓ | — |
| Desktop Chat, claude.ai | ✓ | — | — | — |

So `adv`'s reviewer agent, `research-team`'s researchers and `knowledgeware`'s librarian need Claude Code or Cowork. Bundled npm dependencies are installed only in Claude Code.

### claude.ai (a single skill)

To use one skill without its plugin, upload it as a zip under **Customize → Skills → + → Create skill → Upload a skill**. The zip must hold the skill's folder, not just its contents, and the folder name must match the skill's `name`:

```bash
cd swe-marketplace/plugins/context-engineering/skills && zip -r skill-dev.zip skill-dev
```

Skills need code execution, which you turn on under **Settings → Capabilities → Code execution and file creation**. A single skill works when it's self-contained, as context-engineering's authoring skills and research-team's `joplin-research` are. Skills that run their plugin's scripts (`knowledgeware`, `adv:dispatch`) or start agents (`research-team:coordinator`) need the whole plugin, installed in Claude Code or Cowork.

### Claude Agent SDK

Every plugin ships its own `plugin.json`, so the SDK can load one straight from a clone with `ClaudeAgentOptions(plugins=[{"type": "local", "path": "swe-marketplace/plugins/knowledgeware"}])`, or with `--plugin-dir` on the CLI.

### Requirements

Most plugins are instructions for Claude and need nothing else on your machine. Two need tools installed:

| Plugin | Needs | Optional |
|---|---|---|
| `adv` | [Codex CLI](https://github.com/openai/codex) and [Gemini CLI](https://github.com/google-gemini/gemini-cli), signed in | — |
| `knowledgeware` | Node.js for slide builds and registry scripts (the draw.io MCP server runs through `npx`) | LibreOffice and poppler for PowerPoint previews, and a browser MCP server (Playwright or Claude in Chrome) for visual checks. The [knowledgeware README](./plugins/knowledgeware/README.md#requirements) has the details. |

## Catalog

| Plugin | Version | What it's for | Contents |
|---|---|---|---|
| [`adv`](./plugins/adv/) | 0.2.0 | Adversarial multi-model code review. Claude, Codex CLI and Gemini CLI review in parallel, then cross-examine each other's findings. | 1 agent · 1 skill · 3 commands |
| [`context-engineering`](./plugins/context-engineering/) | 1.1.1 | The plugin for building other plugins: agents, skills, commands, hooks, plugins, MCP tools and servers, to Anthropic's specs. | 1 agent · 7 skills |
| [`research-team`](./plugins/research-team/) | 1.2.4 | Multi-agent web research. Parallel researchers take one subtopic each, then a writer turns their notes into one report, optionally formatted for Joplin. | 2 agents · 2 skills |
| [`knowledgeware`](./plugins/knowledgeware/) | 1.8.1 | Slide decks (PowerPoint, or HTML with a presenter view), offline HTML knowledge bases, diagrams and charts, all in one style from a shared registry. A librarian agent keeps sites and decks current. | 1 agent · 4 skills · 2 commands · 1 MCP server |
| [`dev`](./plugins/dev/) | 1.0.1 | Specialists for 10 languages, FastAPI and Node.js, plus cross-language refactoring. | 13 agents |
| [`frontend`](./plugins/frontend/) | 1.0.1 | React, Vue, Next.js, HTML and CSS specialists, plus a designer that turns mockups into specs. | 6 agents |
| [`infrastructure`](./plugins/infrastructure/) | 1.0.1 | AWS, GCP, Docker, Kubernetes, Terraform, CI/CD and security audits. | 8 agents |
| [`databases`](./plugins/databases/) | 1.0.1 | SQL, NoSQL, graph and vector databases. | 7 agents |
| [`data`](./plugins/data/) | 1.0.1 | Visualization (D3, Highcharts), notebooks (Jupyter, Colab), R, and Python data engineering. | 6 agents |
| [`machine-learning`](./plugins/machine-learning/) | 1.0.1 | PyTorch, TensorFlow and scikit-learn. | 3 agents |
| [`genai`](./plugins/genai/) | 1.0.1 | LangChain and LangGraph applications. More frameworks on the way. | 1 agent |
| [`product-management`](./plugins/product-management/) | 1.0.1 | PRDs, project plans, and clear writing. | 3 agents |
| [`arch`](./plugins/arch/) | 1.0.1 | Repository housekeeping: CLAUDE.md context files, and Docker and Make workflows. | 2 agents |

Each plugin's README covers its components, examples and requirements. Versions are pinned in [`marketplace.json`](./.claude-plugin/marketplace.json), and the [changelog](./CHANGELOG.md) says what changed in each. To hear about new releases, watch this repository's releases (**Watch → Custom → Releases**).

### Skills

Claude loads a skill when your request matches the skill's description. You can also call one by name.

| Skill | What it does |
|---|---|
| `knowledgeware:slideware` | Slide decks as PowerPoint, or a single-file HTML deck that runs offline, with a presenter view, session pacing and speaker notes. |
| `knowledgeware:knowledgebase` | Multi-page, offline HTML knowledge bases (field guides, handbooks, runbooks, study guides), each with a maintenance page so it can be kept current. |
| `knowledgeware:chartware` | Architecture diagrams and data charts as Mermaid, hand-written SVG, or editable draw.io files. |
| `knowledgeware:brandware` | The shared brand registry. It imports, derives or edits the brandbooks and logos that every deliverable uses. |
| `research-team:coordinator` | Runs the research pipeline. It splits a topic into subtopics, researches them in parallel, then has the report written. |
| `research-team:joplin-research` | Formatting rules for research notes saved to Joplin. |
| `context-engineering:agent-dev` | Designing subagents: frontmatter, system prompt, tool access, example-driven descriptions. |
| `context-engineering:skill-dev` | Designing skills whose descriptions trigger at the right moments. |
| `context-engineering:command-dev` | Slash commands: arguments, file references, bash, frontmatter. |
| `context-engineering:hook-dev` | Hooks on lifecycle events, for formatting, logging, notifications and permission control. |
| `context-engineering:plugin-dev` | Plugin layout, manifests and marketplace distribution. |
| `context-engineering:mcp-tool-dev` | Individual MCP tools: schemas, descriptions, input validation. |
| `context-engineering:mcp-server-dev` | Complete MCP servers in Python (FastMCP) or TypeScript, packaged for `uvx` or `npx`. |
| `adv:dispatch` | Shared scripts behind adv's review and commands. You don't call it directly. |

### Commands

| Command | What it does |
|---|---|
| `/knowledgeware:librarian status \| plan \| sweep` | Reports what's due across a library of sites and decks, writes an update plan, or fact-checks one knowledgebase site against primary sources. Built for weekly scheduled runs. |
| `/knowledgeware:kb-maintain <site>` | Deprecated alias for `librarian sweep`, kept so existing scheduled jobs keep working. |
| `/adv:adv-codex <prompt>` | Sends a prompt to Codex CLI and returns its answer. |
| `/adv:adv-gemini <prompt>` | Sends a prompt to Gemini CLI and returns its answer. |
| `/adv:adv-gemini-research <query>` | Deep research through Gemini, grounded in Google Search. |

### Agents

An agent is a specialist with its own instructions and its own context window. Claude hands a task to an agent when the task matches the agent's description. You can also ask for one by name or pick it from `/agents`, where each one is listed as `<plugin>:<agent>`, such as `dev:python-expert`.

<details>
<summary><b>All 54 agents</b>, by plugin</summary>

| Plugin | Agent | Use it for |
|---|---|---|
| adv | `adv-review` | Five reviewers across Claude, Codex CLI and Gemini CLI, then cross-examination to filter false positives. |
| context-engineering | `context-engineer` | Designing and building Claude Code resources with the context-engineering skills. |
| research-team | `research-specialist` | Researching one subtopic through web search and saving a short, cited note. |
| research-team | `research-report-writer` | Synthesizing the research notes into a structured report. |
| knowledgeware | `librarian` | What's due across sites and decks, update plans, and fact-check sweeps of knowledgebase sites. |
| dev | `python-expert` | Modern Python: async, type safety, FastAPI / Pydantic / SQLAlchemy patterns. |
| dev | `fastapi-architect` | Production FastAPI services: Pydantic v2, async SQLAlchemy 2.0, auth, API design. |
| dev | `typescript-expert` | TypeScript 5.7+: strict typing, generics, type-level programming. |
| dev | `javascript-expert` | Modern JavaScript: async patterns, code quality, performance. |
| dev | `nodejs-expert` | Node.js 22+: ES modules, streams, event-driven architecture, security. |
| dev | `go-expert` | Idiomatic Go: concurrency and performance. |
| dev | `rust-expert` | Idiomatic Rust: ownership, concurrency, the type system. |
| dev | `cpp-expert` | Modern, efficient C++. |
| dev | `kotlin-expert` | Idiomatic Kotlin: coroutines, extension functions, memory. |
| dev | `php-expert` | Modern, secure PHP applications. |
| dev | `lua-expert` | Efficient, idiomatic Lua. |
| dev | `perl-expert` | Perl scripting: regular expressions, text processing, CPAN. |
| dev | `refactor-agent` | Refactoring in any language, without changing behavior. |
| frontend | `react-expert` | React 19+: hooks, concurrent rendering, Server Components, performance. |
| frontend | `vue-expert` | Vue 3: Composition API, script setup, TypeScript, Pinia, Nuxt 3. |
| frontend | `nextjs-expert` | Next.js 15+: App Router, Server Components, streaming. |
| frontend | `html-expert` | Semantic, accessible, well-structured HTML. |
| frontend | `css-expert` | Modern CSS: Grid, Flexbox, container queries, layers, nesting. |
| frontend | `frontend-designer` | Turning mockups and wireframes into implementation specs. |
| infrastructure | `aws-cloud-architect` | AWS architecture: service selection, cost, security. |
| infrastructure | `gcp-cloud-architect` | Google Cloud architecture: GCE, GKE, Cloud Run, App Engine. |
| infrastructure | `infra-docker-engineer` | Docker and Compose: image optimization, multi-container dev environments. |
| infrastructure | `k8s-engineer` | Kubernetes: manifests, Helm charts, operators, GKE and EKS. |
| infrastructure | `terraform-engineer` | Terraform: modules, state management, multi-cloud provisioning. |
| infrastructure | `github-actions-expert` | GitHub Actions: reusable workflows, OIDC, matrix builds, hardening. |
| infrastructure | `gitlab-ci-expert` | GitLab CI/CD pipelines: configuration, optimization, security. |
| infrastructure | `security-auditor` | Codebase security audits with a prioritized remediation report. |
| databases | `db-postgres-expert` | PostgreSQL 16+: tuning, indexing, replication, architecture. |
| databases | `db-mongodb-expert` | MongoDB 6/7: document modeling, aggregation, sharding. |
| databases | `db-neo4j-expert` | Neo4j 5: graph modeling, Cypher, GDS, APOC. |
| databases | `db-cassandra-expert` | Cassandra 4/5: data modeling, CQL, cluster tuning. |
| databases | `db-mariadb-expert` | MariaDB 10/11: replication, Galera clustering, performance. |
| databases | `db-sql-expert` | Advanced SQL and execution-plan tuning across major engines. |
| databases | `db-vector-expert` | Vector search: pgvector, Pinecone, Weaviate, Qdrant, FAISS. |
| data | `d3-expert` | Custom interactive visualizations in D3 v7+. |
| data | `highcharts-expert` | Interactive charts with Highcharts Core, Stock, Maps and Gantt. |
| data | `data-jupyter-expert` | Production-ready Jupyter and JupyterLab notebooks. |
| data | `google-colab-expert` | Google Colab workflows: GPU/TPU sessions, GitHub integration. |
| data | `data-r-expert` | R for statistics and data science: tidyverse, tidymodels, Quarto. |
| data | `python-data-engineer` | Python data pipelines: Pandas, Polars, PySpark, Airflow. |
| machine-learning | `pytorch-expert` | Deep learning models in PyTorch. |
| machine-learning | `tensorflow-expert` | Developing and deploying TensorFlow models. |
| machine-learning | `scikit-learn-expert` | scikit-learn: preprocessing, model selection, pipelines, tuning. |
| genai | `langchain-expert` | LangChain and LangGraph: LCEL chains, RAG, multi-agent systems. |
| product-management | `prd-writer` | Product requirements documents. |
| product-management | `project-planner` | Turning a PRD into a development task list. |
| product-management | `content-writer` | Clear articles and outlines on complex topics. |
| arch | `context-agent` | Keeping CLAUDE.md files in sync with the repository. |
| arch | `build-orchestrator` | Docker and Make workflows: images, containers, volumes, build targets. |

</details>

## FAQ

### Do I need to install everything?

No. Each plugin works on its own, and none of them requires another. Adding the marketplace installs nothing by itself. It only lets you install plugins from it by name.

### Is it free?

The plugins are free and MIT-licensed. They run on whatever Claude Code already uses, your Claude subscription or API account, so they count toward the same usage limits or bill. `adv` also calls Codex CLI and Gemini CLI, which use your OpenAI and Google accounts.

### What does a plugin run on my machine, and does anything leave it?

Most plugins here are instructions that Claude reads. Their agents and skills work through the tools Claude already has, and Claude asks before running commands or editing files whenever your permission settings require it. No plugin in this marketplace installs hooks, which are commands that run automatically on Claude Code events. Three plugins do more than that:

- **knowledgeware** runs its own Node.js and Python scripts on your machine to build and check decks. It also starts the official draw.io MCP server (`@drawio/mcp`, which `npx` downloads from npm on first use) to open diagrams in the draw.io editor.
- **adv** runs Bash scripts that send the code under review to Codex CLI and Gemini CLI, so that code goes to OpenAI and Google. It writes its reports to `.claude/reviews/` in your repository.
- **research-team** searches the web and writes its notes and reports to `~/Documents/Claude/Research/`.

Before you install a plugin from any marketplace, read the details pane that `/plugin install` opens. Anthropic's [plugin security guide](https://code.claude.com/docs/en/plugins/security) says what to look for.

### Will installing several plugins fill up Claude's context?

Each installed plugin adds the short descriptions of its skills and agents to every session, so Claude knows when to use them. The full instructions load only when Claude uses a skill or agent. To see what one plugin adds, run `claude plugin details <name>@swe-marketplace` in your shell and read the `Always-on` line. For knowledgeware 1.8.0 it reads about 1,500 tokens, under 1% of a 200,000-token context window. Disable plugins you aren't using with `claude plugin disable <name>@swe-marketplace`.

### How do I get updates?

Claude Code doesn't update plugins from third-party marketplaces such as this one until you turn that on. Run `/plugin`, open the **Marketplaces** tab, select **swe-marketplace** and choose **Enable auto-update**. To update by hand instead, choose **Update marketplace** on the same screen. A running session keeps the version it loaded, so run `/reload-plugins` or start a new session to use the new one. The [changelog](./CHANGELOG.md) lists what changed in each version.

### How is an agent different from asking Claude directly?

An agent starts with instructions written for its specialty and works in its own context window. Claude hands it the task, the agent does the reading and the work there, and only its report comes back. A long investigation therefore doesn't fill your main conversation. For a quick question, asking Claude directly works fine. To use an agent on purpose, name it in your request, as in *"have db-postgres-expert review this migration"*, or pick it from `/agents`.

### I added one skill from a skills directory, and it says it needs the whole plugin.

Skills directories copy a single skill folder. Some skills depend on files elsewhere in their plugin, such as scripts, styles or agents. slideware, brandware and research-team's coordinator check for those files, and when they're missing, the skill stops and prints the command that installs the whole plugin. Run that command. The context-engineering skills and `joplin-research` are self-contained and work on their own.

### Can I use these plugins outside the terminal?

Yes, with limits. The Desktop app's Code tab and Cowork run these plugins, while Desktop Chat and claude.ai run only skills and commands, as [What runs where](#what-runs-where) shows. Cloud sessions, including Claude Code on the web at claude.ai/code, don't load plugins you installed on your own machine.

### Something doesn't work, or I'd like an agent added.

Open an [issue](https://github.com/andisab/swe-marketplace/issues). For a bug, include the output of `claude --version`, the plugin and version from `claude plugin list`, what you asked Claude, and what happened.

## Troubleshooting

**An install command ending in `@andisab-swe-marketplace` fails.** The marketplace registers under the name `swe-marketplace`, so the plugin name is, for example, `dev@swe-marketplace`. Some plugin directories print the longer form. Run `claude plugin marketplace list` to see the names of the marketplaces you've added.

**A skill or agent doesn't start when you ask.** Open `/plugin` and check the **Installed** tab to confirm the plugin is installed and enabled. If you installed it from a shell or in another session, run `/reload-plugins`. Two skills start only when you name them, the knowledgebase skill (*"use the knowledgebase skill to …"*) and research-team's coordinator (*"use research-team to research …"*). For the others, naming the skill or agent in your request is the most reliable way to start it.

**adv's review comes back from Claude alone.** adv falls back to Claude when Codex CLI or Gemini CLI is missing, signed out or out of quota. Install and sign in to both, then run the dependency check in the [adv README](./plugins/adv/README.md#requirements).

**A plugin installed but didn't load.** Open the **Errors** tab in `/plugin` for the reason, then look it up in Anthropic's [plugin troubleshooting guide](https://code.claude.com/docs/en/plugins/troubleshooting).

## How this marketplace is built

- **Curated.** Every plugin and agent is one I use. The marketplace holds no vendored collections and no generated stubs of skills the model already has.
- **Loads in the Agent SDK.** Every plugin ships its own `plugin.json` next to its catalog entry, so the Claude Agent SDK and `claude --plugin-dir` can load a plugin straight from a clone. When a marketplace ships only the catalog, those loaders don't register its skills, commands and hooks, and they don't report an error either.
- **Validated in CI.** Every pull request and push to `main` runs `claude plugin validate` on the catalog and every plugin and fails on any error or warning, including the plugin-directory checks for README install lines and icons. CI also checks that the generated manifests match the catalog, and it rejects agents that name tools Claude Code doesn't have.
- **Tested with evals.** I use skill-creator and my own eval harness to build and evaluate plugins, and most of the skills and plugins here have been through evals.

## Other marketplaces

This marketplace has no hooks, LSP servers or output styles, and one MCP server. If you need something it doesn't have, start with Anthropic's official marketplace, `claude-plugins-official`, which Claude Code adds for you; run `/plugin` to browse it. These community marketplaces are also worth a look:

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

> **Safety note:** Check who publishes a marketplace before you add it. Plugins can register hooks and MCP servers that run on your machine, so read what a plugin will run and review its permissions.

## Contributing

Agent improvements, new plugins, doc fixes and bug reports are all welcome. [CONTRIBUTING.md](./CONTRIBUTING.md) has the full workflow.

The marketplace ships two manifests. The catalog, `.claude-plugin/marketplace.json`, is the source of truth that `/plugin marketplace add` and `/plugin install` read. Each plugin's `plugins/<name>/.claude-plugin/plugin.json` is generated from its catalog entry for loaders that read one plugin directly, and the plugin's `icon.png` sits beside it. Edit the catalog, then regenerate and validate:

```bash
python scripts/synthesize-plugin-manifests.py          # regenerate every plugin.json
python scripts/synthesize-plugin-manifests.py --check  # fail if any plugin.json has drifted (CI runs this)
python scripts/check-agent-tools.py                    # agent tool names (CI runs this)
./scripts/validate-all.sh                              # full validation (CI runs this)
git config core.hooksPath scripts/git-hooks            # optional: run the drift check before each commit
```

The pre-commit hook checks the staged files, not the working tree, so a commit with a stale `plugin.json` fails even when the tree is in sync. `git commit --no-verify` skips it for one commit.

## Documentation

**Claude Code:** [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) · [Plugins guide](https://code.claude.com/docs/en/plugins) · [Plugin reference](https://code.claude.com/docs/en/plugins-reference) · [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) · [Sub-agents](https://code.claude.com/docs/en/sub-agents) · [Skills](https://code.claude.com/docs/en/skills) · [Slash commands](https://code.claude.com/docs/en/slash-commands) · [Hooks](https://code.claude.com/docs/en/hooks-guide)

**Claude Desktop and claude.ai:** [Plugins](https://claude.com/docs/plugins/overview) · [Plugins in Cowork](https://claude.com/docs/cowork/guide/plugins) · [What runs where](https://claude.com/docs/plugins/platform-support) · [Using skills](https://support.claude.com/en/articles/12512180-using-skills-in-claude)

## License

[MIT](./LICENSE), © Andis A. Blukis. Plugin icons use [Lucide](https://lucide.dev) glyphs (ISC license).

## Contact

- **GitHub:** [@andisab](https://github.com/andisab)
- **LinkedIn:** [andisab](https://www.linkedin.com/in/andisab)
- **Email:** andis.blukis@gmail.com
