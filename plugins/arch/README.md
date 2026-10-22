# arch

Repository housekeeping: keeping the CLAUDE.md files Claude Code relies on accurate as a codebase evolves, and managing Docker and Make workflows.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `arch-context-agent` | Keeping CLAUDE.md files in sync with the repository as it changes. |
| `build-orchestrator` | Docker and Make workflows: Dockerfile optimization, container lifecycles, volumes, build targets. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use arch-context-agent to …") or choose it from `/agents`.

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

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **arch**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).
