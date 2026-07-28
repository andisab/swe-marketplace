# End-to-end workflow

Two paths: **fast-path** for short / throwaway decks, **full-path** for polished decks.

Path convention: `$PLUGIN` = the knowledgeware plugin root (this skill lives at `$PLUGIN/skills/slideware/`). Shared style tooling is at `$PLUGIN/scripts/`; slideware-specific scripts are at `$PLUGIN/skills/slideware/scripts/`.

## Fast-path (1-3 slides, throwaway, or quick prototype)

```bash
mkdir -p my-deck/output && cd my-deck
cp $PLUGIN/styles/tokens/style-1.json style-tokens.json   # any default style, or $PLUGIN/styles/brands/tokens/<name>.json for a brandbook
cp $PLUGIN/skills/slideware/assets/templates/{starter-deck.js,package.json} .
npm install
# Author build-deck.js
node build-deck.js ./output
python3 $PLUGIN/skills/slideware/scripts/polish-deck.py ./output/deck.pptx
# If polish-deck reports nothing critical, ship. Skip render+iterate.
```

Target time: 3-8 min. Skip visual review if the deck is throwaway or polish-deck reports clean.

## Full-path (polished decks, ≥4 slides, anything shipped)

### 1. Gather inputs

- **Content** — outline, brief, source doc. If vague, propose an outline first and confirm.
- **Style / brandbook** — explicit path, Google Drive URL, or bundled name. Bundled names are discovered at runtime from `$PLUGIN/styles/*.md` (defaults) and `$PLUGIN/styles/brands/*.md` (brandbooks — see the brandware skill); list them with `node $PLUGIN/scripts/list-styles.js`. **Default to `style-1` if unspecified** and tell the user. Don't auto-pick a brandbook.
- **Sample deck** (optional) — `.pptx` whose style to mimic.
- **Output path** — default `./<sanitized-title>.pptx`.
- **Length** — 6-10 is typical default.

### 2. Resolve the brandbook

| Input | Action |
|---|---|
| Default style (fast) | `cp $PLUGIN/styles/tokens/style-N.json style-tokens.json` |
| Brandbook (fast) | `cp $PLUGIN/styles/brands/tokens/<name>.json style-tokens.json` |
| Local `.md`/`.css` | `node $PLUGIN/scripts/load-style.js <path> -o style-tokens.json` |
| Google Drive URL | `bash $PLUGIN/scripts/fetch-resource.sh <url> ./brand.md` then load |
| Website URL | `node $PLUGIN/scripts/derive-style.js <url> -o ./brand.md` then load |

### 3. (Optional) Ingest a sample deck

```bash
bash $PLUGIN/skills/slideware/scripts/render-slides.sh <sample.pptx> ./sample-preview/
python -m markitdown <sample.pptx> > ./sample-text.md
```

Read 3-4 representative slide PNGs. Note palette, type pairing, layout patterns, motif, density. Synthesize as inline tokens or override fields in `style-tokens.json`. Don't copy *content* — only style.

**When the sample uses a distinctive non-standard layout** (stacked bars, Swiss-cheese diagrams, unusual editorial blocks, custom chrome), prefer reproducing *that* layout for at least one slide of the new deck over picking from the standard 12 archetypes. The user picked this sample because they wanted its specific look — including the parts that don't fit textbook patterns. Mimicry priority overrides the anti-monotony rule for sample decks.

### 4. Plan layouts BEFORE writing code

Open `references/layout-patterns.md`. For each slide, pick a distinct archetype that fits the content shape:

| Content shape | Archetype |
|---|---|
| Title / section opener | #1 Title hero |
| Single dominant stat | #2 Big stat |
| Before/after, problem/solution | #3 Tradeoff |
| 3 parallel items (use ≤1×) | #4 Three-column cards |
| Concept + visual evidence | #5 Half-bleed image |
| Sequence of 3-6 steps | #6 Horizontal flow |
| Dated milestones, ≥5 items | #7 Vertical timeline |
| Closing principles | #8 Icon-row list |
| Pull quote | #9 Quote |
| Pricing, feature comparison | #10 Data table |
| Quantitative claim | #11 Chart-focused |
| Mid-deck section opener | #12 Asymmetric |

Sketch the deck plan as a comment at the top of `build-deck.js` before writing slide code.

### 5. Scaffold

```bash
mkdir -p my-deck/output && cd my-deck
cp $PLUGIN/skills/slideware/assets/templates/starter-deck.js ./build-deck.js
cp $PLUGIN/skills/slideware/assets/templates/package.json ./package.json
npm install   # ~10-15s
```

### 6. Author slides

Edit `build-deck.js`. The starter has the pre-render alignment checklist + pitfalls as comments at the top — keep them open while you write.

Pre-bake icons once at the top of `buildDeck()`, only import what you need from `react-icons`. Use `cx(w)` for centering. For long strings in cards:

```bash
node $PLUGIN/skills/slideware/scripts/text-fit.js --text "..." --w 3 --h 1.2 --fontSize 14
```

### 7. Build

```bash
node build-deck.js ./output
```

Build errors usually point to a malformed option object. Re-read the pitfalls list in starter-deck.js if confused.

### 8. Polish check (cheap pre-flight)

```bash
python3 $PLUGIN/skills/slideware/scripts/polish-deck.py ./output/deck.pptx
```

Reports overflow, vertical imbalance, off-grid alignment, edge encroachment.

**polish-deck flags are suspects, not verdicts.** Heuristic checks on XML can't see what's actually rendered, so some warnings will be false positives. Your job is to triage, not to dismiss:

1. For every warning, render JUST that slide and look at the PNG. Don't dismiss any warning without seeing the rendered slide.
2. If the rendered slide is fine, the warning was a false positive — note it and move on.
3. If the rendered slide has the problem polish-deck described (or any other problem), fix it.

The agent failure to avoid: "polish-deck reported 7 overflow warnings, but I inspected the code and they look fine, so I'm skipping render." That path lets real overflow ship.

### 9. Visual review (mandatory for polished decks)

```bash
bash $PLUGIN/skills/slideware/scripts/render-slides.sh ./output/deck.pptx ./output/preview/
```

Read every PNG. Scan for: overlapping elements, text overflow, items in a row not sharing y/h, decorative element sized for 1-line title but title wrapped, cramped/vast gaps, low contrast, off-center elements, **columns that are visibly wider than their text content (text ends well before column right edge with no visible reason — reads as accidentally truncated)**.

**Find at least one issue per pass.** Zero issues on first inspection almost always means you didn't look carefully enough — open the worst-looking slide at full resolution and find the one thing that's slightly off. There will be something. The rare exception is when you've already done 2+ iterations and the deck is genuinely converged; on a first pass, "no issues" is a calibration problem, not a quality signal.

Common failure: declaring the deck clean because nothing jumped out at thumbnail size. Slide-level details (text touching bullet markers, hairline rules sitting too close to descenders, items in a row off by 1pt) only surface at full size. Open one slide at full resolution before you call it done.

Content QA:

```bash
python -m markitdown ./output/deck.pptx | grep -iE "xxxx|lorem|ipsum|placeholder|TODO"
```

### 10. Iterate

Fix in `build-deck.js`, rebuild, re-run polish-deck + render. Fixes often introduce new problems. Typically 2-3 cycles.

### 11. Deliver

```
✓ Deck written to /Users/.../my-deck/output/deck.pptx
  6 slides · brandbook: anthropic
  Preview images: /Users/.../my-deck/output/preview/
```

## Updating an existing pptx

The skill builds new decks by re-running pptxgenjs. To "update" an existing deck:

1. `python -m markitdown <existing.pptx>` to extract the text/structure.
2. `bash $PLUGIN/skills/slideware/scripts/render-slides.sh <existing.pptx> ./existing-preview/` to see the visuals.
3. Author a new `build-deck.js` that reproduces the existing layout + applies the requested changes.
4. Build to a new path (don't overwrite); diff visually with the original preview.

pptxgenjs is **write-only** — there's no "open existing .pptx and edit" path. Treat updates as rebuilds with the original as visual reference.

**Iterative sessions — diff the live file before EVERY rebuild.** Users hand-edit delivered .pptx files (PowerPoint/Keynote) between requests. A rebuild that ignores the live file silently destroys those edits. Before each subsequent regeneration:

1. `python -m markitdown <live.pptx> > current-live.md` and diff against your last build's extraction.
2. Also compare file mtime/size against your last delivery — a newer save is a red flag even if text looks identical (images and layout moves don't always show in markitdown).
3. Back-port any user edits into `build-deck.js` first (including extracting any images they added — `unzip <live.pptx> "ppt/media/*"`), then rebuild and deliver.

## Time budget

| Path | Slides | Time |
|---|---|---|
| Fast-path | 1-3 | 3-8 min |
| Full-path | 4-12 | 15-30 min |
| Sample mimicry | any | +5-10 min for ingest |

If past 45 min on a full-path deck, the layout plan was wrong or you skipped the alignment checklist.
