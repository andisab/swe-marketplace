# slideware

Notes for people who run or change the skill. `SKILL.md` is what Claude reads; the user-facing tour, the five styles and the optional tooling are in the [plugin README](../../README.md#slideware-decks-in-powerpoint-or-html).

## What it makes

Slide decks in two output formats, chosen per request (the skill asks when the request doesn't say):

- **pptx** (`pptx/`): real PowerPoint files through pptxgenjs, with React-rendered icons. They open in PowerPoint, Keynote and Google Slides. Speaker notes open with a cue line holding each slide's planned time.
- **html** (`html/`): one self-contained `index.html` through Reveal.js, inlined so the deck runs offline, from any browser or a static host. It ships a presenter view (previous, current and next slides, notes, live pacing), a section overview (`O`), a navigation pill with a key list, an optional running footer with the brand's logo, lanes (one deck worked for several audiences, one file per lane), entrance motion, and an optional review mode (`review: true`), which writes a sibling `index.review.html`: there `E` edits text and speaker notes in the browser, `L` edits a slide's layout (nudge, resize, reorder, delete), the overview hides, deletes and reorders slides, a connected deck folder saves `edits.json` by itself and reloads the page when a build lands, `Shift+B` rebuilds through `html/scripts/serve-deck.js`, and every build folds `edits.json` back into `slides.js`. The plain `index.html` carries none of it and is the file to share.

Both formats carry the same speaker notes, session pacing and hidden slides (`SKILL.md` §Speaker notes), and both render from the same style: a name resolved through the plugin's registry, the brandware skill's resolution contract. The deck builders never read a style by path; they stage it with the loader (`scripts/load-style.js` for pptx tokens, `html/scripts/load-style.js` for the HTML deck's `style.md`).

## Six ways people prompt it

The skill activates on words like "deck", "slides", "presentation", "pitch", "pptx", "reveal" and "HTML deck", or when a `.pptx` or slide-deck `.html` appears as input or output. Format cues ("PowerPoint" or "share a link") route to pptx or html. Beyond that, what the user hands over decides how the deck is styled.

1. **A style or brand by name.** *"Build me a 6-slide deck on our code review policy. Use style-3."* *"Match the acmecorp brand."* Names resolve through the registry (`node scripts/list-styles.js` lists them). With no name, the `.knowledgeware` and `DEFAULT` markers decide, and failing those the skill uses `style-1` and says so.
2. **A local CSS or markdown brandbook.** *"Use the brandbook at `~/work/acme-brand.css`."* The loader extracts palette, typography and layout tokens; the brandbook spec is `skills/brandware/references/brandbook-spec.md`.
3. **A website.** *"Match the visual style of https://example.com."* `scripts/derive-style.js` scrapes the HTML and CSS into a brandbook. It's a heuristic, so the skill asks the user to verify the palette against the live site.
4. **A Google Drive link.** `scripts/fetch-resource.py` turns the share link into a download; the file must be shared with anyone who has the link.
5. **A sample deck to mimic.** *"Match the visual style of `last-quarter-roadmap.pptx`."* The skill renders the sample, reads a few slides, derives the visual language, and writes new content in it. Style only, never the sample's content.
6. **An existing deck in a new style.** *"Rebuild `q3-review.pptx` with the acmecorp brand."* pptxgenjs is write-only, so this is a rebuild: extract the content, render the old deck for reference, build fresh, write to a new path, offer a visual diff. HTML decks rebuild from their `slides.js`.

## Workflow

Both formats follow the same path: gather inputs, resolve the style, plan layouts (12 pptx archetypes, 8 HTML archetypes, varied per the anti-monotony rule), author the source, build, run the checker, review every slide visually, iterate. A throwaway deck of up to three slides skips the review loop. The steps and commands are in `pptx/references/workflow.md` and `html/references/workflow.md`.

## What it won't do

- Edit an existing `.pptx` in place. pptxgenjs is write-only, so a reformat is a rebuild.
- Embed fonts. A brandbook names them; PowerPoint and the browser substitute when they're missing (the skill installs a style's Google Fonts for pptx builds).
- Render gradients through the pptxgenjs API. Use a gradient image as a background.
- Invent content from a thin brief. It proposes an outline and asks before building.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Activation, format choice, the shared rules (style resolution, notes and pacing, citations, provenance, review mode) |
| `pptx/FORMAT.md`, `html/FORMAT.md` | What Claude follows after choosing a format: mechanics, pitfalls, output convention |
| `pptx/references/{workflow,layout-patterns,visual-principles,pptxgenjs,canonical-samples}.md` | pptx build path, 12 archetypes, design principles, API gotchas, how to use the sample decks |
| `html/references/{workflow,layout-patterns,visual-principles,reveal}.md` | HTML build path, 8 archetypes, design principles, Reveal.js conventions (presenter, overview, lanes, review mode, motion) |
| `pptx/assets/templates/starter-deck.js` | pptx scaffold with the checklist and pitfalls inline |
| `pptx/assets/samples/<name>/` | Three sample decks: build script, token file, rendered previews |
| `html/assets/templates/{build-deck,presenter,review,slides}.js`, `package.json` | The HTML deck builder, the presenter plugin inlined into every deck, the review-mode plugin inlined on request, the slide-descriptor scaffold, the pinned Reveal dependency |
| `pptx/scripts/{polish-deck.py,render-slides.sh,text-fit.js}` | pptx pre-render checks, LibreOffice previews, text-capacity estimates |
| `html/scripts/{load-style.js,polish-deck.py,render-slides.sh,serve-deck.js}` | The `style.md` converter (it imports the plugin's parser), HTML checks, headless-Chromium previews, the local server review mode rebuilds through |
| `pptx/evals/`, `html/evals/` | Eval fixtures for the skill; no test runs them |
| `../../scripts/{registry,load-style,list-styles,derive-style}.js`, `fetch-resource.py`, `install-fonts.sh` | Plugin-level: the registry, the parser, listing, website derivation, Drive downloads, fonts |
| `../../styles/` | The five generic styles and the `brands/` folder with the `acmecorp` template; your own brands live in `$KNOWLEDGEWARE_BRANDS_DIR` |

## Tests

`tests/deck-review-test.js` at the plugin root builds a temporary HTML deck against stub dependencies and covers the builder's markup, review mode's inlining, the fold of `edits.json` and `serve-deck.js`; `tests/registry-test.js` covers the registry and both loaders. Both run from `scripts/validate-all.sh` at the repository root and in CI.
