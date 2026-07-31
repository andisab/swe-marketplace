# Hand-Authored SVG — Charts & Diagrams

How to draw data charts and diagrams as raw inline SVG for HTML embedding — no JavaScript, no chart libraries. Templates in `templates/svg/` demonstrate every rule here; adapt a template rather than starting blank.

Brand colors come from the registry: chrome/series mapping per **brandware `references/chart-styling.md`** (data charts) and **`consumer-mappings.md` §chartware** (diagrams). This file is the *mechanics* layer: coordinates, paths, text, theming, and the failure modes.

## 1. Setup: viewBox, margins, embedding

**Always use a pixel-space viewBox** (`0 0 720 400`), never a normalized `0 0 100 100` — in pixel space `stroke-width="1"`, `font-size="12"`, and `rx="4"` mean what they say; normalized space distorts all three and forces `vector-effect` workarounds everywhere.

| Use | viewBox |
|---|---|
| Full-width chart | `0 0 720 400` |
| Card / half-width | `0 0 480 300` |
| KPI tile | `0 0 260 140` |
| Sparkline | `0 0 120 32` |
| Donut + legend | `0 0 320 200` |
| Diagram | computed from content grid |

**Root element** (every chart):

```svg
<svg viewBox="0 0 720 400" width="720" height="400" xmlns="http://www.w3.org/2000/svg"
     class="cw-bar" role="img" aria-labelledby="<slug>-t <slug>-d" focusable="false"
     preserveAspectRatio="xMidYMid meet"
     style="width:100%;height:auto;max-width:720px;display:block;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <title id="<slug>-t">One-line chart name</title>
  <desc id="<slug>-d">The takeaway and extremes, 1–3 sentences.</desc>
```

- `width`/`height` attributes give the intrinsic ratio (no layout shift); CSS `width:100%;height:auto` makes it fluid; **`max-width` at the nominal width stops text scaling up** past its design size.
- Never `preserveAspectRatio="none"` on anything containing text — it smears glyphs unfixably.
- Font floor: nothing under 10 user units; 11–12 for axis labels. If the container can shrink below ~75% of nominal width, text becomes illegible — author a narrower variant instead.

**Margin convention** — one translated plot group; derive, don't guess:

```
margin.left   = estWidth(widestYLabel) + 10        (see §4 for estWidth)
margin.top    = 16   (+16 if a legend row sits above the plot)
margin.right  = 16–32
margin.bottom = 32   (more if x labels rotate: 0.71 × estWidth + 8)
innerW/H      = viewBox − margins
<g transform="translate(left,top)">                 all math is plot-relative
```

Everything outside the viewBox is **silently clipped** (`overflow:hidden`) — the first/last x labels, topmost value label, and rotated labels are the usual casualties. Check label extents against the margins before finalizing.

## 2. Scales, ticks, gridlines

```
yPx(v) = innerH * (1 − (v − yMin)/(yMax − yMin))    ← the "1 −" inverts y; forgetting it
xPx(v) = innerW * (v − xMin)/(xMax − xMin)             renders the chart upside down
```

**Nice ticks (1-2-5-10 rule)**: `raw = range/targetTicks` → `mag = 10^floor(log10 raw)` → step = mag × (1 | 2 | 5 | 10 by nearest). `targetTicks = clamp(round(innerH/60), 2, 8)`. Extend the domain to the tick boundary (`niceMax = ceil(max/step)*step`). **Bar domains must include zero** (truncated bars lie); line charts may exclude it but then pad the domain 5–10% each side.

**Band scale** (bars): `step = innerW/n`, bar center at `step*i + step/2`. **Point scale** (line x-positions): `step = innerW/(n−1)`. Mixing them misaligns a line drawn over bars by half a band.

Gridlines: horizontal only (vertical charts), vertical only (horizontal bars), both (scatter). 1px in the border/grid token, drawn **before** marks, in a `<g shape-rendering="crispEdges">` (crispEdges snaps them to the pixel grid at any scale — but never apply it to circles, arcs, or rounded corners; they go blocky). The **zero baseline gets its own darker line**, drawn last. Skip the y-axis domain line entirely.

## 3. Marks by chart type

Full worked math lives in the templates; the rules:

**Bars** (`bar-grouped.svg`): band padding 0.2 (gap = 25% of bar width; 0.35 for ≤5 fat categories, 0.1 for 30+ columns); cap width at 64px. `y = min(yPx(v), yPx(0))`, `height = abs(yPx(v) − yPx(0))` — **a negative rect height renders nothing** (the #1 bar bug). Nonzero values that map under 1px get 1px. Round the **top corners only** via path (rect `rx` rounds all four):

```
M{x},{y+h} L{x},{y+r} A{r},{r} 0 0 1 {x+r},{y} L{x+w−r},{y} A{r},{r} 0 0 1 {x+w},{y+r} L{x+w},{y+h} Z
r = min(4, w/2, h)          ← clamp by h or short bars glitch
```

Grouped: subdivide the band, sibling gap ≈ 0.08×barW; >4 series → small multiples. Stacked: accumulate, 1–2px background-colored gap between segments (kills anti-aliasing seams), round only the top segment.

**Horizontal bars** (`bar-horizontal.svg`): for long labels or n > 8. Sort descending. Round the right end only. Value labels outside the bar end; flip inside (`text-anchor="end"`, light fill) when `barEnd + estWidth + 6 > innerW`.

**Lines** (`line-area.svg`): `fill="none"` is mandatory (default fill is black → blob). 2–2.5px, `stroke-linejoin="round" stroke-linecap="round"`. Gaps in data = new `M` subpath, never interpolate silently. Smooth only continuous data, with the **flat-tangent cubic** (cannot overshoot in y, unlike Catmull-Rom):

```
C {x1+dx/2},{y1} {x2−dx/2},{y2} {x2},{y2}        dx = x2 − x1
```

Area fill = line path + `L{xEnd},{innerH} L{x0},{innerH} Z`, filled with a vertical fade (§6). Comparison/prior series: muted tone + `stroke-dasharray="6 3"` — the dash doubles as a non-color encoding.

**Donut** (`donut.svg`): stroke-dasharray on circles with **r chosen so C = 2πr is a round number** (r=63.66 → C=400 → 1% = 4 units); `rotate(−90 cx cy)` starts at 12 o'clock. Outer edge = `r + strokeWidth/2` — size the layout to that. Ring thickness 18–25% of diameter. ≤5 slices + muted "Other", sorted descending; headline number in the hole. **A 100% segment renders nothing** as an arc/dash — special-case to a plain circle; same at 0%. Arc-path form (needed for pies/exploded slices): outer arc `sweep=1`, inner return arc `sweep=0`, `largeArc = sweep>180°`; wrong inner sweep = bowtie.

**Scatter** (`scatter.svg`): r 3.5 (2.5 when n>200), `fill-opacity=".65"` + 1px background-colored stroke halo. Bubble size encodes by **area**: `r = rMax·sqrt(v/vMax)`. Trend line = hand least-squares, dashed muted.

**Sparklines / KPI tiles** (`kpi-tile.svg`): no axes/grid/labels; inset the y-range 2–3px so peaks don't clip; dot on the last point only; value in `tabular-nums`; delta triangle as a path, not a ▲ glyph; delta color is per-metric semantic (churn down = good), not per-sign. Side-by-side sparks must share a y-domain.

**Heatmap**: cell 20–36px, 2px gap, `rx 2`; 5–7 **discrete** buckets (quantile for skewed data), never a continuous ramp; in-cell values only when cell ≥ 32px; missing cells get a hatched/outlined rect — an absent rect reads as zero.

## 4. Text

- **Never rely on `dominant-baseline`** (dropped by rasterizers, historically inconsistent). Use the alphabetic baseline + `dy`: **`0.32em`** = vertically centered on `y` (axis labels, in-bar, donut center) · **`0.71em`** = top-at-`y` (x labels below axis) · **`−0.25em`** = bottom-at-`y` (labels above bars).
- Anchors: y-ticks `end` at `x=−8`; x-ticks `middle` at band/point centers; values-after-bars `start`.
- **Width estimate** (no measurement exists without a DOM): `estWidth ≈ fontSize × 0.60 × charCount` (numerals; 0.58 mixed, 0.62 for safety). Drives the left margin, rotation decisions, inside/outside label flips.
- Rotation decision: fits in `step−4` → horizontal; fits in `2.2×step` → `rotate(−45)` + `text-anchor="end"`; else drop every k-th label. Prefer, in order: shorten labels → thin ticks → **switch to horizontal bars** → rotate.
- `<text>` **never wraps** — break lines yourself into `<tspan x="…" dy="1.2em">`.
- Numbers: one scale per axis (never `900` next to `1.2K`), ≤3 significant digits on ticks, currency symbol on the top tick or axis title only, `font-variant-numeric:tabular-nums` for aligned columns of digits.
- **Label halo** over gridlines/fills: `paint-order="stroke fill"` + `stroke:var(--cw-bg)` width 3 + `stroke-linejoin="round"` — paints the halo *under* the glyph fill so letterforms stay intact.
- Legends: always present for ≥2 series (a single series is named by the title); ≤4 series also get direct labels. Text wears ink/muted tokens — never the series color; the swatch carries identity.

## 5. Theming: the token block

Every template carries this three-layer pattern — local defaults, dark-mode flips, page-token passthrough:

```css
.cw-bar { --_ink:#111827; --_muted:#6B7280; --_grid:#E5E7EB; --_bg:#FFFFFF; --_c1:#4969E1; }
@media (prefers-color-scheme: dark) {
  .cw-bar { --_ink:#E6E9EF; --_muted:#9CA3AF; --_grid:#2A2F3A; --_bg:#0B0E14; --_c1:#7B96F0; }
}
.cw-bar { --cw-ink:var(--ink,var(--_ink)); --cw-grid:var(--border,var(--_grid));
          --cw-c1:var(--accent,var(--_c1)); /* … */ }
```

- Inlined in a knowledgebase page (or any page defining `--ink/--muted/--border/--bg/--accent`), the chart **inherits the page theme and flips with its light/dark toggle** automatically. Standalone, the media query handles dark mode.
- The dark palette is a *different* palette (lightened, desaturated series; darker-not-inverted grid), never a mechanical inversion.
- **Every `var()` needs a fallback** — `fill: var(--x)` with `--x` undefined computes to black slabs.
- Rasterization warning: `var()`, `prefers-color-scheme`, and often `currentColor` don't survive SVG→PNG/PPTX pipelines (librsvg/resvg implement partial CSS). For export, bake literal hex (brandbook light values) — same rule as chartware's draw.io `light-dark()` note.
- A `<style>` inside inline SVG is **document-global**: namespace every selector under the chart class (`.cw-bar .grid`, not `.grid`). Identical class names across two instances of the same template are harmless (identical rules); **`id`s are not** — `url(#fade)` resolves to the first match in document order, so every gradient/pattern/clip id gets a per-chart slug. This is the most insidious multi-chart bug.
- `currentColor` for single-color marks (sparklines, icons) inherits the surrounding text color — free theming when inlined. Useless inside `<img>`-embedded SVG (no inheritance; resolves black) — which is also why standalone files need their own `<style>` and font stack.

## 6. Gradients, patterns, clips, polish

- Area fades: `<linearGradient gradientUnits="userSpaceOnUse" x1=0 y1=0 x2=0 y2={innerH}>`, stops `stop-opacity` 0.28→0. **`userSpaceOnUse` is required** — the default objectBoundingBox renders nothing on a flat series (zero-height bbox) and desyncs multiple areas. `objectBoundingBox` is fine for self-contained shapes (tile backgrounds).
- "Projected/estimated" bars: tinted base rect (`fill-opacity=".18"`) + hatch overlay — `<pattern width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` containing one vertical line in `currentColor`; set `color` on the consuming rect to reuse **one** pattern across all series colors. Pattern gaps are transparent — the base rect is not optional.
- Clip smoothed/truncated lines to the plot: `<clipPath id="<slug>-plot"><rect …/></clipPath>` on the marks *group* — keep axis labels outside it.
- Skip drop shadows on data charts. Where one is warranted (tile, tooltip card): one `feDropShadow dy="1" stdDeviation="2"` with the filter region widened (`x="-20%" y="-20%" width="140%" height="140%"` — the default region clips the blur), applied to a group, never per-mark.
- Free interactivity, no JS: `<title>` inside a mark = native hover tooltip (see templates); hover dimming via `.chart:hover .bar { opacity:.45 } .chart .bar:hover { opacity:1 }`. Gate any CSS animation behind `prefers-reduced-motion`.

## 7. Accessibility

The reliable pattern is on every template root: `role="img"` + `<title>` (first child) + `<desc>` + `aria-labelledby` naming both ids + `focusable="false"`. The `<desc>` states the takeaway and extremes, not "a bar chart of data". Never encode by color alone — dash patterns, direct labels, or markers carry the second channel. Text ≥4.5:1 contrast; adjacent data marks ≥3:1. More than ~10 points, >2 series, or exact-values-matter → add a real `<table>` (visually-hidden or in `<details>`), not `display:none`.

## 8. Chart-design guardrails (not SVG bugs — worse)

Zero-based bars; no dual y-axes (two stacked charts sharing an x-axis instead); sorted rankings; ≤6 pie slices and only for parts-of-whole; no smoothing categorical/sparse data; comparison series in muted gray, not a second loud hue; sequential ramps = one hue light→dark, diverging = two hues + neutral gray midpoint at the meaningful zero; squint test — structure first, one brand accent second, no rainbow.

## 9. Diagrams in SVG

See `templates/svg/diagram-flow.svg` for the working example of everything below.

**Canvas & grid**: `viewBoxWidth ≈ the typical rendered pixel width` so font units read as pixels (`renderedFontPx = fontUnits × containerPx/viewBoxWidth`; smallest label must land ≥ 11px — a 1600-unit canvas in a 720px column renders 12-unit text at an unreadable 5.4px). For an 800–900px content column that means a ~900-unit canvas. Prefer restructuring taller-not-wider over shrinking; genuinely wide content goes in an `overflow-x:auto` wrapper with `min-width` on the SVG. Snap coordinates to multiples of 4 (ideally 8); pad the viewBox 16–24 units on all sides (strokes center on geometry — a shape flush with the boundary loses half its stroke). Node sizes: card 200×76, standard 180×64, compact 150×52, chip 120×40. Column pitch = width + 80, row pitch = height + 72.

**Class system** (the pattern proven in large HTML field guides): semantic node/label classes styled once in the scoped `<style>` block — geometry in markup, appearance in classes:

```css
.node        { fill:var(--cw-panel); stroke:var(--cw-border); stroke-width:1.5; }
.node-accent { fill:var(--cw-c1); fill-opacity:.12; stroke:var(--cw-c1); stroke-width:1.5; }
.node-soft   { fill:var(--cw-muted); fill-opacity:.06; stroke:var(--cw-border); }
.node-ok / .node-warn / .node-bad  { same shape, semantic stroke + 12–16% tint fill }
.group       { fill:var(--cw-muted); fill-opacity:.04; stroke-dasharray:6 4; }   /* container */
.edge        { fill:none; stroke:var(--cw-edge); stroke-width:1.75; stroke-linecap:butt; }
```

Use `fill-opacity` for tints, **not** `opacity` (which washes out the stroke too). Three stroke widths max: 1 (containers/hairlines), 1.5 (node borders), 1.75–2 (edges/emphasis). `rx`: cards 8, chips 6, pills h/2, containers 12–14. Follow §chartware's restraint rules: surface fills + categorical strokes, accent in ≤2 roles, never saturated fills. **Every shape gets an explicit `fill` or `fill="none"`** — the initial fill is black. Keep all node/edge geometry in **absolute coordinates with no transforms** (moving a node = one-number edit; `<use>`/translated groups break edge math) — `<defs>` reuse is for markers, gradients, patterns, and icons only.

**Text in nodes**: `x` = node center, `text-anchor:middle`, `y = cy + 0.35×fontSize` (single line); *n* lines start at `cy − (n−1)·1.25F/2 + 0.35F` with `<tspan x="{cx}" dy="1.25em">` — **repeat `x` on every tspan** or the lines staircase. 13px labels, 11px sublabels/edge labels, 10px uppercase lane labels with `letter-spacing:.08em`. Rotate lane labels about their own anchor: `transform="rotate(-90 x y)"` (attribute form — CSS `transform-origin:center` uses the whole viewBox unless you set `transform-box:fill-box`).

**Arrowheads — the trap first**: markers do **not** inherit from the edge that references them; `currentColor`/`var()` inside a marker resolves against the marker's own ancestors, so an arrowhead cannot vary per edge that way, and `context-stroke` is still unsupported in Safari. **Define one marker per semantic edge color**:

```svg
<marker id="<slug>-arrow" viewBox="0 0 10 10" refX="10.5" refY="5"
        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 Z" fill="#94A3B8" style="fill:var(--cw-edge,#94A3B8)"/>
</marker>
```

`refX` past the tip (10.5 for a tip at 10) insets the arrow so the line never pokes through; `orient="auto-start-reverse"` lets the same marker serve `marker-start`. Keep markers fill-only (no stroke), and **`stroke-linecap:butt` on arrowed edges** — round/square caps extend past the endpoint and poke through the tip.

**Edge routing**: attach at N/S/E/W midpoints of the rect (top-to-bottom flows connect S→N, left-to-right E→W); fan *n* exits from one side at `w·i/(n+1)`, never stacked. Straight where possible. Orthogonal elbows: route through the row/column gutters, corner radius `r = min(8, |dx|/2, |dy|/2)`, rounded with the **corner vertex as a `Q` control point** (`L x,(ym−r) Q x,ym (x±r),ym` — no arc sweep-flag reasoning needed). Smooth curves between nodes: cubic with control offset `k = clamp(0.45×|axis distance|, 40, 160)` along the departure axis (`C (x1+k),y1 (x2−k),y2 x2,y2` for E→W). Keep edges ≥8 units clear of node boxes; ≤2 crossings per diagram.

**Edge labels**: positioned `<text>` + the paint-order halo (`paint-order:stroke; stroke:var(--cw-bg); stroke-width:4` — the halo is the *background token*, never literal white), offset ~10 units perpendicular from the line, on the long segment of an elbow. `<textPath>` only for organic curves (it flips on right-to-left segments).

**Flow animation** (the draw.io `flowAnimation=1` equivalent) — the keyframe offset **must equal the dash period** (8+6=14) or the loop jumps; gate on `no-preference` so static is the default:

```css
@media (prefers-reduced-motion: no-preference) {
  .edge-flow { stroke-dasharray:8 6; animation:cw-flow 1.2s linear infinite; }
  @keyframes cw-flow { to { stroke-dashoffset:-14; } }
}
```

**Embedding**: inline `<svg>` gets page CSS, page tokens, hover, and manual theme toggles; `<img src=".svg">` gets none of those — internal `<style>` and CSS/SMIL animation still work, but `prefers-color-scheme` sees only the **OS** setting (a site's manual dark toggle won't reach it) and external fonts are blocked (use a system stack, brand font first: `font-family="Inter, ui-sans-serif, …"`). Don't use `shape-rendering:crispEdges` on diagrams — it staircases the curves and diagonals; that hint is for chart gridlines only.
