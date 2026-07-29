---
name: slideware
description: "Create visually rich, style-driven slide decks in two output formats: PowerPoint (.pptx via pptxgenjs + React icons) and HTML (single-file Reveal.js deck). Use any time the user asks for a slide deck, presentation, pitch deck, training module, keynote, .pptx file, HTML/web presentation, Reveal.js deck, browser slides, or slides to share via link — or wants slides generated from a brief/outline, references a 'style' or 'brandbook' (a .md/.css visual identity), a 'sample deck' to mimic, or asks to update/iterate on an existing deck (rebuild approach). Trigger on words like 'deck', 'slides', 'presentation', 'pptx', 'pitch', 'keynote', 'reveal', 'HTML deck', 'web presentation', or whenever a .pptx (or slide-deck .html) appears as input or output. Styles resolve from the knowledgeware plugin's shared registry — 5 generic defaults plus styles/brands/ brandbooks managed by the brandware skill — so decks share one visual identity with knowledgebase sites and chartware diagrams. If the output format (PowerPoint vs HTML) is not stated and cannot be inferred from context, ASK the user before building."
license: MIT
---

# slideware

Generate brandbook-driven slide decks in one of **two output formats**:

| Format | Engine | Output | Guide |
|---|---|---|---|
| **pptx** | pptxgenjs + React icons + sharp (Node.js) | Real `.pptx` — opens in PowerPoint, Keynote, Google Slides | [pptx/FORMAT.md](pptx/FORMAT.md) |
| **html** | Reveal.js + js-yaml (Node.js) | Single self-contained `index.html` — any browser, hostable, share-by-link | [html/FORMAT.md](html/FORMAT.md) |

Opinionated about one thing in both formats: **don't make boring slides.** Plain bullets on white aren't worth your reader's time.

## Step 0 — choose the format

Decide from explicit cues first:

- **pptx**: ".pptx", "PowerPoint", "Keynote", "Google Slides", a `.pptx` file as input/output, "they'll edit the slides afterward", corporate template workflows.
- **html**: "HTML", "Reveal", "web presentation", "browser", "host it", "share a link", "single file", embedding in a site, a slide-deck `.html` as input/output.
- **Iterating on an existing deck** → keep its current format unless asked to convert.

**If neither the request nor context settles it, ASK the user** ("PowerPoint file or an HTML deck you can open in a browser/host?") before building — the two outputs are not interchangeable deliverables. Don't silently default.

Then read **exactly one** format guide (`pptx/FORMAT.md` or `html/FORMAT.md`) and follow it. Each guide has its own workflow, layout archetypes, pitfalls, and scripts under its directory.

## Style / brandbook resolution (shared by both formats)

"Style" and "brandbook" mean the same thing — .md files describing a visual identity (palette + type + layout). Path convention: `$PLUGIN` = the knowledgeware plugin root, two directories above this skill (`../../`).

1. **Explicit local path** — read directly.
2. **Bundled name** — discovered at runtime from the plugin registry (shadow order: default &lt; brand):
   - `$PLUGIN/styles/*.md` — 5 default generic styles (`style-1` through `style-5`)
   - `$PLUGIN/styles/brands/*.md` — brandbooks (managed by the **brandware** skill)

   Run `node $PLUGIN/scripts/list-styles.js` for the current list (`--default` / `--brands` / `--names` / `--json`).
3. **Website URL** — `node $PLUGIN/scripts/derive-style.js <url> -o ./brand.md` then load. Heuristic; verify against the live site.
4. **Google Drive URL** — `bash $PLUGIN/scripts/fetch-resource.sh <url> <dest>`.
5. **No style given** — if `$PLUGIN/styles/brands/DEFAULT` exists (a one-line file naming a registry entry), use that brand and tell the user; otherwise pick `style-1` (Editorial Light) and tell the user. Don't otherwise fall back to brandbooks unless the user names one.

**Staging differs per format** (each guide shows the exact command):
- pptx consumes **tokens JSON** — `node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json` (pre-built caches in `$PLUGIN/styles/tokens/` and `$PLUGIN/styles/brands/tokens/`).
- html consumes a **YAML-frontmatter `style.md`** — `node $PLUGIN/skills/slideware/html/scripts/load-style.js <name|path> -o ./style.md` (converts any registry brandbook or CSS file).

**Fonts**: brandbooks name fonts; nothing embeds them. For pptx authoring/preview the fonts must be installed locally — `bash $PLUGIN/scripts/install-fonts.sh <brand|style|font name>` fetches them from Google Fonts (see brandware). HTML decks load Google Fonts via `<link>`, so viewers need nothing.

## Anti-monotony rule (shared)

The point is **content-shape variety**, not visual-archetype rigidity. A deck that walks one consistent story can reuse a layout deliberately; a survey of unrelated topics should vary archetypes slide to slide. The failure mode is reaching for the same layout because the template defaulted to it. If you reuse an archetype twice without articulating why, swap one out. Archetype catalogs: [pptx/references/layout-patterns.md](pptx/references/layout-patterns.md) (12) · [html/references/layout-patterns.md](html/references/layout-patterns.md) (8).

## Sample mimicry (shared principle: style only, never content)

When the user provides a sample deck, derive palette, type pairing, layout patterns, motif, and density — then author **new** content in that visual language. **Mimicry overrides anti-monotony**: if the sample has a distinctive non-standard layout, echoing it matters more than the canonical archetypes. Extraction mechanics are per-format (pptx: render + markitdown; html: DevTools/CSS) — see the format guides.

## Output convention

Default `<cwd>/deck.pptx` or `<cwd>/index.html` unless the user specifies. Print the absolute path after writing. When iterating on a previously delivered deck, diff the live file first — users hand-edit deliverables between requests (details in each format guide).
