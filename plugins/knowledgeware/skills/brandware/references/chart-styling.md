# Chart Styling from a Brandbook

How to color and typeset **data charts** — bar, line, area, pie/donut, scatter, heatmap, KPI/stat tiles — so they read as the brand's document in any medium (slideware decks, knowledgebase pages, standalone SVG/HTML). This complements `consumer-mappings.md` (§chartware covers *diagrams*; this file covers *data*).

Same governing principle as diagrams: **neutral ink carries the chart; accents encode data.** A branded chart is recognizable by its canvas, type, and one accent — not by every series screaming a logo color.

## Chrome (everything that isn't data)

| Chart element | Brandbook token | Notes |
|---|---|---|
| canvas / plot background | `palette.bg` (or `surface` when the chart sits on a card) | never a tint of the accent |
| gridlines | `palette.border` at 50–70% opacity | horizontal only for bar/line; drop entirely on small charts |
| axis lines | `palette.border` (baseline may use `inkMuted`) | |
| axis tick labels | `palette.inkMuted`, `type.sans`, 10–12pt equivalent | |
| axis titles / legend text | `palette.inkBody` (fallback `ink`) | |
| chart title | `palette.ink`, heading treatment of the medium | |
| data labels on marks | `palette.ink` outside marks; bg-contrast color inside filled marks | |
| tooltips / callouts | `surface` fill, `border` stroke, `ink` text | |

## Categorical series colors (the important part)

1. **If the brandbook defines diagram/categorical colors, use them verbatim** (e.g., AAB defines Application `#A9C4EB`, Security `#EA6B66`, Ops `#99CCFF`, Data `#7FB069`, Neutral `#808080`). Brandbook-defined semantics beat derived palettes.
2. **Otherwise derive 4–6 in this order**: `accent` → `accent2` (or accent rotated ~40° in hue, same lightness band) → `success` → `warning` → `error` → `inkMuted`. Adjust lightness so no two adjacent series differ mainly by saturation.
3. **Series 1 is the brand accent.** In a single-series chart, the accent is the only data color — this alone makes the chart read as branded.
4. **Comparison-vs-baseline**: current/ours = `accent`; prior/benchmark/other = `inkMuted` or `border`-tone gray. Never two loud colors fighting.
5. Keep **semantic colors semantic**: `success`/`error` only where the data means good/bad, not as filler hues.

## Sequential and diverging scales

- **Sequential** (heatmaps, choropleths, magnitude): ramp from a ~10% tint of `accent` over `bg` up to `accent` darkened ~20%. Keep hue constant; vary lightness. 5–7 steps max.
- **Diverging**: `error` ↔ neutral (`bg`-tone) ↔ `accent` (or `success` when polarity means good/bad). Midpoint must sit at the meaningful zero, not the data mean.

## Marks

- **Bars**: solid fill, no stroke (or 1px `bg` stroke when stacked). Corner radius ≤ the brandbook's `radius`; square if the brand is square.
- **Lines**: 2–2.5px, no drop shadows; markers only at annotated points. Area fills = line color at 10–15% opacity.
- **Pie/donut**: ≤5 slices (aggregate the tail into `inkMuted` "Other"); donut hole shows the headline number in `ink`.
- **KPI/stat tiles**: number in `ink` (or `accent` for the single hero metric), label in `inkMuted`, delta in `success`/`error`. Tile = `surface` fill, `border` stroke, brandbook radius.

## Typography

Everything in `type.sans` — including numbers on a serif-headed brand (serifs are for headings, not axis labels). Use tabular/lining figures where the medium supports it. Minimum readable sizes: ~10pt in decks, 12px on pages.

## Dark canvas

When charting on `bgDark` (or a dark brand like style-3/linear): raise gridline opacity slightly, lighten the accent ~10–15% if contrast against the canvas falls below 3:1, and prefer outlined/hollow markers over filled ones. Never pure white text — use the brandbook's dark-context ink.

## Per-medium notes

- **slideware**: build charts as native pptxgenjs shapes/charts or pre-rendered SVG→PNG; colors are 6-char hex WITHOUT `#`. The deck's style tokens are already loaded — reuse them, don't re-derive.
- **knowledgebase**: inline SVG or CSS-driven bars inherit the page's `:root` variables — reference `var(--accent)`, `var(--border)`, `var(--muted)` so charts flip correctly with light/dark theme. Mermaid is for diagrams, not data charts.
- **chartware**: draw.io is a diagramming surface; use it for data charts only when the user explicitly asks — then apply this palette logic to the mxGraph `fillColor`/`strokeColor` values.

## Squint test

Render, squint: you should perceive **structure first, one brand accent second, and no rainbow**. If three or more saturated hues compete in a chart with fewer than three semantic categories, it's over-colored — demote all but the lead series to grays.
