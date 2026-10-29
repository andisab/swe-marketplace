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

A brand or style the user names ("in the AAB style", "AcmeCorp-branded") resolves through the registry per the **brandware skill's resolution contract** (`../brandware/SKILL.md` §Resolution contract: the user's brands directory, then the plugin's brands, then the five generic styles; when nothing is named, the `.knowledgeware` and `DEFAULT` markers, telling the user what they resolved to). Substitute its palette and typography per this skill's `references/brand-mapping.md` (the intent it implements: brandware's `references/consumer-contract.md`). The mapping is deliberately understated — surface fills with categorical strokes, brand accent in at most two roles, low-saturation tints; a branded diagram should read as the brand's document, not a poster of its colors. For data charts (bars, lines, KPIs) follow brandware's `references/chart-styling.md`. This skill's own fallback, when no brand is named or installed and no marker resolves: each medium's default styling below, and say so.

---

## Medium 1: Mermaid

For flowcharts, sequence diagrams, state machines, ER diagrams, gantt charts, and quick architecture sketches that live in text.

**Embedding**: ` ```mermaid ` fences in markdown and artifact pages; `<pre class="mermaid">` blocks in HTML that loads mermaid (knowledgebase pages do). If a mermaid validation/render tool is available (`tool_search` for "mermaid"), validate the syntax before delivering; otherwise double-check quoting — labels with `()`, `/`, or `:` need `["..."]` quoting.

**Branding**: apply the brandbook via an init block using the themeVariables block in the knowledgebase skill's `references/brand-mapping.md`: `primaryColor` = ~12% accent tint over bg · `primaryBorderColor` = accent · `primaryTextColor` = ink · `lineColor` = ink at ~70% (never the accent — edges recede) · `edgeLabelBackground` = bg · `fontFamily` = brand sans:

```
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#EDF0FC","primaryBorderColor":"#4969E1","primaryTextColor":"#111827","lineColor":"#4B5563","edgeLabelBackground":"#FFFFFF","fontFamily":"Inter, sans-serif"}}}%%
```

**Discipline**: keep node labels short (wrap with `<br/>`); prefer `flowchart TD/LR` direction that matches reading order; subgraphs for layers/containers; don't fight the auto-layout — if you're adding invisible edges to force positions, switch to SVG or draw.io and say so.

---

## Medium 2: SVG (charts & figures)

Hand-authored inline SVG — the default medium for **data charts**, and the right one for polished diagrams embedded in HTML.

**Read `references/svg-charts.md` before drawing** — it holds the mechanics: pixel-space viewBox + margin convention, scale/tick math (1-2-5-10), per-chart-type geometry (rounded-top bar paths, flat-tangent curve smoothing, the C=400 donut trick), text rules (`dy="0.32em"`, width estimation, halos), the three-layer theming token block (page-token inheritance + dark mode), accessibility pattern, and the pitfall list.

**Pick the size first** when the chart leaves the page: `references/svg-charts.md` §1 lists the presets (document, HTML slide 1280×720, PowerPoint 960×540, 4:3, social card, print) with each one's font floor, margins and export rule. **Start from a template** in `templates/svg/` and adapt data, scales, and labels:

| Request | Template |
|---|---|
| Vertical bars, grouped comparison | `bar-grouped.svg` |
| Ranking, long labels, n > 8 | `bar-horizontal.svg` |
| Trend over time, with comparison series | `line-area.svg` |
| Parts of a whole, share breakdown | `donut.svg` |
| Correlation, distribution | `scatter.svg` |
| Headline metric + delta + trend | `kpi-tile.svg` |
| How a total moved: start, steps up and down, end (bridge) | `waterfall.svg` |
| Two dimensions × a magnitude (weekday × hour, team × month) | `heatmap.svg` |
| Change between two periods for several categories | `slopegraph.svg` |
| Before and after per item (two points, one gap) | `dumbbell.svg` |
| Plan on a time axis: phases, tasks, a milestone, today | `gantt.svg` |
| Flows between two sets of nodes (sources to outcomes) | `sankey.svg` |
| Node-and-arrow diagram, flow, architecture | `diagram-flow.svg` |

**Icons in diagrams** come from `templates/svg/icons.svg`, a sprite of 96 `currentColor` symbols (63 outline icons from Tabler Icons, 33 brand marks from Simple Icons; catalog and usage in `references/icons.md`). Copy the symbols a diagram uses into its own `<defs>` and place them with `<use href="#cwi-…">`, in the muted tone, one per node at most.

**Complexity budget (diagrams)**: before drawing, state the type, the node count and what you'll leave out. One diagram holds at most **9 nodes, 12 edges, 2 accent roles and 2 edge crossings**; a sequence diagram at most 5 lifelines, a swimlane diagram at most 5 lanes. Over budget means the subject needs an overview diagram plus one detail diagram per subsystem, not a bigger canvas. Deleting is the first move: a node that doesn't change what the reader decides goes.

**Workflow**: pick template → substitute data and recompute coordinates (show your scale math in a comment) → apply brand tokens (chrome from the brandbook per `chart-styling.md`; series 1 = accent) → rename all `id=""` attributes with a per-chart slug → **lint** → verify visually.

The lint is `python3 scripts/svg-lint.py <file.svg>` (this skill's `scripts/` folder; no dependencies). It checks what a screenshot shows late or not at all: diagonal edge segments, two edges on the same attach point or on top of each other, an edge running through a node or closer than 8 units to one, more than 2 crossings, an edge label sitting on its line, a node label off its node's centre or wider than the node, anything outside the viewBox or inside the 16-unit padding, fonts under 10, `<tspan>` without `x`, missing markers, duplicate ids, `<style>` selectors not namespaced under the root class, the root's `role`/`<title>`/`<desc>`/`aria-labelledby` wiring, and the complexity budget. It exits 1 on errors; fix those, read the warnings, and only then screenshot. The template idiom is what it reads: class names containing `node`, `edge`, `elbl`, `lbl` and `group`, so keep them.

To verify visually, write the SVG into a minimal HTML page and screenshot it with the Playwright browser tools (as in the draw.io loop below); check for label collisions, clipped text at the viewBox edges, and dark-mode legibility. If no browser tools are available, deliver after a clean lint and say the visual check was skipped.

**Before delivering, check:**
- The lint reports 0 errors, and every warning left is one you can defend.
- One reading order (top-to-bottom or left-to-right), and the main path reads first.
- Every node has a label a stranger can read without the legend; every edge that isn't the obvious flow has one too.
- Accent appears in at most two roles, and the diagram still reads in grayscale (dash, weight and labels carry the second channel).
- Light and dark both legible; nothing inside the 16-unit padding; the `<desc>` states the takeaway.

**Delivery**: inline `<svg>` for HTML pages (inherits page theme via CSS custom properties); standalone `.svg` file needs the `xmlns` attribute and self-contained `<style>` (templates have both). For export to PNG/PPTX, bake literal hex — `var()` doesn't survive rasterizers.

---

## Importing a diagram: extract, digest, redraw, ledger

When the user hands over a diagram that exists already (a `.drawio` file, a Mermaid block, an Excalidraw scene or one of chartware's own SVGs) and wants it in another medium, in the brand, or cleaned up, **redraw it; don't convert it.** A converted diagram keeps the old layout's faults in a new file. The contract has four steps, and the script does the two mechanical ones:

1. **Extract.** `python3 scripts/diagram-digest.py extract <file> --md` writes the digest: the nodes with their labels, shapes and groups, the edges with their labels and styles, and the direction. Nothing about pixels. Read it, then read the original once as a picture if you have browser tools, to catch what the digest can't carry (an icon, a colour that means something, a note in the margin).
2. **Decide the four dials and say them before drawing.** *Format*: the target medium by the fit table above, or the user's choice. *Size*: the preset (§Medium 2). *Detail*: full, or an overview with the budget applied (9 nodes, 12 edges), which usually means merging nodes into groups and dropping edges that don't change what the reader decides. *Audience*: who reads it, which decides the labels. Write the plan as one short paragraph, including what you intend to merge or drop and why.
3. **Redraw** in the target medium from its template, under the normal rules for that medium (brand, routing, budget, lint for SVG). Keep the original's labels verbatim unless the audience dial says otherwise; renames go in the ledger.
4. **Ledger.** `python3 scripts/diagram-digest.py ledger <original> <redrawn> --md` compares the two digests and lists every node as kept, renamed, merged, dropped or added, and every edge as kept, relabelled, dropped or added. Deliver the ledger with the diagram, with one line of reason per dropped or merged row. A ledger with unexplained drops means the redraw isn't finished.

The extractor reads draw.io (including the compressed form draw.io saves by default), Mermaid `flowchart`/`graph` (node shapes, `|label|` and `-- label -->` edges, subgraphs, dashed and thick edges), Excalidraw (bound text, bound arrows, frames) and chartware SVG (the class idiom). Sequence diagrams, Gantt and other Mermaid types aren't parsed; redraw those from the text by hand and write the ledger yourself.

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
