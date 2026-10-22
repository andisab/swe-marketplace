# product-management

Product management specialists: requirements documents, project plans, and clear writing.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `pm-prd-writer` | Product requirements documents: goals, personas, functional requirements. |
| `pm-project-planner` | Turning a PRD into a structured development task list. |
| `pm-content-writer` | Clear articles, posts and outlines that explain complex topics simply. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use pm-prd-writer to …") or choose it from `/agents`.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install product-management --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install product-management@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **product-management**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).
