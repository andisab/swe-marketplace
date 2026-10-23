# frontend

This plugin adds specialists for React, Vue, Next.js, HTML and CSS, plus a designer agent that turns mockups and wireframes into implementation specs.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install frontend --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install frontend@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **frontend**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

- *"Have react-expert move the checkout form in src/components/CheckoutForm.tsx to React 19 actions and useActionState."* The agent rewrites the form handling and explains what changed.
- *"Use css-expert to make the product grid adapt to the width of its container instead of the viewport."* The agent rewrites the layout with container queries.
- *"Ask frontend-designer to turn designs/settings-page.png into an implementation spec."* The agent analyzes the mockup and writes `frontend-design-spec.md` with the component structure and the design system to build from. It asks where to save the file first.

## Agents

Claude Code lists each agent as `frontend:<name>`, for example `frontend:react-expert`.

| Agent | Use it for |
|---|---|
| `react-expert` | React 19+: hooks, concurrent rendering, Server Components, TypeScript, performance. |
| `vue-expert` | Vue 3: Composition API, script setup, TypeScript, Pinia, Vite, Nuxt 3. |
| `nextjs-expert` | Next.js 15+: App Router, Server Components, streaming, full-stack patterns. |
| `html-expert` | Semantic, accessible, well-structured HTML. |
| `css-expert` | Modern CSS: Grid, Flexbox, container queries, layers, nesting, responsive design. |
| `frontend-designer` | Turning mockups and wireframes into a technical spec and implementation guide. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Do the agents need Context7?** No, but they use it when it's there. Every agent here can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
