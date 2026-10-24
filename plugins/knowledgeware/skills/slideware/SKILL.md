---
name: slideware
description: "Create visually rich, style-driven slide decks in two output formats: PowerPoint (.pptx via pptxgenjs + React icons) and HTML (single-file Reveal.js deck). Use any time the user asks for a slide deck, presentation, pitch deck, training module, keynote, .pptx file, HTML/web presentation, Reveal.js deck, browser slides, or slides to share via link — or wants slides generated from a brief/outline, references a 'style' or 'brandbook' (a .md/.css visual identity), a 'sample deck' to mimic, or asks to update/iterate on an existing deck (rebuild approach). Trigger on words like 'deck', 'slides', 'presentation', 'pptx', 'pitch', 'keynote', 'reveal', 'HTML deck', 'web presentation', or whenever a .pptx (or slide-deck .html) appears as input or output. Styles resolve from the knowledgeware plugin's shared registry — 5 generic defaults plus brandbooks (in styles/brands/ or the user's KNOWLEDGEWARE_BRANDS_DIR) managed by the brandware skill — so decks share one visual identity with knowledgebase sites and chartware diagrams. If the output format (PowerPoint vs HTML) is not stated and cannot be inferred from context, ASK the user before building."
license: MIT
---

# slideware

> **Needs the knowledgeware plugin.** Styles and the style loader live in the plugin, two folders above this skill. If `../../scripts/load-style.js` doesn't exist, the skill was installed on its own (for example from a skills directory): tell the user it needs the whole plugin, `/plugin install knowledgeware --marketplace andisab/swe-marketplace`, and stop.

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
2. **Bundled name** — discovered at runtime from the registry (shadow order: default &lt; plugin brand &lt; user brand):
   - `$PLUGIN/styles/<name>/brand.md` — 5 default generic styles (`style-1` through `style-5`), each with a mark in `assets/`
   - `$PLUGIN/styles/brands/<name>/brand.md` — brandbooks (managed by the **brandware** skill)
   - `$KNOWLEDGEWARE_BRANDS_DIR/<name>/brand.md` — the user's own brands directory, if that env var is set (survives plugin updates)
   - the older flat `<name>.md` files are still read; `scripts/registry.js` searches both layouts

   Run `node $PLUGIN/scripts/list-styles.js` for the current list (`--default` / `--brands` / `--names` / `--json`).
3. **Website URL** — `node $PLUGIN/scripts/derive-style.js <url> -o ./brand.md` then load. Heuristic; verify against the live site.
4. **Google Drive URL** — `python3 $PLUGIN/scripts/fetch-resource.py <url> <dest>`.
5. **No style given** — if a marker exists (`.knowledgeware` in the project or a parent, then a `DEFAULT` file: a one-line file naming a registry entry; `$KNOWLEDGEWARE_BRANDS_DIR/DEFAULT` wins over `$PLUGIN/styles/brands/DEFAULT`), use that brand and tell the user; otherwise pick `style-1` (Editorial Light) and tell the user. Don't otherwise fall back to brandbooks unless the user names one.

**Staging differs per format** (each guide shows the exact command):
- pptx consumes **tokens JSON** — `node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json` (serves the `tokens.json` cache next to each `brand.md` when it's fresh, and rebuilds it otherwise).
- html consumes a **YAML-frontmatter `style.md`** — `node $PLUGIN/skills/slideware/html/scripts/load-style.js <name|path> -o ./style.md` (converts any registry brandbook or CSS file).

**Fonts (handle silently)**: brandbooks name fonts; nothing embeds them. When building **pptx**, after resolving the style run `bash $PLUGIN/scripts/install-fonts.sh --check <name>` and, if Google Fonts are missing, install them with the same script without asking — just mention it in one line. Non–Google-Fonts families can't be auto-installed: fall back per the brandbook and tell the user which face to install manually. HTML decks load Google Fonts via `<link>`, so viewers (and you) need nothing installed.

**Missing tooling**: pptx previews need LibreOffice + poppler (`render-slides.sh` prints a NOTE and exits cleanly when they're absent — no PNGs means the check was skipped) and visual review needs browser MCP tools (find them via `tool_search`). When any of these are missing, still build and deliver the deck, say which check was skipped, and point the user to the plugin README's "Optional tooling" section for install commands.

## Anti-monotony rule (shared)

The point is **content-shape variety**, not visual-archetype rigidity. A deck that walks one consistent story can reuse a layout deliberately; a survey of unrelated topics should vary archetypes slide to slide. The failure mode is reaching for the same layout because the template defaulted to it. If you reuse an archetype twice without articulating why, swap one out. Archetype catalogs: [pptx/references/layout-patterns.md](pptx/references/layout-patterns.md) (12) · [html/references/layout-patterns.md](html/references/layout-patterns.md) (8).

## Citations are clickable (shared)

When a slide cites a source that has a URL — footnote lines, resources/further-reading slides, figure or data attributions, quote sources — make it a **live hyperlink**, not plain text. HTML format: a real `<a href="…" target="_blank" rel="noopener">` styled in the deck's muted caption treatment. pptx format: pptxgenjs `hyperlink` on the text run — `{ text: "AWS Bedrock pricing", options: { hyperlink: { url: "https://…" }, color: <inkMuted>, fontSize: 10 } }` (set the color explicitly or PowerPoint paints it default-blue). Link text is the human-readable source name, never a raw URL dumped on the slide. A citation the audience can't click is a citation they'll never check.

## Provenance for maintenance (shared)

Decks decay like any deliverable: prices, versions, GA statuses, and quoted figures rot. Every deck that states external facts ships its provenance so a later maintenance pass can re-verify without archaeology. The knowledgeware `librarian` agent reads these records to report which decks are due and plan their re-verification:

- **pptx**: each content slide's speaker notes end with a `Sources:` list (full URLs) and a `Last verified: YYYY-MM-DD` line — mechanics in [pptx/FORMAT.md](pptx/FORMAT.md) §Speaker notes.
- **html**: the deck ends with a maintenance/sources slide following the knowledgebase skill's conventions scaled to a deck — mechanics in [html/FORMAT.md](html/FORMAT.md) §Maintenance section.

The stamp means the same thing it means in a knowledgebase site: *these facts were checked against their sources on that date*. When iterating on an existing deck, bump a stamp only for facts you actually re-verified; treat stamps older than 90 days as stale before any external presentation.

## Speaker notes, pacing and hidden slides (shared)

Both formats carry the same presenter information, so a deck can move between them without losing it:

- **Notes** are written for the ear, as plain text: blank lines split paragraphs, `- ` lines form a list, `**bold**` / `*italic*` mark emphasis, and `[pause]` marks a beat. Html renders the markup in its presenter view; pptx strips the emphasis markers, because PowerPoint shows notes as plain text.
- **Cue** per slide: `session` (a label such as "Session 1"), `module` (a label), and `run`: `default`, `cut-first` (in the run, first to cut when behind), `add-back` (use if ahead) or `backup` (for questions).
- **Pacing** comes from session lengths in minutes. Each in-run slide (`default` or `cut-first`, not hidden) gets an equal share of its session. Html shows a live pace line, with the length editable in the presenter; pptx writes each slide's planned window into a cue line at the top of its notes.
- **Hidden slides** stay in the source but out of the show and out of the pacing.
- **Every build prints a pacing summary**: each session's time per slide, then the hidden slides. For "hide slide 12", "session 2 is 75 minutes" or "which slides are hidden?", edit the deck source, rebuild, and quote that summary.

Mechanics: [html/references/reveal.md](html/references/reveal.md) §Speaker notes (`notes`, `cue`, `hidden` slide fields; `sessions` / `minutes` in `slides.js`) · [pptx/FORMAT.md](pptx/FORMAT.md) §Speaker notes (`speakerNotes()`, `s.hidden`, `SESSIONS`).

## Sample mimicry (shared principle: style only, never content)

When the user provides a sample deck, derive palette, type pairing, layout patterns, motif, and density — then author **new** content in that visual language. **Mimicry overrides anti-monotony**: if the sample has a distinctive non-standard layout, echoing it matters more than the canonical archetypes. Extraction mechanics are per-format (pptx: render + markitdown; html: DevTools/CSS) — see the format guides.

## Output convention

Default `<cwd>/deck.pptx` or `<cwd>/index.html` unless the user specifies. Print the absolute path after writing. When iterating on a previously delivered deck, diff the live file first — users hand-edit deliverables between requests (details in each format guide).
