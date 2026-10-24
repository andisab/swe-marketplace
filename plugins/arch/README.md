# arch

This plugin adds two agents for repository housekeeping. `context-agent` writes and updates the CLAUDE.md file that Claude Code reads at the start of each session, so the file keeps up with the code. `build-orchestrator` helps with Docker and Make during development, from slow Dockerfiles to deciding whether a change needs a rebuild or a restart.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install arch --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install arch@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **arch**. Shell commands, team settings, zip upload and claude.ai options are in the marketplace's [install guide](../../docs/install.md).

## Try it

- *"Use context-agent to update CLAUDE.md with the changes on this branch before I commit."* The agent finds CLAUDE.md (in the current directory, then in `.claude/`), reviews the git changes and the file structure, and updates the sections that no longer match the code.
- *"Update only the status and to-do section of CLAUDE.md."* The agent uses its status-only mode. It marks finished items, adds new tasks from recent commits and leaves the rest of the file alone.
- *"My API image takes six minutes to build. Have build-orchestrator look at the Dockerfile."* The agent reviews the Dockerfile for build-speed problems such as layer order and caching, and suggests changes.

## Agents

Claude Code lists each agent as `arch:<name>`, for example `arch:context-agent`.

| Agent | Use it for |
|---|---|
| `context-agent` | Creating CLAUDE.md for a new repository and keeping it in sync as the code changes, with a status-only mode for quick updates. |
| `build-orchestrator` | Docker and Make workflows: Dockerfile optimization, rebuild-or-restart decisions, container lifecycles, volumes and logs. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Where does context-agent write?** It updates the CLAUDE.md it finds in the current directory or in `.claude/`. When there's none, it creates CLAUDE.md in the project root and marks the details it had to assume, so you can check them.

**Can build-orchestrator run commands?** Yes. Its definition doesn't restrict its tools, so it has the same tools as your session, including Bash. Claude Code still asks before it runs a command your permission settings don't already allow.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
