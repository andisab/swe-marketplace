---
name: slideware
description: "Create visually rich, style-driven PowerPoint decks programmatically with pptxgenjs + React icons. Use any time the user asks for a slide deck, presentation, .pptx file, pitch deck, training module, or wants slides generated from a brief/outline. Also use when the user references a 'style' or 'brandbook' (CSS/markdown describing a visual identity), a 'sample deck' to mimic, or asks to update/iterate on an existing pptx (rebuild approach). Trigger on words like 'deck', 'slides', 'presentation', 'pptx', 'pitch', 'keynote', or whenever a .pptx file appears as input or output. The plugin bundles 5 default generic styles (style-1 Editorial Light, style-2 Minimal, style-3 Dark Precision, style-4 Warm Sage, style-5 Material Olive) plus a `styles/brands/` registry for brand-specific brandbooks (managed by the sibling brandware skill). Style + brandbook are interchangeable terms; both are .md files with the same spec. Discovery is filesystem-driven — adding a style or brandbook is a single .md drop. Supports loading custom styles from local paths, Google Drive URLs, or live websites; ingests a sample deck for style mimicry; includes a visual review loop with pre-render polish checks."
license: MIT
---

# slideware

Generate brandbook-driven PowerPoint decks using **pptxgenjs + React + react-icons + sharp** (Node.js). Output is a real `.pptx` that opens cleanly in PowerPoint, Keynote, and Google Slides.

Opinionated about one thing: **don't make boring slides.** Plain bullets on white aren't worth your reader's time.

## Reference map

| Need | Read |
|------|------|
| Concrete examples (start here) | [references/canonical-samples.md](references/canonical-samples.md) — 3 working samples in `assets/samples/` |
| End-to-end workflow (fast + full paths) | [references/workflow.md](references/workflow.md) |
| 12 layout archetypes | [references/layout-patterns.md](references/layout-patterns.md) |
| Visual principles (hierarchy, color, type, spacing) | [references/visual-principles.md](references/visual-principles.md) |
| pptxgenjs API patterns | [references/pptxgenjs.md](references/pptxgenjs.md) |
| Brandbook → token mapping | [../brandware/references/brandbook-spec.md](../brandware/references/brandbook-spec.md) |

**Recommended order**: canonical-samples (concrete > abstract) → layout-patterns → visual-principles → pptxgenjs (when you hit a specific API question).

## Style / brandbook resolution (priority order)

"Style" and "brandbook" mean the same thing here — both are .md files describing a visual identity (palette + type + layout). The skill uses "style" by default; "brandbook" when the visual system mimics a real brand.

Path convention: `$PLUGIN` = the knowledgeware plugin root, two directories above this skill (`../../`). Shared style tooling lives at `$PLUGIN/scripts/`.

1. **Explicit local path** — read directly.
2. **Bundled name** — discovered at runtime from the plugin registry (shadow order: default &lt; brand):
   - `$PLUGIN/styles/*.md` — 5 default generic styles (`style-1` through `style-5`)
   - `$PLUGIN/styles/brands/*.md` — brandbooks (brand-specific; managed by the **brandware** skill; shadows defaults on name collision)

   Run `node $PLUGIN/scripts/list-styles.js` to see the current list (or `--default` / `--brands` / `--names` / `--json`). Pre-built tokens live next to each source: `$PLUGIN/styles/tokens/`, `$PLUGIN/styles/brands/tokens/`.
3. **Website URL** — `node $PLUGIN/scripts/derive-style.js <url> -o ./brand.md` then load. Heuristic; verify against the live site.
4. **Google Drive URL** — `bash $PLUGIN/scripts/fetch-resource.sh <url> <dest>`.
5. **No style given** — pick `style-1` (Editorial Light) and tell the user. Don't fall back to brandbooks unless the user names one.

For custom paths or freshly derived styles: `node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json`.

**Adding a new style** is filesystem-driven: drop `$PLUGIN/styles/<name>.md` (for a generic default) or `$PLUGIN/styles/brands/<name>.md` (for a brandbook — preferred for anything brand-specific, so study-guide and chartware see it too; see the brandware skill for the full authoring workflow, including logo/asset gathering). All follow the spec in `../brandware/references/brandbook-spec.md`. Optionally pre-cache tokens: `node $PLUGIN/scripts/load-style.js <name> -o <same-dir>/tokens/<name>.json`. No code edits needed.

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
- **LibreOffice required** for preview rendering: `brew install --cask libreoffice`.

The pre-render alignment checklist lives in `assets/templates/starter-deck.js` as comments — read it there *while* writing slide code, not abstractly here.

## Two paths

| Path | When | Cycle |
|---|---|---|
| **Fast** | 1-3 slides, throwaway, prototype | scaffold → author → build → polish-check → ship |
| **Full** | ≥4 slides, anything shipped | + render → inspect every PNG at full size → find ≥1 issue → iterate 2-3× |

See [workflow.md](references/workflow.md) for both. Don't pay the full-path tax on a throwaway deck.

## Anti-monotony rule

The point is **content-shape variety**, not visual-archetype rigidity. A deck that walks through one consistent story (a brand pitch, a single hypothesis) can reuse a layout once if doing so reinforces the through-line. A 6-slide *survey* of unrelated topics should use 5-6 distinct archetypes; a 6-slide *narrative* with three parallel proof points can run three card-row slides if that's the actual content structure.

The failure mode to avoid is **reaching for cards because the template defaulted to cards**, not "I reused a layout deliberately." If you reach for the same archetype twice without articulating why, swap one out. See [layout-patterns.md](references/layout-patterns.md) for the 12 archetypes.

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
