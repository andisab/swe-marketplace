# Reveal.js notes

Reveal.js conventions used by `build-deck.js`, plus the gotchas to remember.

## Pinned version

`REVEAL_VERSION = "5.0.5"` in `build-deck.js`, and `"reveal.js": "5.0.5"` in the template `package.json`. Bumping is a deliberate change to both — diff the output HTML after; new versions occasionally rename CSS classes or change initialization options.

The build reads `dist/reveal.js` and `dist/reveal.css` from the deck dir's `node_modules` (`npm install`) and inlines them, so a deck runs with no network: from `file://`, on a laptop with no wifi, from any static host. It refuses to build if the installed version doesn't match `REVEAL_VERSION`. Only the Google Fonts `<link>` still needs a network; offline, text falls back to the system fonts the brandbook names. (The npm package's banner says 5.0.4; the code is the published 5.0.5, byte-identical to the CDN file.)

## Slide frame

`Reveal.initialize({ width: 1280, height: 720, ... })` in the page assembly. Reveal scales the slide frame to fit the viewport while preserving the 16:9 aspect ratio. This means:

- Authoring is at 1280×720 logical pixels.
- Browser zoom and viewport size don't change layout — Reveal handles the scaling.
- Don't author with viewport-relative units (`vw`, `vh`) — use the fixed token units instead.

## CSS scoping

All theme rules MUST be scoped under `.reveal`. Reveal's reset is aggressive — `* { margin: 0; padding: 0; box-sizing: border-box; }` and similar rules clobber unscoped declarations.

```css
/* Wrong — gets clobbered */
h1 { color: red; }

/* Right */
.reveal h1 { color: red; }
```

Section-specific rules go deeper:

```css
.reveal section.layout-title h1 { font-size: 80pt; }
```

## Section element conventions

Each slide is a single `<section>` inside `<div class="slides">`. Reveal also supports vertical slides via nested `<section>` elements:

```html
<section>
  <section>Top slide</section>
  <section>Slide below top</section>
</section>
```

`build-deck.js` does not currently emit vertical slides — every slide is top-level. If you need vertical slides for a kiosk or branching narrative, extend the renderer.

## Init options used

```js
{
  width: 1280,
  height: 720,
  hash: true,           // URL updates per slide — sharable deep links
  controls: false,      // the presenter plugin's navigation pill replaces the arrows
  progress: true,       // progress bar at bottom
  slideNumber: 'c/t',   // "3/12" indicator
  transition: 'fade',   // not 'slide' — fade is calmer
  plugins: [RevealPresenter],  // presenter.js, inlined by build-deck.js (see §Speaker notes)
}
```

`presenter.js` then sets `overview: false`: Reveal's zoomed-out overview gives way to the plugin's section overview on the same key (§Speaker notes, Presenting).

Override these in `build-deck.js`'s `Reveal.initialize` block only when you have a specific reason:

- **Kiosk mode**: set `autoSlide: 10000`, `loop: true`, `controls: false`.
- **Walkthrough recording**: `transition: 'none'` (cuts feel sharper on video).
- **Anchor sharing**: keep `hash: true` (default).

## Background colors

Reveal reads `data-background-color` on each `<section>` for slide background:

```html
<section data-background-color="#0D0D0D">...</section>
```

Currently `build-deck.js` doesn't emit this attribute — slides inherit the `.reveal` background (`var(--color-bg)`). To support per-slide backgrounds, add `dataBackgroundColor` to the slide descriptor schema and extend the renderer.

## Print to PDF

Reveal can print decks to PDF via the browser's print dialog. Workflow:

```
Open index.html?print-pdf in Chrome
File → Print → Save as PDF
```

The `?print-pdf` URL parameter activates print mode. Useful for handouts.

## Speaker notes

Decks ship with **`presenter.js`**, our own Reveal plugin. `build-deck.js` inlines it and registers it as `plugins: [RevealPresenter]`. It replaces Reveal's notes plugin (RevealNotes), which the build doesn't load: that plugin's speaker view is HTML compiled into the plugin, so it can't be restyled or extended without a fork. Don't register both, since both bind `S`.

### Authoring

Any slide descriptor takes three optional fields:

```js
{
  layout: "card-row", title: "…", cards: [ /* … */ ],
  notes: "Plain text.\n\nBlank lines split paragraphs.\n\n- Lines starting \"- \" form a list\n- **bold**, *italic* and [pause] are rendered",
  cue: { session: "Session 1", module: "Module 3.5", run: "default" },
  hidden: true,   // not shown and not counted; Reveal drops it when the deck loads
}
```

| Cue field | Meaning |
|---|---|
| `session` | Label such as "Session 1". Slides with the same label share that session's length, and the pace plan restarts where the session changes. |
| `module` | Label shown in the notes drawer's cue line, such as "Module 3.5" or "Intro". |
| `run` | `default` (in the run) · `cut-first` (in the run, first to cut when behind) · `add-back` (use if ahead) · `backup` (for questions). Only `default` and `cut-first` slides are in the run. |

The builder emits `<aside class="notes" data-session data-module data-run>` and, for `hidden`, `data-visibility="hidden"` on the `<section>`. It rejects unknown cue fields and `run` values. Hand-written decks can use the same markup, or Reveal's `data-notes` attribute on the `<section>`.

### Pacing

Pacing comes from session lengths, set next to the slides in `slides.js`:

```js
module.exports = {
  sessions: { "Session 1": 90, "Session 2": 90 },   // minutes, keyed by cue.session
  // minutes: 45,                                    // instead, for a deck without sessions
  slides: [ /* … */ ],
};
```

Each slide in the run gets an equal share of its session's length; add-back, backup and hidden slides get none. The plan at a slide is that share times the in-run slides before it in its session, and the pace line compares it with the timer. A plain array export still works, with no pace plan until a length is entered in the presenter. The builder emits the lengths as `Reveal.initialize({ presenter: { sessions } })` and rejects lengths for session labels no slide uses.

Every build prints a summary: each session's length, slides in the run and time per slide, then the hidden slides by their position in `slides.js`. When asked to hide or show slides, change a session's length, or report which slides are hidden, edit `slides.js`, rebuild, and quote that summary.

### Running footer and logo

Two more deck-level fields next to `slides`:

```js
module.exports = {
  footer: ["AI-native SDLC with Claude Code", "Advanced session"],   // or one string
  // logo: "./assets/mark.svg",   // another SVG for the footer; false for none
  slides: [ /* … */ ],
};
```

With `footer` set, every slide but the title slide carries a running footer: the text on the left (array items dot-separated), the logo and the page number (`07 / 27`, visible slides only) on the right, in the mono caption treatment. Reveal's own slide number turns off; the progress bar stays. The builder also reserves the bottom band: slides get `padding-bottom: max(var(--margin), 40px)`, so nothing but the footer sits in the bottom 40px.

The logo is the brand's: `load-style.js` copies `logo-light.svg` and `logo-dark.svg` from the brand's `assets/` folder into the deck's `./assets/` when it stages `style.md`, and the builder inlines `logo-light.svg` on a light background or `logo-dark.svg` on a dark one (by the luminance of `palette.bg`), whichever exists. The five generic styles have a mark but no logo, so a deck in a generic style gets a footer with no logo; `logo` names another SVG, and `logo: false` leaves it out. The build prints which file it used, or that it found none.

Every deck also gets a tab icon: a rounded square in the style's ink, a slide in its background colour and an accent bar, as a data-URI SVG in `<head>`, so a deck tab is distinguishable from a knowledge-base tab.

### Lanes

A lane is the same deck worked for another audience or example (a second customer, a second industry) without a second `slides.js`. Give the slides that change a `key`, write one overlay file per lane, and list the overlays next to `slides`:

```js
// slides.js
module.exports = {
  lane: "Acme Corp",                                                    // the base deck's name in the switcher (default "Base")
  lanes: ["./lanes/acme-investments.js", "./lanes/acme-life-sciences.js"],
  slides: [
    { key: "cover", layout: "title", title: "Platform reliability review", subtitle: "Q3 findings" },
    { key: "drift", layout: "bigNumber", figure: "41", unit: "%", label: "Of Sev-2 incidents traced to config drift" },
    /* … */
  ],
};

// lanes/acme-investments.js
module.exports = {
  name: "Acme Investments",                                  // shown in the lane switcher; the id is the file name
  replace: [["Acme Corp", "Acme Investments"], ["config drift", "trade-config drift"]],   // over every text field
  slides: { drift: { figure: "37", context: "Source: the trading platform's incident ledger." } },   // fields replaced whole, by key
  color: "#2F7DE1",   // optional: the lane's colour in the overview; lanes without one take a palette in turn
};
```

One build writes `index.html` for the base deck and `index-<id>.html` per lane (the id is the overlay's file name without `.js`). An overlay's `slides` map replaces the named fields of the slide with that `key` (an unknown key fails the build, as do duplicate keys), then `replace` pairs run over every string in every slide except `layout`, `key`, `src`, `cue`, `motion` and `hidden`, so they change words, not structure. Pacing, hidden slides, the footer and the style are shared by all lanes; the page title gains the lane's name.

Every output lists all of them in the overview's header: a Lane switcher before the Close button that opens the same slide (same hash) in the chosen file, with a swatch in the lane's colour (ink for the base deck; each lane's name is drawn in its colour in the list). In a deck with lanes every thumbnail carries a bar along its base: ink for a slide as the base deck has it, the lane's colour for a slide the lane changes, which the builder marks with `data-lane-changed` by comparing each lane's slides with the base deck's. The builder passes the list as `Reveal.initialize({ presenter: { lanes: [{ name, file, color, current }] } })`, and the plugin shows the switcher when there are two or more. Nothing marks the lane on the slides themselves. Lane outputs sit next to `index.html`, so keep them together when hosting or sharing.

In the presenter, the current session's length is an editable field in the header, next to the resulting time per slide. An edit is saved in that browser and wins until the deck's own length for that session changes, so a rebuilt deck never loses to a stale edit.

### Presenting

| Window | What it does |
|---|---|
| Audience (the deck) | `S` or `P` opens the presenter window. `P` replaces Reveal's "previous slide" key; the arrows, Space and Page Up/Down still navigate. `N` toggles a notes drawer at the bottom of the deck, for rehearsal: anyone who can see the screen can read it, and the deck re-fits into the space above it (`--rp-reserve-bottom` on `<html>`; review mode's panel uses the same property). `O` toggles the section overview (below). `E` and `Shift+B` are review mode's, when the deck was built with it (below). `?` lists every key. |
| Navigation pill (audience window) | A floating bar at the bottom, centred: previous, the slide number (`04 / 13`, visible slides), next, the current section's name (the nearest `section` slide's title; "Opening" before the first), the overview button, fullscreen, and an `i` whose tooltip lists every key (hover or focus shows it, a click pins it, Esc or a click elsewhere unpins; review mode's keys appear when the deck has it). It appears for 2.5 s after the mouse moves or a touch, and while hovered or focused, and sits above the notes drawer, whose text keeps clear of it; it is hidden in print, in the presenter window and under the overview. Drawn from the deck's tokens (`--color-surface` at 92% with a blur, `--color-ink`, `--color-border`, the accent for focus), so a dark style gives a dark pill. It replaces Reveal's arrows: the builder sets `controls: false`. |
| Overview (`O` in either window, or open the deck with `?overview`) | Every slide as a thumbnail, in a grid per section: each `section` slide heads its group with its kicker and title and a slide count, the slides before the first divider are grouped as "Opening", and a deck with no section slides is one grid. Thumbnails are fully built copies of the slides, captioned with the slide number and heading (a big number's label, a quote's text). The current slide is outlined; a click goes to that slide and closes the overview, the arrow keys move between thumbnails and Enter goes, Esc or `O` closes. The panel is drawn from the deck's own tokens (`--color-surface-alt` behind the grid, `--color-ink`, `--color-accent`, `--color-border`, the serif for headings and the mono for numbers), so it matches whatever style the deck uses. While it's open the deck behind it takes no keys or clicks. It replaces Reveal's zoomed-out overview, which the plugin turns off (`overview: false`); Reveal's `?` help still lists its own "ESC, O" line above the plugin's. Hidden slides aren't in it. |
| Presenter (`?presenter`) | A dark header with the slide number, the session's length (editable) and time per slide, the pace line, the timer (Pause, Reset) and the clock. Below it, previous slide, current slide (the largest) and next slide across the top, with the notes full width below. Drag a sidebar's border to resize that sidebar: the other border stays put, the current slide fills the width between the sidebars, and the notes take the height it leaves. Drag the border above the notes to resize the current slide; the sidebars split the difference. Borders stop at the sidebar limits (10–30% of the window) or when the notes would get too short. Double-click a border to reset it, or focus it and use the arrow keys. Panes sit 8px apart, and no slide ever has empty space beside it. The header's Prev and Next buttons (or `[` and `]`) hide and show the sidebars; a hidden sidebar's width goes to the current slide. With both hidden, the border above the notes sets the slide's height directly, and the slide is centred. Long notes scroll, with a scrollbar that stays visible while they overflow. The previous and next slides are scaled copies shown fully built, each titled in text since body text is too small to read at sidebar size; before the first slide and after the last, the sidebar shows START or END. When the current slide still has build steps, the next sidebar says how many. `+`/`-` or A−/A+ change the notes text size. The timer starts on the first move; the pace line reads like "Plan 12 min · 2 min behind". |

Either window moves both. Sync uses BroadcastChannel plus `window.postMessage`, so it works over HTTP and from `file://`. Slide position, build steps and blackout (`B`) all sync. Pane sizes, hidden sidebars, text size and edited session lengths are saved per browser in `localStorage`. Pressing `S` again after reloading the deck reuses the open presenter window, so its timer keeps running.

### Review mode

A deck built with `review: true` next to `slides` in `slides.js` (or with `node build-deck.js . --review`) also inlines `review.js`, a second plugin, so text and speaker notes can be edited in the browser and folded back into `slides.js`. Decks built without it carry none of the code. The builder marks every text field it renders with `data-f="<field>"` (`title`, `kicker`, `cards.1.body`, `items.0`, the notes aside `notes`), light-HTML fields also with `data-html`, and every `<section>` with `data-key`: the slide's `key`, else `s<n>` by its position in `slides.js`. These attributes are on every deck, review or not; they cost nothing and make a slide addressable.

| Key | What it does |
|---|---|
| `E` | Toggle review mode. Every marked field becomes editable in place: plain text for the escaped fields, light HTML (`<strong>`, `<em>`, `<code>`, `<br>`, `<a>`, lists) for `left`, `right`, card bodies and bullet items, which are cleaned on save (`<b>` becomes `<strong>`, a browser's `<div>` becomes `<br>`, anything else unwraps). A panel along the bottom holds the slide's speaker notes as plain text and a comment box for whoever edits the deck next. The arrows still move slides while no field has focus; Enter or Esc leaves a field. A bar at the top counts the edits and holds Save, Copy, Rebuild, Discard and Done. |
| `Shift+B` | Rebuild: a confirm bar, then the edits are saved, `node build-deck.js .` runs and the page reloads on the same slide. This needs the deck served by `serve-deck.js` (below); over `file://` or a plain static server the bar says so and offers Save instead. `B` alone is still Reveal's blackout. |

**The overview edits the deck's structure** while the deck has review mode. `O` shows every slide as built, hidden ones included under a mask in the panel's background colour, in the pending order. On each thumbnail an eye hides or shows the slide in the lane being viewed and an X deletes it (the thumbnail stays, struck through, with Undo); thumbnails drag and drop into a new order (drop on the left half of a thumbnail to go before it, the right half to go after). On a focused thumbnail `H`, `Delete` and `Shift+arrows` do the same. A Rebuild deck button beside Close is outlined while nothing is queued and solid (`--color-success`) when anything is, and it opens the same confirm bar as `Shift+B`. The deck itself doesn't change until the rebuild, so a hidden or deleted slide still presents until then; the overview numbers the slides as the next build will. Two refusals come as pop-ups: a deck whose slides carry no keys (built before review mode, or by hand) is asked to be rebuilt first, and hiding or deleting a slide in a lane is refused when the slide has no `key` of its own in `slides.js` (the builder marks those `data-key-auto`), since a lane overlay can't address it; add a key and rebuild.

Edits are kept in the browser (`localStorage`, per deck file and per build) until saved, so a closed tab loses nothing; a draft made on an earlier build is dropped, since its text may be gone. **Save** writes `edits.json` next to the deck: through `serve-deck.js` when the deck is served by it, else with the browser's save dialog (Chrome and Edge remember the file for the session), else as a download to move next to the deck. **Copy** puts the same JSON on the clipboard, to paste to Claude. The file holds only what changed, keyed by slide and field, with the text as built so the fold can find it:

```json
{ "built": "2026-10-29T16:25:13.218Z", "lane": null, "file": "index.html",
  "keys": ["cover", "s2", "s3", "s4", "s5"],
  "slides": { "s4": { "cards.0.heading": { "from": "Card 1", "to": "Card one" },
                      "notes": { "from": "What to say.", "to": "What to say, shorter." },
                      "comment": "Card 3 needs a stronger verb" } },
  "deck": { "hidden": { "s3": true }, "deleted": ["s5"], "order": ["s2", "cover", "s3", "s4", "s5"] } }
```

`keys` is every slide's key in the built order, and `deck` the overview's structural edits, present only when there are any.

**Every build folds `edits.json` first**, before it reads `slides.js`: each `from` is looked up as a string literal in `slides.js` (or in the lane's overlay when the edits were made in a lane) and rewritten to `to` in the same quote style, leaving the file's comments and layout alone; the build prints what it folded. A `from` the file doesn't hold exactly once (the same text on two slides, text already changed, a light-HTML field the browser rewrote beyond recognition, notes on a slide that had none) can't be placed, so it stays in `edits.json`, is layered over that build so the deck still shows it, and is printed with its reason for folding by hand. Comments stay in the file too, printed on every build. `edits.json` is deleted when nothing is left. Edits made in a lane's output go to that lane's overlay only; text a lane inherits from the base deck can't be folded from the lane, so it's layered and reported.

The `deck` section folds into the slide list itself: the builder splits `slides.js`'s `slides: [ … ]` into its slide objects (each must be a plain object literal, and `keys` must still match the file), rewrites them in the new order without the deleted ones, each with the comments above it, and sets or clears `hidden` on the ones toggled, then re-reads the file to prove the result before keeping it. In a lane, hidden and deleted both become `hidden: true` or `false` in that lane's overlay under the slide's own `key` (a slide without one is reported: give it a key), and the order goes to `slides.js`, since every lane shares it. Whatever can't be folded is layered over that build and reported.

**`serve-deck.js`** (`node $PLUGIN/skills/slideware/html/scripts/serve-deck.js [deck-dir] [--port 8010]`) serves the deck on `127.0.0.1` only and answers `POST /__edits` (writes `edits.json`) and `POST /__build` (runs the build; `{ "review": true }` in the body adds `--review`, which review.js sends so a deck built that way keeps its review mode). It is what makes `Shift+B` a one-key loop: edit, rebuild, see the result on the same slide. It is also a fine way to serve a deck for Claude in Chrome.

Three ways a rebuild happens: ask Claude to "apply my edits" or "rebuild the deck" (it runs the build, which folds the file, then reads any comments and leftovers the build printed and acts on them); any build at all, since the fold runs every time; or `Shift+B` in the deck (the Rebuild deck button in the overview does the same).

### Customizing

Edit the deck directory's copy of `presenter.js` and rebuild: styles live in its `CSS` string (the overview's under the `.rp-ov` rules, its thumbnail width the grid's `minmax(240px, 1fr)`; the pill's under `.rp-hud`, its markup in `HUD_HTML`), the presenter layout in `SHELL_HTML`, sidebar width limits in `SIDE`, the smallest slides row and notes pane in `ROW_MIN` and `NOTES_MIN`, the gap between panes in `GUTTER`. The overview groups on `section.layout-section`; a hand-written deck gets groups by giving its divider slides that class (and a `.kicker` for the small label). The plugin uses only Reveal's public API (`on`, `slide`, `getIndices`, `configure`, `addKeyBinding`, `getSlideBackground`), so Reveal upgrades within 5.x shouldn't break it. `review.js` is laid out the same way (its styles in `CSS`, the bar in `BAR_HTML`, the panel in `PANEL_HTML`, the allowed tags in `ALLOWED`). The slide copies in the sidebars and the overview have two limits: they always show the slide fully built, and scripts inside slides don't run in them.

## Entrance motion

Elements with `data-a` animate in each time their slide becomes current, staggered by the `--i` custom property (100ms, then 70ms per step). Kinds: `up`, `fade`, `left`, `right`, `pop`, `grow-x`, `grow-y`, `wipe`, and `draw` (SVG strokes; the shape needs `pathLength="1"`). Motion is off in print, for viewers who ask for reduced motion, and in the presenter view, which shows each slide fully in place.

- **Whole deck (on by default):** every layout's blocks animate in reading order: kicker, heading, then each card, list item or column. The big number pops; quotes and images fade. `motion: false` next to `slides` in `slides.js` turns it off for the deck.
- **One slide:** `motion: true` or `false` on a descriptor overrides the deck setting.
- **Hand-placed:** light-HTML body strings can carry their own attributes, such as `<span data-a="fade" style="--i: 4">…</span>`.

Motion is for arrival, not for steps: use fragments when the presenter should reveal a block on a keypress.

## Known quirks

- **FOIT during first load**: without `display=swap` on the Google Fonts URL, text is invisible until fonts load (~1-2s). The current build URL includes `display=swap`.
- **Local file:// access** to `file:///` URLs blocks ES module imports on some browsers. Reveal works because we use the UMD bundle (`reveal.js` not `reveal.esm.js`).
- **Print mode breaks fixed-position elements**. Footer text in `layout-title` uses `position: absolute` — render to PNG via headless Chrome instead of using print-PDF if footers matter.
- **The presenter view needs popups.** If `S` does nothing, allow popups for the page. The console logs a warning when the popup is blocked.

## Where Reveal.js docs live

- Quick start: https://revealjs.com/installation/
- Init options: https://revealjs.com/config/
- Vertical slides: https://revealjs.com/vertical-slides/
- Plugins (highlight, math, search): https://revealjs.com/plugins/

Apart from `presenter.js`, the default `build-deck.js` loads no plugins, to keep the output simple. Add them by extending the `<head>` of `pageHtml()` and the init block.
