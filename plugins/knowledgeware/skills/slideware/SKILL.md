---
name: slideware
description: "Create visually rich, style-driven slide decks in two output formats: PowerPoint (.pptx via pptxgenjs + React icons) and HTML (one self-contained index.html, edited in the browser and exported to PowerPoint or PDF). Use any time the user asks for a slide deck, presentation, pitch deck, training module, keynote, .pptx file, HTML/web presentation, browser slides, or slides to share via link — or wants slides generated from a brief/outline, references a 'style' or 'brandbook' (a .md/.css visual identity), a 'sample deck' to mimic, or asks to update/iterate on an existing deck (rebuild approach). Trigger on words like 'deck', 'slides', 'presentation', 'pptx', 'pitch', 'keynote', 'reveal', 'HTML deck', 'web presentation', or whenever a .pptx (or slide-deck .html) appears as input or output. Styles resolve from the knowledgeware plugin's shared registry — 5 generic defaults plus brandbooks (in styles/brands/ or the user's KNOWLEDGEWARE_BRANDS_DIR) managed by the brandware skill — so decks share one visual identity with knowledgebase sites and chartware diagrams. If the output format (PowerPoint vs HTML) is not stated and cannot be inferred from context, ASK the user before building."
license: MIT
---

# slideware

> **Needs the knowledgeware plugin.** Styles and the style loader live in the plugin, two folders above this skill. If `../../scripts/load-style.js` doesn't exist, the skill was installed on its own (for example from a skills directory): tell the user it needs the whole plugin, `/plugin install knowledgeware --marketplace andisab/swe-marketplace`, and stop.

Generate brandbook-driven slide decks in one of **two output formats**:

| Format | Engine | Output | Guide |
|---|---|---|---|
| **pptx** | pptxgenjs + React icons + sharp (Node.js) | Real `.pptx` — opens in PowerPoint, Keynote, Google Slides | [pptx/FORMAT.md](pptx/FORMAT.md) |
| **html** | the plugin's engine and runtime (Node.js 22, Chrome for checks and export) | One self-contained `index.html` — any browser, hostable, share-by-link, edited in place with E, exported to PowerPoint or PDF | [html/FORMAT.md](html/FORMAT.md) |

Opinionated about one thing in both formats: **don't make boring slides.** Plain bullets on white aren't worth your reader's time.

## Step 0 — choose the format

Decide from explicit cues first:

- **pptx**: ".pptx", "PowerPoint", "Keynote", "Google Slides", a `.pptx` file as input/output, "they'll edit the slides afterward", corporate template workflows.
- **html**: "HTML", "web presentation", "browser", "host it", "share a link", "single file", "I'll edit it myself", embedding in a site, a slide-deck `.html` as input/output. An HTML deck also exports to PowerPoint, so "they need a .pptx too" doesn't rule it out.
- **Iterating on an existing deck** → keep its current format unless asked to convert.

**If neither the request nor context settles it, ASK the user** ("PowerPoint file or an HTML deck you can open in a browser/host?") before building — the two outputs are not interchangeable deliverables. Don't silently default.

Then read **exactly one** format guide (`pptx/FORMAT.md` or `html/FORMAT.md`) and follow it. Each guide has its own workflow, layout archetypes, pitfalls, and scripts under its directory.

## Style / brandbook resolution (shared by both formats)

"Style" and "brandbook" mean the same thing — .md files describing a visual identity (palette + type + layout). Path convention: `$PLUGIN` = the knowledgeware plugin root, two directories above this skill (`../../`).

A style is a **name resolved through the registry**, never a path to a token cache: the brandware skill's resolution contract ([../brandware/SKILL.md](../brandware/SKILL.md) §Resolution contract) says where names are looked up (the user's `$KNOWLEDGEWARE_BRANDS_DIR`, then `$PLUGIN/styles/brands/`, then the five generic styles in `$PLUGIN/styles/`) and which markers decide when no name is given (`.knowledgeware` in the project, then `DEFAULT`). `node $PLUGIN/scripts/list-styles.js` lists what's installed. Slideware's own fallback, when nothing is named and no marker resolves: `style-1` (Editorial Light), and tell the user. Other inputs are staged first, then loaded by name or path: an explicit local `.md`/`.css` is read directly; a website is derived with `node $PLUGIN/scripts/derive-style.js <url> -o ./brand.md` (heuristic; verify against the live site); a Google Drive link is fetched with `python3 $PLUGIN/scripts/fetch-resource.py <url> <dest>`.

**Staging differs per format** (each guide shows the exact command):
- pptx consumes **tokens JSON** — `node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json` (serves the `tokens.json` cache next to each `brand.md` when it's fresh, and rebuilds it otherwise).
- html copies the brand **into the deck** — `node $PLUGIN/skills/slideware/html/engine/cli.js new <dir> --brand <name|path>` writes the theme block (tokens, base typography and kit classes, or the brand's own `css/slideware.css`) and the brand's logos; `refresh` updates them when the brand changes ([html/FORMAT.md](html/FORMAT.md) §The brand).

**Fonts (handle silently)**: brandbooks name fonts; nothing embeds them. When building **pptx**, after resolving the style run `bash $PLUGIN/scripts/install-fonts.sh --check <name>` and, if Google Fonts are missing, install them with the same script without asking — just mention it in one line. Non–Google-Fonts families can't be auto-installed: fall back per the brandbook and tell the user which face to install manually. HTML decks load Google Fonts via `<link>`, so viewers (and you) need nothing installed.

**Missing tooling**: pptx previews need LibreOffice + poppler (`render-slides.sh` prints a NOTE and exits cleanly when they're absent — no PNGs means the check was skipped) and visual review needs browser MCP tools (find them via `tool_search`). When any of these are missing, still build and deliver the deck, say which check was skipped, and point the user to the plugin README's "Optional tooling" section for install commands.

## Anti-monotony rule (shared)

The point is **content-shape variety**, not visual-archetype rigidity. A deck that walks one consistent story can reuse a layout deliberately; a survey of unrelated topics should vary archetypes slide to slide. The failure mode is reaching for the same layout because the template defaulted to it. If you reuse an archetype twice without articulating why, swap one out. Archetype catalogs: [pptx/references/layout-patterns.md](pptx/references/layout-patterns.md) (12) · [html/references/patterns.md](html/references/patterns.md) (starting points; html slides are free-form).

## Citations are clickable (shared)

When a slide cites a source that has a URL — footnote lines, resources/further-reading slides, figure or data attributions, quote sources — make it a **live hyperlink**, not plain text. HTML format: a real `<a href="…" target="_blank" rel="noopener">` styled in the deck's muted caption treatment. pptx format: pptxgenjs `hyperlink` on the text run — `{ text: "AWS Bedrock pricing", options: { hyperlink: { url: "https://…" }, color: <inkMuted>, fontSize: 10 } }` (set the color explicitly or PowerPoint paints it default-blue). Link text is the human-readable source name, never a raw URL dumped on the slide. A citation the audience can't click is a citation they'll never check.

## Provenance for maintenance (shared)

Decks decay like any deliverable: prices, versions, GA statuses, and quoted figures rot. Every deck that states external facts ships its provenance so a later maintenance pass can re-verify without archaeology. The knowledgeware `librarian` agent reads these records to report which decks are due and plan their re-verification:

- **pptx**: each content slide's speaker notes end with a `Sources:` list (full URLs) and a `Last verified: YYYY-MM-DD` line — mechanics in [pptx/FORMAT.md](pptx/FORMAT.md) §Speaker notes.
- **html**: the deck ends with a maintenance/sources slide following the knowledgebase skill's conventions scaled to a deck — mechanics in [html/FORMAT.md](html/FORMAT.md) §Maintenance.

The stamp means the same thing it means in a knowledgebase site: *these facts were checked against their sources on that date*. When iterating on an existing deck, bump a stamp only for facts you actually re-verified; treat stamps older than 90 days as stale before any external presentation.

A deck built from research gets a **spec**: a one-page knowledgebase site beside it that carries the deck's volatility table, so the librarian can keep the deck current on cadence without editing the deck (the contract is the maintenance spec's §7, [../knowledgebase/references/maintenance.md](../knowledgebase/references/maintenance.md)). An HTML deck names it with `"spec": "../<unit>.html"` in its settings and, per slide, `data-teaches="<section-id>"`; a pptx deck relies on a `spec.html` beside it. When the user asks to keep a deck maintainable, or the deck's facts come from a research folder, build the spec with the knowledgebase skill and wire the fields. A planning outline of the deck (`notes.md` beside it, how it flows and what to cut) stays a separate file; read it when asked to restructure the deck, and never fold it into the spec.

## Speaker notes, pacing and hidden slides (shared)

Both formats carry the same presenter information, so a deck can move between them without losing it:

- **Notes** are written for the ear, as plain text: blank lines split paragraphs, `- ` lines form a list, `**bold**` / `*italic*` mark emphasis, and `[pause]` marks a beat. Html renders the markup in its presenter view; pptx strips the emphasis markers, because PowerPoint shows notes as plain text. Keep them succinct and selective: one sentence for what the slide is for, a `[click n]` line for each build saying what it reveals, and one thing to remember. No slide should need more than 5 to 10 minutes; split it if it does.
- **Builds** (PowerPoint-style click reveals): in html, `data-step="n"` on any element (elements sharing a number arrive together and stagger) or `class="fragment"`, inside figures too; each element's entrance motion then plays on its click ([html/references/runtime.md](html/references/runtime.md) §Builds). Builds play only while a presenter window is connected (`P`); a deck opened on its own, or being edited, shows every slide complete. To preview builds without a second window, open the deck with `?presenter`. The presenter counts the builds left on a slide. PowerPoint export doesn't carry builds.
- **Cue** per slide: `session` (a label such as "Session 1"), `module` (a label), and `run`: `default`, `cut-first` (in the run, first to cut when behind), `add-back` (use if ahead) or `backup` (for questions).
- **Pacing** comes from session lengths in minutes. Each in-run slide (`default` or `cut-first`, not hidden) gets an equal share of its session. Html shows a live pace line, with the length editable in the presenter; pptx writes each slide's planned window into a cue line at the top of its notes.
- **Hidden slides** stay in the source but out of the show and out of the pacing.
- **The pacing summary**: each session's time per slide, then the hidden slides. html prints it with `check`; pptx with every build. For "hide slide 12", "session 2 is 75 minutes" or "which slides are hidden?", change the deck, run its check or build, and quote that summary.

Mechanics: [html/FORMAT.md](html/FORMAT.md) §Writing slides (`<aside class="notes">`, `data-session` / `data-module` / `data-run`, `hidden`; `sessions` in the settings) · [pptx/FORMAT.md](pptx/FORMAT.md) §Speaker notes (`speakerNotes()`, `s.hidden`, `SESSIONS`).

## Planning a deck (when a deck needs planning)

Not every deck needs a plan; one assembled from several sources, or revised in rounds, does. The convention is a `deck-plan.md` beside the deck's source, in tables, not prose: a header (date, status), the **sources** named once with short references that the tables cite as `D<deck>.S<slide>` (`DV7.S13` is slide 13 of the V7 deck; `DCUR` for the deck's own current source), the owner's **decisions** with dates, then **one table per section of the deck** (Intro, each block, Close, Backup at the end) with roughly these columns: `#` · `Slide` (the slide's key in backticks, then its title) · `Source` · `Builds` (how many clicks and what each reveals) · `Status` (done or to do, with the mechanism: ported, rebuilt, builds added, new slide). "Not taken" (what each source had that the deck doesn't) and "Mechanics" (how a port is done, the order of work) are free-form notes. Template: [html/assets/templates/deck-plan.md](html/assets/templates/deck-plan.md). The html `check` reads the file when it's there and prints, for information, rows marked done whose key isn't in the deck and slides the plan doesn't mention. The plan is a working file: the librarian reads it for context (maintenance spec §7, rung 3) and never edits it, and it isn't a spec.

## Editing and handing over (html)

An HTML deck is edited in place: when the owner wants to edit, start the engine's `serve` in the background and give them the address (FORMAT.md §Editing); they press E, edits and formats text, moves and resizes anything, writes notes, leaves comments for Claude and rearranges slides, and S saves into the file. Comments arrive in the slides as `<!-- @claude: … -->`; when asked to address them, find them with grep, make each change and remove the comment. When the owner has the deck open while you edit it, their page reloads with your change. Old-format decks (their own `build-deck.js` and `slides.js`) are converted with `migrate` before anything else, and their old files are deleted only after the owner approves. Mechanics: [html/FORMAT.md](html/FORMAT.md) §Editing and §Old decks.

## Sample mimicry (shared principle: style only, never content)

When the user provides a sample deck, derive palette, type pairing, layout patterns, motif, and density — then author **new** content in that visual language. **Mimicry overrides anti-monotony**: if the sample has a distinctive non-standard layout, echoing it matters more than the canonical archetypes. Extraction mechanics are per-format (pptx: render + markitdown; html: DevTools/CSS) — see the format guides.

## Output convention

Default `<cwd>/deck.pptx` or `<cwd>/<deck>/index.html` unless the user specifies. Print the absolute path after writing. When iterating on a previously delivered pptx deck, diff the live file first — users hand-edit deliverables between requests (details in the format guide). An HTML deck is its own source, so the owner's edits are already in the file you change.
