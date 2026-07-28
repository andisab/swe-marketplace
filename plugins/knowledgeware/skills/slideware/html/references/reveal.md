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

Reveal supports speaker notes via `<aside class="notes">` inside a `<section>`:

```html
<section>
  <h1>Topic</h1>
  <aside class="notes">Don't forget to mention the 2024 incident.</aside>
</section>
```

Press `S` during presentation to open the speaker view (notes + next-slide preview + timer).

`build-deck.js` doesn't currently emit `<aside class="notes">` — add `notes` to the slide descriptor schema and inject it in `renderSlide` if needed.

## Known quirks

- **FOIT during first load**: without `display=swap` on the Google Fonts URL, text is invisible until fonts load (~1-2s). The current build URL includes `display=swap`.
- **Local file:// access** to `file:///` URLs blocks ES module imports on some browsers. Reveal works because we use the UMD bundle (`reveal.js` not `reveal.esm.js`).
- **Print mode breaks fixed-position elements**. Footer text in `layout-title` uses `position: absolute` — render to PNG via headless Chrome instead of using print-PDF if footers matter.
- **Speaker view requires popup permissions**. If `S` doesn't open a window, check browser popup blocker.

## Where Reveal.js docs live

- Quick start: https://revealjs.com/installation/
- Init options: https://revealjs.com/config/
- Vertical slides: https://revealjs.com/vertical-slides/
- Plugins (highlight, math, search): https://revealjs.com/plugins/

The default `build-deck.js` does not pull plugins to keep the output simple. Add them by extending the `<head>` of `pageHtml()` and the init block.
