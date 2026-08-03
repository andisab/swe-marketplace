# slideware — PowerPoint format (pptx)

Format guide for `.pptx` output. Read [../SKILL.md](../SKILL.md) first for format choice and style resolution — this file covers the pptx-specific mechanics: **pptxgenjs + React + react-icons + sharp** (Node.js), producing a real `.pptx` that opens cleanly in PowerPoint, Keynote, and Google Slides.

## Reference map

| Need | Read |
|------|------|
| Concrete examples (start here) | [references/canonical-samples.md](references/canonical-samples.md) — 3 working samples in `assets/samples/` |
| End-to-end workflow (fast + full paths) | [references/workflow.md](references/workflow.md) |
| 12 layout archetypes | [references/layout-patterns.md](references/layout-patterns.md) |
| Visual principles (hierarchy, color, type, spacing) | [references/visual-principles.md](references/visual-principles.md) |
| pptxgenjs API patterns | [references/pptxgenjs.md](references/pptxgenjs.md) |
| Brandbook → token mapping | [../../brandware/references/brandbook-spec.md](../../brandware/references/brandbook-spec.md) |

**Recommended order**: canonical-samples (concrete > abstract) → layout-patterns → visual-principles → pptxgenjs (when you hit a specific API question).

## Pitfalls (single canonical home — read once, refer back)

- **Colors are 6-char hex WITHOUT `#`** — `"FAF9F5"`, not `"#FAF9F5"`.
- **Don't reuse option objects** across `addShape`/`addText` calls. pptxgenjs mutates in-place. Inline or use factory functions.
- **`rectRadius` only works on `ROUNDED_RECTANGLE`**, not `RECTANGLE`.
- **Shadow `offset` must be ≥ 0.** For upward shadows, use `angle: 270` with positive offset.
- **NEVER use `addShape(LINE, { h: 0 })` or `{ w: 0 }`** for hairlines. pptxgenjs serializes this as `<a:ext cy="0"/>` (or `cx="0"`) — LibreOffice tolerates it (so preview rendering and visual review pass), but **PowerPoint rejects it on open** with a "needs repair" dialog and removes the shape on repair. Use a thin filled rectangle instead: `addShape(RECTANGLE, { x, y, w, h: 0.012, fill: { color }, line: { type: "none" } })` for horizontal hairlines, `w: 0.012` for vertical. `polish-deck.py` now flags this as `invalid_dimensions [high]`.
- **Validate `w` and `h` are positive** before passing to `addShape`. Negative values come from math like `h: endY - startY` when end < start — PowerPoint rejects negative dimensions.
- **`charSpacing` is pt-scale, NOT em/percent.** Sane range **1–5**. Values ≥10 explode text to one char per line.
- **`charSpacing`**, not `letterSpacing` (the latter is silently ignored).
- **Multi-line text needs `breakLine: true`** on each segment.
- **Unicode bullets in plain strings create DOUBLE bullets** — use `{ bullet: true }` in options.
- **No gradient fills** — use a gradient image background instead.
- **LibreOffice is optional** — it powers preview rendering only. Without it, build and deliver the deck, say the visual check was skipped, and point the user to the plugin README's "Optional tooling" section.

The pre-render alignment checklist lives in `assets/templates/starter-deck.js` as comments — read it there *while* writing slide code, not abstractly here.

## Two paths

| Path | When | Cycle |
|---|---|---|
| **Fast** | 1-3 slides, throwaway, prototype | scaffold → author → build → polish-check → ship |
| **Full** | ≥4 slides, anything shipped | + render → inspect every PNG at full size → find ≥1 issue → iterate 2-3× |

See [workflow.md](references/workflow.md) for both. Don't pay the full-path tax on a throwaway deck.

## Anti-monotony rule

Shared rule in [../SKILL.md](../SKILL.md). The 12 pptx archetypes live in [references/layout-patterns.md](references/layout-patterns.md).

## Output convention

Default `<cwd>/deck.pptx` unless the user specifies. Print the absolute path after writing.

**Iterating on a previously delivered deck? Diff the live file first.** Users hand-edit delivered .pptx files between requests. Before rebuilding/overwriting, extract the current file (`python -m markitdown`) and diff against your last build; back-port their edits (and any added images) into the build script or the rebuild will silently destroy them. Details in [references/workflow.md](references/workflow.md) § "Updating an existing pptx".

## Sample-deck mimicry (style only, never content)

When the user provides a sample `.pptx`:

```bash
bash scripts/render-slides.sh <sample.pptx> ./sample-preview/
python -m markitdown <sample.pptx> > ./sample-text.md
```

Read 3-4 representative slide PNGs. Derive palette, type pairing, layout patterns, motif, density. Apply to the new deck. **Don't copy content.**

**Mimicry overrides anti-monotony.** If the sample has a distinctive non-standard layout (Swiss-cheese stacked bars, unusual asymmetric editorial blocks, custom chrome patterns), faithfully echoing *that* layout matters more than picking from the canonical 12 archetypes. The user picked this sample because they wanted *its* look — including the parts that don't fit a textbook pattern. Reach for the unusual layout the sample uses; the standard 12 are a fallback when the sample doesn't suggest anything specific.
