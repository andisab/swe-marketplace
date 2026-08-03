---
name: chartware
description: Generate enterprise-grade diagrams and data charts in three media — Mermaid (text-first diagrams), hand-authored inline SVG (pixel-perfect charts and figures for HTML embedding), and draw.io via the drawio MCP (editable diagram artifacts) — with a curated visual style system wired to the plugin's brand registry. Use this skill whenever the user asks to create architecture diagrams, reference architectures, system design diagrams, infrastructure diagrams, flowcharts, sequence diagrams, org charts, technology stack visualizations, or any technical diagram that should look professional and consistent — and also for DATA charts (bar, line, area, donut, scatter, sparkline, KPI/stat tile, heatmap) drawn as SVG for web pages, docs, or standalone files. Also trigger when the user mentions "chartware", "pretty-arrows" (this skill's former name), "draw.io", "drawio", "mxGraph", "mermaid", "SVG chart", or asks for diagrams in the style of their reference architecture. The skill picks the medium by fit or honors the user's explicit choice.
---

# chartware — Diagrams & Data Charts (Mermaid · SVG · draw.io)

One skill, three media, one visual identity. Diagrams and charts resolve their colors from the same brand registry as slideware decks and knowledgebase sites.

## Choosing the medium

**An explicit user request always wins** ("as a mermaid diagram", "in draw.io", "as SVG"). Otherwise pick by fit — and say which medium you chose and why:

| Medium | Choose when | Strengths | Limits |
|---|---|---|---|
| **Mermaid** | The diagram lives in markdown, a knowledgebase page, or an artifact; speed and text-maintainability matter more than exact layout | Renders natively in most targets; diffable; cheap to iterate | Auto-layout only — no pixel control; weak for data charts |
| **SVG** | Data charts (default medium for them); polished figures embedded in HTML deliverables; standalone `.svg` files; print | Total control; themes with the page (light/dark); no dependencies | Hand-computed layout; not end-user editable |
| **draw.io** | The user will open/edit/maintain the diagram; large layered reference architectures; a `.drawio` artifact is the deliverable | Real editor round-trip; the full curated style catalog | Needs the drawio MCP; heavier iteration loop |

Rules of thumb: flowchart in a README → Mermaid. Revenue chart in a report page → SVG. Enterprise reference architecture the client will maintain → draw.io. A diagram embedded in a knowledgebase/slideware deliverable → Mermaid if its auto-layout suffices, SVG when the layout must be exact.

## Brand resolution (all media)

If the user names a brand or style ("in the AAB style", "AcmeCorp-branded"), resolve it from the registry — `$KNOWLEDGEWARE_BRANDS_DIR/<name>.md` first (if that env var is set — the user's own brands directory), then `styles/brands/<name>.md` (plugin root — two directories above this skill), falling through to `styles/<name>.md` for the generic defaults — and substitute its palette/typography per the **brandware skill's `references/consumer-mappings.md` §chartware**. The mapping is deliberately understated — surface fills with categorical strokes, brand accent in at most two roles, low-saturation tints; a branded diagram should read as the brand's document, not a poster of its colors. For data charts (bars, lines, KPIs) follow brandware's `references/chart-styling.md`. If the brand isn't installed, use the defaults below and say so. When the user names no brand at all, check the `DEFAULT` marker (a one-line file naming a registry entry; `$KNOWLEDGEWARE_BRANDS_DIR/DEFAULT` wins over `styles/brands/DEFAULT`) and apply that identity if it resolves, telling the user; otherwise use each medium's default styling.

---

## Medium 1: Mermaid

For flowcharts, sequence diagrams, state machines, ER diagrams, gantt charts, and quick architecture sketches that live in text.

**Embedding**: ` ```mermaid ` fences in markdown and artifact pages; `<pre class="mermaid">` blocks in HTML that loads mermaid (knowledgebase pages do). If a mermaid validation/render tool is available (`tool_search` for "mermaid"), validate the syntax before delivering; otherwise double-check quoting — labels with `()`, `/`, or `:` need `["..."]` quoting.

**Branding**: apply the brandbook via an init block using the themeVariables mapping in brandware's `consumer-mappings.md` (§knowledgebase covers it): `primaryColor` = ~12% accent tint over bg · `primaryBorderColor` = accent · `primaryTextColor` = ink · `lineColor` = ink at ~70% (never the accent — edges recede) · `edgeLabelBackground` = bg · `fontFamily` = brand sans:

```
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#EDF0FC","primaryBorderColor":"#4969E1","primaryTextColor":"#111827","lineColor":"#4B5563","edgeLabelBackground":"#FFFFFF","fontFamily":"Inter, sans-serif"}}}%%
```

**Discipline**: keep node labels short (wrap with `<br/>`); prefer `flowchart TD/LR` direction that matches reading order; subgraphs for layers/containers; don't fight the auto-layout — if you're adding invisible edges to force positions, switch to SVG or draw.io and say so.

---

## Medium 2: SVG (charts & figures)

Hand-authored inline SVG — the default medium for **data charts**, and the right one for polished diagrams embedded in HTML.

**Read `references/svg-charts.md` before drawing** — it holds the mechanics: pixel-space viewBox + margin convention, scale/tick math (1-2-5-10), per-chart-type geometry (rounded-top bar paths, flat-tangent curve smoothing, the C=400 donut trick), text rules (`dy="0.32em"`, width estimation, halos), the three-layer theming token block (page-token inheritance + dark mode), accessibility pattern, and the pitfall list.

**Start from a template** in `templates/svg/` and adapt data, scales, and labels:

| Request | Template |
|---|---|
| Vertical bars, grouped comparison | `bar-grouped.svg` |
| Ranking, long labels, n > 8 | `bar-horizontal.svg` |
| Trend over time, with comparison series | `line-area.svg` |
| Parts of a whole, share breakdown | `donut.svg` |
| Correlation, distribution | `scatter.svg` |
| Headline metric + delta + trend | `kpi-tile.svg` |
| Node-and-arrow diagram, flow, architecture | `diagram-flow.svg` |

**Workflow**: pick template → substitute data and recompute coordinates (show your scale math in a comment) → apply brand tokens (chrome from the brandbook per `chart-styling.md`; series 1 = accent) → rename all `id=""` attributes with a per-chart slug → verify. To verify visually, write the SVG into a minimal HTML page and screenshot it with the Playwright browser tools (as in the draw.io loop below); check for label collisions, clipped text at the viewBox edges, and dark-mode legibility. If no browser tools are available, deliver anyway and say the visual check was skipped.

**Delivery**: inline `<svg>` for HTML pages (inherits page theme via CSS custom properties); standalone `.svg` file needs the `xmlns` attribute and self-contained `<style>` (templates have both). For export to PNG/PPTX, bake literal hex — `var()` doesn't survive rasterizers.

---

## Medium 3: draw.io

Editable, enterprise-grade diagrams via the bundled draw.io MCP's `open_drawio_xml` tool (load it via `tool_search` for "drawio" — the exact tool name varies by install) with the curated style catalog.

### Before You Start

1. **Read the style reference**: `view` the file at `references/styles.md` in this skill's directory. It contains every style string, color constant, and element template you need.
2. **Load the draw.io MCP**: Call `tool_search` with query `"drawio"` to ensure the `open_drawio_xml` tool is available. The plugin bundles the official `@drawio/mcp` server, so the tool is present wherever the plugin is installed (npx fetches it on first use). If the tool truly can't be found, fall back to writing the `.drawio` XML to a file and tell the user to open it in draw.io.
3. **Clarify scope** with the user if the request is ambiguous — ask whether they want a full layered reference architecture or a focused subsystem view.

### Template Selection

Consult `templates/` to start from a template instead of building from scratch:

| Request type | Template |
|---|---|
| Process flow, flowchart, decision flow | `templates/flow.xml` |
| Message passing, API sequence, interaction | `templates/sequence.xml` |
| Reference architecture, system design, layers | `templates/architecture.xml` |
| Org chart, hierarchy, reporting structure | `templates/orgchart.xml` |

Start by reading the appropriate template and adapting node labels, counts, and connections.

### Workflow

1. **Plan the layout** — grid of 10px multiples, layered vertical gravity, per-type arithmetic (flow / sequence / org chart / reference architecture): follow **`references/drawio-layout.md`** §Layout planning. It also holds the XML build rules (center-alignment invariant, no doglegs, page bounds, label backgrounds), a minimal example, and per-type sizing.
2. **Choose element styles** from the catalog in `references/styles.md` — every style string, color constant, and element template. **Generated XML must use static hex** — substitute the first (light) value wherever the catalog shows `light-dark(...)`; the function itself renders invisible elements.
3. **Build the XML** per `drawio-layout.md` §Building the XML, starting from the closest template above.
4. **Render**: call the draw.io MCP's `open_drawio_xml` with the complete XML string; set `dark` to `"false"` (the styles are designed for light mode). No MCP? Use `drawio-layout.md` §Rendering without the draw.io MCP.
5. **Verify visually** (max 3 rounds, browser tools via `tool_search`; if none are available, deliver anyway and say the check was skipped): the issue→fix table and patch strategy are in `drawio-layout.md` §Visual verification loop.

Supported diagram types (reference architectures, subsystem views, data platforms, integration topologies, deployments, flows, sequences, org charts) and the quality tips (width consistency, vertical rhythm, arrow discipline, container nesting) are cataloged at the end of `drawio-layout.md`.
