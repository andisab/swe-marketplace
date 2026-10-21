# Reveal.js notes

Reveal.js conventions used by `build-deck.js`, plus the gotchas to remember.

## Pinned version

`REVEAL_VERSION = "5.0.5"` in `build-deck.js`. Bumping is a deliberate change — diff the output HTML after; new versions occasionally rename CSS classes or change initialization options.

CDN URLs:

```
https://cdn.jsdelivr.net/npm/reveal.js@5.0.5/dist/reveal.css
https://cdn.jsdelivr.net/npm/reveal.js@5.0.5/dist/reveal.js
```

Both are pinned. Don't use `@latest`.

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
  controls: true,       // arrow buttons in lower-right
  progress: true,       // progress bar at bottom
  slideNumber: 'c/t',   // "3/12" indicator
  transition: 'fade',   // not 'slide' — fade is calmer
  plugins: [RevealPresenter],  // presenter.js, inlined by build-deck.js (see §Speaker notes)
}
```

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

In the presenter, the current session's length is an editable field in the header, next to the resulting time per slide. An edit is saved in that browser and wins until the deck's own length for that session changes, so a rebuilt deck never loses to a stale edit.

### Presenting

| Window | What it does |
|---|---|
| Audience (the deck) | `S` or `P` opens the presenter window. `P` replaces Reveal's "previous slide" key; the arrows, Space and Page Up/Down still navigate. `N` toggles a notes drawer at the bottom of the deck, for rehearsal: anyone who can see the screen can read it. `?` lists every key. |
| Presenter (`?presenter`) | A dark header with the slide number, the session's length (editable) and time per slide, the pace line, the timer (Pause, Reset) and the clock. Below it, previous slide, current slide (the largest) and next slide across the top, with the notes full width below. Drag a sidebar's border to resize that sidebar: the other border stays put, the current slide fills the width between the sidebars, and the notes take the height it leaves. Drag the border above the notes to resize the current slide; the sidebars split the difference. Borders stop at the sidebar limits (10–30% of the window) or when the notes would get too short. Double-click a border to reset it, or focus it and use the arrow keys. Panes sit 8px apart, and no slide ever has empty space beside it. The header's Prev and Next buttons (or `[` and `]`) hide and show the sidebars; a hidden sidebar's width goes to the current slide. With both hidden, the border above the notes sets the slide's height directly, and the slide is centred. Long notes scroll, with a scrollbar that stays visible while they overflow. The previous and next slides are scaled copies shown fully built, each titled in text since body text is too small to read at sidebar size; before the first slide and after the last, the sidebar shows START or END. When the current slide still has build steps, the next sidebar says how many. `+`/`-` or A−/A+ change the notes text size. The timer starts on the first move; the pace line reads like "Plan 12 min · 2 min behind". |

Either window moves both. Sync uses BroadcastChannel plus `window.postMessage`, so it works over HTTP and from `file://`. Slide position, build steps and blackout (`B`) all sync. Pane sizes, hidden sidebars, text size and edited session lengths are saved per browser in `localStorage`. Pressing `S` again after reloading the deck reuses the open presenter window, so its timer keeps running.

### Customizing

Edit the deck directory's copy of `presenter.js` and rebuild: styles live in its `CSS` string, the presenter layout in `SHELL_HTML`, sidebar width limits in `SIDE`, the smallest slides row and notes pane in `ROW_MIN` and `NOTES_MIN`, the gap between panes in `GUTTER`. The plugin uses only Reveal's public API (`on`, `slide`, `getIndices`, `configure`, `addKeyBinding`, `getSlideBackground`), so Reveal upgrades within 5.x shouldn't break it. The previous and next copies have two limits: they always show the slide fully built, and scripts inside slides don't run in them.

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
