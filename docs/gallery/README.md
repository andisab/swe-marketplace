# Gallery sources

The sources behind the images in `docs/images/`, so the gallery can be rebuilt after a visual change. Everything is rendered with the plugins' own tooling and screenshotted with Playwright; nothing is mocked up.

| Image | Built from |
|---|---|
| `styles.jpg` | `styles-sheet.html`: the five styles' own `css/<name>.css` and marks, light and dark, in iframes |
| `charts.jpg` | `charts-sheet.html`: nine of chartware's SVG templates as they ship |
| `decks.jpg` | `decks-sheet.html` over slides from three HTML decks built with slideware from `deck-style-{1,3,5}.slides.js` |
| `presenter.jpg` | `presenter-sheet.html`: the style-1 deck's slide 2 and its presenter view (`index.html?presenter#/1`) |
| `knowledgebase.jpg` | `kb-sheet.html` over `kb-upgrade.html` (the template's palette) and `kb-incident.html` (a dark palette set through the template's CSS variables) |

## Rebuilding

1. Make a scratch folder and link the plugin's assets into it: `charts` → `plugins/knowledgeware/skills/chartware/templates/svg`, `styles` → `plugins/knowledgeware/styles`, and copy `mermaid.min.js` beside the two `kb-*.html` pages (the knowledgebase template loads it by that name).
2. For each `deck-style-N.slides.js`, scaffold a deck as the slideware html workflow describes (`load-style.js style-N -o style.md`, the four template files, `npm install`), save the file as `slides.js`, and run `node build-deck.js .`. The chart slides reference `../charts/<name>.svg`.
3. Serve the folder (`python3 -m http.server 8766`) and open the pages with Playwright. Each deck slide needs its own page load, because Reveal doesn't move on a hash-only navigation: use `index.html?v=N#/N`, wait 1.5 s, screenshot at 1280×720. The presenter view is 1280×800; the knowledgebase pages are 1240×1500 with the incident page under `prefers-color-scheme: dark`.
4. Screenshot the `*-sheet.html` pages at 1600 wide as JPEG with `fullPage` on a short viewport, and copy the results to `docs/images/`.
