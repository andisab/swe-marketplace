# product-management

This plugin adds three agents for product work. One writes product requirements documents, one turns a PRD into a development task list, and one writes articles and outlines that explain technical topics in plain language.

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

## Try it

- *"Use prd-writer to draft a PRD for adding single sign-on with Okta and Google Workspace."* The agent writes `prd.md` with business goals, user personas, functional requirements, user flows, success metrics and user stories.
- *"Have project-planner turn docs/prd.md into a task list."* The agent writes `plan.md` with the development tasks from initial setup through deployment.
- *"Ask content-writer for an outline of a post that explains feature flags to new engineers, then have it write the post."* The agent saves the outline, then writes the article from it at about an 8th-grade reading level.

## Agents

Claude Code lists each agent as `product-management:<name>`, for example `product-management:prd-writer`.

| Agent | Use it for |
|---|---|
| `prd-writer` | Product requirements documents: goals, personas, functional requirements, user flows, success metrics, user stories. |
| `project-planner` | Turning a PRD into a structured development task list, from setup through deployment. |
| `content-writer` | Articles, posts and outlines that explain complex topics in plain language, with an outline mode and a write mode. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Where do the documents go?** prd-writer writes `prd.md` and project-planner writes `plan.md`, each in the folder you name. When you don't name one, they suggest a location and ask first. content-writer saves to `.content/<slug>.md` unless you name a folder.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
