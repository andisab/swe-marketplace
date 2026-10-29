# Consumer contract and index

Brandware defines what a style and a brandbook are (`brandbook-spec.md`), lists what's installed (the registry), says which one applies when nothing is named (the markers), and helps make new ones. Everything that *renders* a brand is a **consumer**: an adapter from that standard into its own medium. This file is what every consumer owes, the intent each medium must honour, and the index of where each consumer keeps its mapping.

## What every consumer does

1. **Resolves by name through the registry** (SKILL.md §Resolution contract): the user's `$KNOWLEDGEWARE_BRANDS_DIR`, then `styles/brands/`, then the five styles; never a path to a token cache.
2. **Honours the markers when nothing is named**: `.knowledgeware` in the project, then `DEFAULT` (the user directory's wins), and says which identity it resolved to. Only when no marker resolves does it use its own fallback, and it says so.
3. **Loads through the loader** (`scripts/load-style.js`, or the html converter that imports it), reading the brandbook's prose for anything richer than the tokens carry: heading colours, reserved faces, diagram categories, distinctive treatments. The `.md` is canonical.
4. **Uses the brandbook's extras when they're there**: logos from `assets/` (slideware's running footer), a stylesheet from `css/` for pages a skill doesn't build, starters. A style without them renders without them.
5. **Degrades gracefully** (SKILL.md rule 3): with no brand installed it works from its bundled defaults, and a brand named but missing is reported, never improvised.
6. **Keeps its mapping next to its code**: the table of tokens to variables, options or style strings lives in the consumer's own guide, where it changes with the implementation, and is listed in the index below. Brandware's audit checks consumers against the intent rules here, not against their tables.

## Intent per medium

What a token role means in each medium. A consumer's mapping implements these; a brand author reads them to know how the brand will look everywhere.

- **Decks (slideware, both formats):** tokens verbatim. `bg` is the canvas and `bgDark` the hero canvas; `accent` is for kickers, stats and the few things that must be seen, never a wash; headings take the face the brandbook assigns to headlines, which is the serif only when the brandbook says so; sizes come from `type.*Pt`. The brand's logo files go in the running footer. One brandbook renders in both formats without edits: pptx wants bare hex and points, html wants `#` and CSS units, and the loaders do that conversion.
- **Knowledgebase pages:** the template is variable-driven, so retheming touches only the `:root` blocks and the Mermaid init. `surface` and `surfaceAlt` are panels, `accent` is navigation and emphasis (darkened for links), `success` and `warning` tint the callouts. A dark palette is used when the brandbook has one and derived conservatively when it doesn't, and the page says which.
- **Diagrams (chartware):** tastefully coordinated, understated. A branded diagram reads as the brand's document, not a poster of its colours. Neutral ink carries the structure; the accent annotates it in at most two roles (primary edges, or the one highlighted node) and never as a background wash. Containers are outlined, not filled; fills are reserved for decision nodes (accent at ~20% tint) and header bars. Loud accents are tinted to 10–15% over the canvas for fills and kept pure for edges and labels only.
- **Data charts (any medium):** `chart-styling.md` in this folder: how a brandbook's palette becomes categorical, sequential and diverging series colours, chrome and stat tiles.

## Index

| Consumer | Consumes | Mapping lives in |
|---|---|---|
| slideware pptx | tokens JSON from `scripts/load-style.js` | `skills/slideware/pptx/references/pptxgenjs.md` §Brand tokens → pptxgenjs |
| slideware html | `style.md` from the html converter (frontmatter = the tokens) | `skills/slideware/html/FORMAT.md` §Token → CSS mapping |
| knowledgebase | palette + type → template CSS variables + Mermaid themeVariables | `skills/knowledgebase/references/brand-mapping.md` |
| chartware | palette + diagram strokes + type → mxGraph style strings; Mermaid via the knowledgebase block | `skills/chartware/references/brand-mapping.md` |
| data charts (any consumer) | palette → series and chrome colours | `references/chart-styling.md` (here) |

## Adding a consumer

Resolve per §What every consumer does, honour the intent for your medium (add a paragraph above if the medium is new), keep your mapping in your own guide, add a row to the index, and run acceptably with no brand installed.

## Planned: per-consumer extension folders (not implemented)

A brand sometimes needs more than tokens in one medium: the Enterprise Enablement decks, for instance, render in a design kit whose theme stylesheet and extra layouts were spliced into a copy of the HTML deck builder. The intended shape is an optional folder per consumer inside the brand (`<brand>/slideware-html/`, `<brand>/knowledgebase/` …) holding what that consumer knows how to apply: a theme stylesheet, extra layouts, a starter. The consumer looks for its folder and applies it when present; a brand without one renders from tokens alone. Nothing reads these folders yet. When a consumer implements its slot, it documents the folder's contents in its mapping guide and this paragraph moves into §What every consumer does.
