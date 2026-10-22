# frontend

Frontend specialists for React, Vue, Next.js, HTML and CSS, plus a designer that turns mockups into implementation specs.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `fe-react-expert` | React 19+: hooks, concurrent rendering, Server Components, performance. |
| `fe-vue-expert` | Vue 3: Composition API, script setup, TypeScript, Pinia, Nuxt 3. |
| `fe-nextjs-expert` | Next.js 15+: App Router, Server Components, streaming, full-stack patterns. |
| `fe-html-expert` | Semantic, accessible, well-structured HTML. |
| `fe-css-expert` | Modern CSS: Grid, Flexbox, container queries, layers, nesting, responsive design. |
| `fe-frontend-designer` | Turning mockups and wireframes into technical specs and implementation guides. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use fe-react-expert to …") or choose it from `/agents`.

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
