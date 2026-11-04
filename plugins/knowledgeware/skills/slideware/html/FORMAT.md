# slideware — HTML format

Format guide for HTML decks. Read [../SKILL.md](../SKILL.md) first for choosing the format and resolving a style. This file covers how an HTML deck is built, written, checked and handed over.

## The deck is one file

A deck is one `index.html`. It is both the source and the file people open: there is no build step for the base deck and no separate review file. The code lives in the plugin. The engine (`$PLUGIN/skills/slideware/html/engine/cli.js`) creates decks, keeps their runtime and brand current, checks them, and exports them. The editor loads from the plugin when the owner presses E.

```
<deck>/
  index.html            the deck: source and presented file
  index-<lane>.html     a lane's file, derived from index.html and lanes/<lane>.json (optional)
  lanes/<lane>.json     a lane's overlay (optional)
  deck-plan.md          the deck's plan (optional; ../SKILL.md §Planning a deck)
```

Inside `index.html`, fixed regions, each found by its id:

| Region | Holds | Who writes it |
|---|---|---|
| `<script type="application/json" id="sw-deck">` | settings: `title`, `footer`, `logo`, `pageNumbers`, `sessions`, `lanes`, `spec`, `builds`, `progress` | Claude; the engine keeps `lanes` |
| `<style id="sw-theme" data-brand data-brand-hash>` | the brand, copied from brandware | the engine only (`new`, `refresh`) |
| `<style id="sw-deck-css">` | this deck's own CSS, for anything beyond the brand's classes | Claude |
| `<script id="sw-runtime">` | runtime and presenter | the engine only |
| `<script id="sw-loader" data-editor>` | loads the editor on E | the engine only |
| `<main id="sw-slides">` | the slides | Claude and the editor |
| `<template id="sw-assets">` | figures (`data-figure`), images (`data-asset`), the logo | Claude and the engine |

Never hand-edit the engine's regions; `refresh` replaces them whole.

## Commands

`$CLI` is `node $PLUGIN/skills/slideware/html/engine/cli.js`.

| Command | Does |
|---|---|
| `$CLI new <dir> --brand <name> --title "…" [--subtitle "…"] [--footer "A\|B"] [--minutes N]` | writes `<dir>/index.html` with the brand inside and a title slide |
| `$CLI outline <index.html>` | slide keys, titles and line ranges, so you read and edit one slide at a time |
| `$CLI slide <index.html> <key>` | prints one slide |
| `$CLI check <index.html> [--render]` | settings, slides, notes, assets, pacing, hidden slides, brand, spec, deck-plan, lanes; `--render` adds overflow and the footer band, measured in Chrome |
| `$CLI refresh <index.html> [--brand <name>]` | brings the runtime, loader and brand up to date (and rebuilds lane files) |
| `$CLI lanes <index.html>` | rebuilds every `index-<lane>.html` from the base and `lanes/*.json` |
| `$CLI export <index.html> --png [dir] \| --pdf [file] \| --pptx [file] [--level 0\|1]` | pictures, PDF, PowerPoint (§Export and import) |
| `$CLI import <file.pptx> [--mode redesign\|faithful] [--out dir]` | brings a PowerPoint deck in |
| `$CLI migrate <old-deck-dir> --out <new-dir> [--brand <name>]` | converts an old-format deck (§Old decks) |
| `$CLI serve <index.html> [--open]` | a local server, so the owner can edit and save in any browser |

Every command needs Node 22 or newer; export, `check --render` and `migrate` also need Chrome, Edge, Brave or Chromium. Nothing is installed per deck.

## Writing slides

Each slide is a `<section data-key="…">` inside `<main id="sw-slides">`, preceded by a marker comment the outline uses:

```html
<!-- s1-07 · One organization, unless a wall is mandatory -->
<section data-key="s1-07" data-session="Session 1" data-module="Block 1" data-teaches="org-boundary">
  <p class="kicker">The boundary</p>
  <h2>One organization, unless a wall is mandatory</h2>
  <div class="cols">…</div>
  <aside class="notes">What the slide is for, in one sentence.

[click 1] What the first build reveals.</aside>
</section>
```

The slide is a 1280 × 720 canvas, and anything HTML, CSS and SVG can draw goes. Patterns for common shapes, built on the brand's classes: [references/patterns.md](references/patterns.md). Visual rules: [references/visual-principles.md](references/visual-principles.md).

What the runtime reads on a section:

| Attribute | Means |
|---|---|
| `data-key` | the slide's address, unique, stable across edits (required) |
| `hidden` | out of the show and the pacing, kept in the file |
| `data-session`, `data-module`, `data-run` | the cue; `data-run` is `default`, `cut-first`, `add-back` or `backup` |
| `data-divider` | starts a section in the overview (its heading names it, `.kicker` labels it) |
| `data-chrome="none"` | no running footer on this slide (a title or cover) |
| `data-footer="Block 1"` | this slide's own part of the footer, after the deck's text |
| `data-teaches="<section-id>"` | the spec section the slide teaches (for the librarian) |

Inside a slide:

- **Notes**: `<aside class="notes">` as plain text, for the ear (../SKILL.md §Speaker notes).
- **Builds**: `data-step="n"` on any element (several elements may share a step), or `class="fragment"` with an optional `data-fragment-index`. They play only while presenting.
- **Motion**: `data-a="up|fade|left|right|pop|grow-x|grow-y|wipe|draw"` with `style="--i: n"` for the stagger.
- **Per-slide CSS**: a `<style>` inside the section, every rule prefixed with `[data-key="s1-07"]`.
- **Ids**: give an element an `id` when a lane changes it (§Lanes) or a build targets it.
- **Links**: real `<a href target="_blank" rel="noopener">`.

Details of each, and the keys: [references/runtime.md](references/runtime.md).

**Figures.** A drawing used on a slide lives once in the asset block and is placed with an empty placeholder that carries its size and position:

```html
<!-- in <template id="sw-assets"> -->
<svg data-figure="company-map" viewBox="0 0 1120 560" xmlns="http://www.w3.org/2000/svg">…</svg>
<!-- on the slide -->
<svg data-figure-ref="company-map" class="cw-dg" style="width: 760px"></svg>
```

The runtime fills the placeholder at load, with ids suffixed per copy, so CSS, builds on SVG groups and the editor all work on it, and one figure can appear on several slides. Scope a figure's own `<style>` under a class on the placeholder (chartware figures use `.cw-dg`); `check` flags unscoped rules. Raster images go in the block as data URIs (`<img data-asset="qr" src="data:…">`, placed with `<img data-asset-ref="qr">`), so the file stays self-contained. An SVG icon sprite marked `data-inline` (`<svg data-asset="icons" data-inline>` with `<symbol>`s) is placed in the page, so `<use href="#i-flag">` resolves on any slide. Chartware makes the figures ([../../chartware/SKILL.md](../../chartware/SKILL.md)).

**Working on a large deck.** Read with `outline`, then `slide <key>` or the line range; edit slides with targeted edits; keep figures in the asset block at the end of the file. Run `check` after every round of edits and quote its pacing summary when you change sessions or hidden slides.

## The brand

`new` copies the brand from brandware into `#sw-theme` and tags it with the brand's name and a hash of its files: tokens as `--color-*`, `--font-*`, `--size-*`, `--radius`, `--margin`, base typography and the kit classes the patterns use, or the brand's own `css/slideware.css` when it ships one (that brand then owns its base look). The logos go into the asset block (`logo`, `logo-light`, `logo-dark`); the footer uses `logo` unless the settings name another asset or `"logo": false`. Fonts load from Google Fonts through a link tagged with the brand.

### Token → CSS mapping

The engine (`engine/theme.js`) writes the brand's tokens as custom properties at the top of `#sw-theme`; the base, the kit, a brand's `slideware.css` and the deck's CSS all read them. A token the brandbook leaves out falls back as listed.

| Token | Custom property | Fallback |
|---|---|---|
| `palette.bg`, `bgDark` | `--color-bg`, `--color-bg-dark` | white; `ink` |
| `palette.surface`, `surfaceAlt` | `--color-surface`, `--color-surface-alt` | `bg`; `surface` |
| `palette.ink`, `inkBody`, `inkMuted`, `inkFaint` | `--color-ink`, `--color-ink-body`, `--color-ink-muted`, `--color-ink-faint` | near-black; `ink`; grey; `inkMuted` |
| `palette.border` | `--color-border` | light grey |
| `palette.accent`, `accent2` | `--color-accent`, `--color-accent2` | green-grey; `accent` |
| `palette.success`, `warning`, `error` | `--color-success`, `--color-warning`, `--color-error` | green, amber, red |
| `type.sans`, `serif`, `mono` | `--font-sans`, `--font-serif`, `--font-mono` | system stacks |
| `type.heroPt`, `sectionPt`, `titlePt`, `bodyPt`, `subBodyPt`, `captionPt`, `codePt` | `--size-hero`, `--size-section`, `--size-title`, `--size-body`, `--size-subbody`, `--size-caption`, `--size-code` (in pt) | 44, 32, 28, 14, 12, 10, 12 |
| `layout.radiusPx`, `shadowOpacity`, `marginIn` | `--radius`, `--shadow-opacity`, `--margin` | 6px, 0.12, 0.5in |

In the base: headings `h1`–`h3` take `--font-serif` at the hero, section and title sizes; `h4` and `.kicker` are small capitals in `--color-accent`; body text is `--color-ink-body` at `--size-body`; a slide's padding is `--pad`, else `--margin`; `data-divider` slides sit on `--color-surface-alt` with an accent rule. The favicon is drawn from `ink`, `bg` and `accent`; the fonts link loads `type.sans`, `serif` and `mono` from Google Fonts unless they're system faces. A brand's `css/slideware.css` replaces the base and kit, not the custom properties.

When the brand changes in brandware, `check` says so and `refresh` replaces the block, its links and logos. `refresh --brand <name>` switches brands. A machine without the brand keeps the deck's copy. Brand resolution, registries and markers: [../../brandware/SKILL.md](../../brandware/SKILL.md).

## Lanes

A lane is the same deck worked for another audience: `lanes/<id>.json` lists what differs, and `index-<id>.html` is derived from it. An overlay holds:

- `name` and an optional `color`;
- `replace`: `[["Acme Corp", "Acme Investments"]]`, text replacements in slide text only;
- `overrides`: `{ "key": "s1-07", "id": "company", "html": "…" }` (an element's content), `"attrs": { "style": "…" }`, or `{ "key": "s1-09", "slide": "<section …>…</section>" }` (a whole slide);
- `figures`: `{ "company-map": "company-map@acme-investments" }`, with the variant in the asset block;
- `hidden` and `shown`: slide keys hidden or shown in this lane only.

Run `lanes` after editing the base or an overlay; the editor's save does it too. `check` flags an override that matches nothing, a lane file that's out of date, and a lane figure that's missing.

## Editing (the owner, in the browser)

Open `index.html` and press E. The editor loads from the plugin's data folder, which `new` and `refresh` keep current. It edits text on any element (double-click), moves, resizes and pins any element including figures, notes, comments for Claude, and the deck's structure in the overview (O). S saves into the file itself: the first save asks Chrome for the deck folder, once per browser session. Saving the base rebuilds every lane file; edits made in a lane view (the lane picker) go to that lane's overlay. B rebuilds every lane file and runs the in-browser checks. Safari and Firefox save through `serve`. The full reference: [references/runtime.md](references/runtime.md) §Editor.

Comments the owner leaves are HTML comments inside the slide, `<!-- @claude: … -->`. When asked to address them, find them (`grep -n "@claude:"`), make each change, and remove the comment.

When the owner has the deck open while you edit it, their page reloads on your change, keeping their unsaved edits.

## Workflow

1. **Resolve the style** (../SKILL.md), then `new`. Plan the slides: a deck of more than a dozen slides gets `data-divider` sections; vary the slide shapes (../SKILL.md §Anti-monotony).
2. **Write the slides** into `#sw-slides`, figures into `#sw-assets`, settings into `#sw-deck`.
3. **Check**: `check`, then `check --render`. Fix every error and warning.
4. **Look**: `export --png` and read every slide image at full size. Find at least one thing to improve per slide; fix, re-export, re-read. Two or three rounds is typical. For builds, open the deck with `?presenter` in a browser and step through.
5. **Hand over**: give the absolute path; tell the owner P presents, N shows the notes drawer, O the overview, E edits.

## Export and import

- `export --png` writes one picture per slide, fully built (hidden slides with `--all`).
- `export --pdf` writes one 1280 × 720 page per shown slide.
- `export --pptx` writes PowerPoint. Level 1, the default: each slide is a picture of the slide with its text hidden, and the text is native, editable text boxes on top; notes, the cue line and hidden slides carry over. Level 0: one picture per slide. A ledger beside the file lists what each slide became. Fonts are named, not embedded; tell the recipient which to install (`bash $PLUGIN/scripts/install-fonts.sh --check <brand>` lists them).
- `import --mode redesign` writes an outline (titles, text, notes) and a picture per page under `.slideware/import/`; author new slides in the deck's style from them.
- `import --mode faithful` writes a deck with every shape absolutely positioned (text, pictures, tables, fills, groups, notes, hidden slides). Its ledger lists what didn't come across (charts, SmartArt, EMF pictures); redraw charts with chartware.

## Old decks

A deck with its own `build-deck.js` and `slides.js` is the old format. When you meet one, convert it before changing anything:

1. `$CLI migrate <old-deck> --out <old-deck>-v2 --brand <name>` rebuilds it once with its own builder, converts every slide from that output, writes the new folder, rebuilds its lanes, and pixel-compares every slide in every lane against the old output. Name the brand the deck uses in brandware. Without `--brand`, it converts the old deck's theme into a brand kit at `<new-dir>/brand-kit/` (a `brand.md` and `css/slideware.css`) and builds the deck from that; move the kit into the brands directory (../../brandware/SKILL.md §Add / import), then `refresh --brand <name>`.
2. Report the comparison (slides over the threshold and their images in `migrate-report/`), and the kit if one was written.
3. Show the owner the list of old files the new folder replaces. Delete them, and swap the folders, only after the owner approves.

## Maintenance

A deck that states external facts ends with a sources slide (each source as a link, with the date it was checked), names its spec page in the settings (`"spec": "../unit.html"`), and marks slides with `data-teaches`. `check` prints how many slides name their section and whether the spec exists. The maintenance contract: [../../knowledgebase/references/maintenance.md](../../knowledgebase/references/maintenance.md) §7.
