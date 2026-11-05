# Gallery sources

The sources behind the images in `docs/images/`, so the gallery can be rebuilt after a visual change. Everything is rendered with the plugins' own tooling; nothing is mocked up. The deck images are built and photographed by `make-decks.js` with slideware's engine; the others are screenshotted with Playwright.

| Image | Built from |
|---|---|
| `styles.jpg` | `styles-sheet.html`: the five styles' own `css/<name>.css` and marks, light and dark, in iframes |
| `charts.jpg`, `diagram.jpg` | `charts-sheet.html` over `charts/*.svg`, richer variants of nine templates written by `make-charts.py`; the sheet links `styles/style-4/css/style-4.css` and inlines the SVGs, so their token blocks pick up Warm Sage. `?only=diagram-flow` renders the diagram alone |
| `decks.jpg` | `decks-sheet.html` over slides from three HTML decks that `make-decks.js` builds from `decks/style-{1,3,5}.html` (slide markup in the catalogue's patterns, with chart figures from `charts/`) |
| `presenter.jpg` | `presenter-sheet.html`: the style-1 deck's big-number slide and its presenter view (`index.html?presenter#/speed`) |
| `knowledgebase.jpg` | `kb-sheet.html` over `kb-upgrade.html` (the template's palette) and `kb-incident.html` (a dark palette set through the template's CSS variables) |

## Rebuilding

1. For the styles, charts and knowledgebase images, make a scratch folder and link the plugin's assets into it: `charts` → `plugins/knowledgeware/skills/chartware/templates/svg`, `styles` → `plugins/knowledgeware/styles`, and copy `mermaid.min.js` beside the two `kb-*.html` pages (the knowledgebase template loads it by that name).
2. Decks and the presenter view: from the repository root, `NODE_OPTIONS= node docs/gallery/make-decks.js <scratch-dir> --images`. It builds the three decks with slideware's engine (each must check clean), exports every slide, photographs the presenter view, lays out both sheets and writes `decks.jpg` and `presenter.jpg` into `docs/images/`. It needs Node 22+ and Chrome, nothing else. To change a deck, edit its `decks/style-N.html`: the first line names the style, title, footer and minutes; the slides use the catalogue's patterns (`cli.js catalog`), and `data-figure-ref` names a chart in `charts/` or chartware's templates.
3. The other pages: serve the scratch folder (`python3 -m http.server 8766`) and open them with Playwright. The knowledgebase pages are 1240×1500, with the incident page under `prefers-color-scheme: dark`.
4. Screenshot the remaining `*-sheet.html` pages at 1600 wide as JPEG with `fullPage` on a short viewport, and copy the results to `docs/images/`.
