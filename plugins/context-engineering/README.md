# context-engineering

Build your own Claude Code extensions by describing them: subagents, skills, slash commands, hooks, plugins, and MCP tools and servers. Claude asks what the extension should do, then writes the files in the format Claude Code expects, starting from this plugin's templates. Use it for a first agent or skill, or for a complete plugin to share with your team.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install context-engineering --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install context-engineering@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **context-engineering**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

Each prompt below loads the matching skill, or hands the work to the `context-engineer` agent, which uses the same skills. Expect a few questions first, such as which tools the extension needs and whether it's for you or the whole project.

- *"Create an agent for PostgreSQL query tuning."* You get one Markdown file, such as `.claude/agents/postgres-expert.md`. Its frontmatter holds the name, a description with example requests that tells Claude when to hand work to the agent, the tools it may use and the model, and the system prompt follows.
- *"Make a skill that drafts release notes from merged pull requests."* You get a folder such as `.claude/skills/release-notes/` with a `SKILL.md`, plus `references/` or `templates/` when the instructions need them. The description names the requests that should load the skill and the ones that shouldn't.
- *"Create a /run-tests command that takes an environment name."* You get `.claude/commands/run-tests.md`, which reads the environment from `$1` (or `$ARGUMENTS` for everything you typed) and can pull in files with `@` references.
- *"Format Python files with Black after Claude edits them."* You get a `PostToolUse` hook, a shell command that Claude Code runs after every `Edit` or `Write`, added to `.claude/settings.json` or one of the other settings files.
- *"Build an MCP server in Python for our issue tracker, packaged for uvx."* You get a project copied from `templates/mcp-server-python-template/`: a `pyproject.toml`, a FastMCP server with a `tools/` package, and pytest tests. Ask for TypeScript to get the `@modelcontextprotocol/sdk` version, packaged for `npx`.

## What's inside

### Agent

| Agent | What it does |
|---|---|
| `context-engineer` | Designs and builds any of the resources below, using the matching skill and template. It runs on Sonnet. It can read and write files, but its shell access is limited to `mkdir`, `tree` and `ls`, so it doesn't run your tests. |

### Skills

Claude loads a skill when your request matches its description. The middle column shows the kind of request that loads each one.

| Skill | Loads when you ask to… | What it covers |
|---|---|---|
| `agent-dev` | "create an agent", "design a sub-agent", "make a specialist" | Subagent frontmatter, system prompt, tool access, and descriptions with example requests. |
| `skill-dev` | "create a skill", "make a capability", "add autonomous behavior" | Descriptions that load the skill at the right moments, and the layout of supporting files. |
| `command-dev` | "create a command", "make a slash command", "add a /command" | Arguments, file references, bash execution and frontmatter. |
| `hook-dev` | "create a hook", "add automation", "event handler" | Hooks on lifecycle events, for formatting, logging, notifications and permission control. |
| `plugin-dev` | "create a plugin", "bundle components", "distribute capabilities" | Plugin layout, `plugin.json`, and distribution through a marketplace. |
| `mcp-tool-dev` | "create an MCP tool", "add a tool to my MCP server", "design a tool schema" | One tool's name, description, input schema, validation and tests. |
| `mcp-server-dev` | "create an MCP server", "package tools for uvx/npx" | A complete server in Python (FastMCP) or TypeScript, its packaging and its tests. |

### Templates

The agent and skills start from these files in `templates/`, and you can copy them by hand too.

| Template | Starting point for |
|---|---|
| `subagent-template.md` | A subagent definition. |
| `skill-template.md` | A `SKILL.md` and its supporting folders. |
| `slash-command-template.md` | A slash command, with ten example commands. |
| `hook-configuration-template.md` | Twenty hook configurations, such as formatting after edits, audit logging, blocking edits to sensitive files and desktop notifications. |
| `plugin-structure.md` | A plugin's directory layout and `plugin.json`. |
| `resource-type-guide.md` | Choosing between an agent, skill, command, hook, plugin or MCP server. |
| `mcp-tool-template.py` | One FastMCP tool with input validation. |
| `mcp-server-python-template/` | A Python MCP server project with tests. |
| `mcp-server-typescript-template/` | A TypeScript MCP server project with tests. |

### Patterns

These documents in `patterns/` explain design choices the skills apply.

| Pattern | What it explains |
|---|---|
| `progressive-disclosure.md` | Keeping the part Claude always loads short (the name and description) and moving detail into files Claude reads only when it needs them. |
| `multi-agent-orchestration.md` | Splitting work across several agents and coordinating them. |
| `tool-restriction-patterns.md` | Giving each agent only the tools its job needs. |
| `skill-mcp-integration.md` | Using a skill to teach Claude how to use an MCP server's tools well. |

## Requirements

The plugin itself needs nothing beyond Claude Code. To run the MCP servers you build from the templates, you need Python 3.11 or later for the Python template, or Node.js 18 or later for the TypeScript one.

**Optional: conventions-mcp.** The agent and the `agent-dev` and `skill-dev` skills can search [conventions-mcp](https://www.npmjs.com/package/@ablukis/conventions-mcp), an MCP server I also maintain that serves agent definitions, workflows and coding conventions from community and private Git repositories. They use it to find a similar example before writing a new one. Register it under the name `Conventions`, because that's the name in the tool list the agent and skills use:

```bash
claude mcp add --scope user Conventions -- npx -y @ablukis/conventions-mcp
```

Without it, the agent and skills work from this plugin's templates and patterns.

## Questions and troubleshooting

**Which should I build: an agent, a skill, a command or a hook?** A slash command is a saved prompt that you run yourself by typing `/name`. A skill is a set of instructions and files that Claude loads on its own when a request matches its description. An agent (a subagent) is a separate Claude instance with its own context window, prompt and tools, which Claude hands a task to, so it suits long tasks or work that needs restricted tools. A hook is a shell command that Claude Code runs on an event, such as after every edit, without the model deciding. If you aren't sure, describe the problem and ask which one fits; `templates/resource-type-guide.md` covers the same choice in detail.

**Where do the files go?** Project files go under `.claude/` in your repository (`.claude/agents/`, `.claude/skills/<name>/`, `.claude/commands/`), where you can commit them for your team. Personal files go under `~/.claude/` and apply in every project. Hooks go into a settings file: `.claude/settings.json` for the team, `.claude/settings.local.json` for you in this project, or `~/.claude/settings.json` for you everywhere. Say which you want, and a plugin goes in whatever folder you name.

**How do I test what it built?** The agent can't run commands beyond `mkdir`, `tree` and `ls`, so you run these checks from your own session:

- **Agent:** Start a new session, run `/agents` to confirm it's listed, then ask for it by name.
- **Skill:** Ask Claude "When would you use the release-notes skill?" and check the answer against what you intended. Then try a few requests that should load it and a few that shouldn't.
- **Command or hook:** Run the command with and without arguments. Review a new hook in the `/hooks` menu, then trigger its event once in a scratch repository.
- **Plugin:** Run `claude plugin validate ./my-plugin`, then `claude --plugin-dir ./my-plugin` to load it for one session without installing it. Add `--debug` when a component doesn't show up.
- **MCP server:** Run the tests that come with the template, `pytest` for Python or `npm test` for TypeScript.

Questions that apply to every plugin, such as updates, context cost and what runs on your machine, are answered in the [marketplace FAQ](../../README.md#faq).

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). MIT license.
