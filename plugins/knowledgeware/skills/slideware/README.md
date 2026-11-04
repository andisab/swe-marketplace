# slideware

Notes for people who run or change the skill. `SKILL.md` is what Claude reads; the user-facing tour, the five styles and the optional tooling are in the [plugin README](../../README.md#slideware-decks-in-powerpoint-or-html).

## What it makes

Slide decks in two output formats, chosen per request (the skill asks when the request doesn't say):

- **pptx** (`pptx/`): real PowerPoint files through pptxgenjs, with React-rendered icons. They open in PowerPoint, Keynote and Google Slides. Speaker notes open with a cue line holding each slide's planned time.
- **html** (`html/`): one self-contained `index.html` that is both the deck's source and the file people open, offline, in any browser, with no build step and nothing installed per deck. The runtime and the brand are inlined; the editor, the engine and the exports stay in the plugin. It ships a presenter view (previous, current and next slides, notes, live pacing), a section overview (`O`), a notes drawer (`N`), a navigation pill with a key list, an optional running footer with the brand's logo, builds, entrance motion, and lanes (one deck worked for several audiences, each lane a derived file). The owner presses `E` to edit in the browser: text anywhere, notes, comments for Claude, free move, resize and pin of any element, and the slide order; `S` saves into the file itself, and `B` rebuilds the lane files and runs the checks. The engine exports pictures, PDF and PowerPoint and imports PowerPoint.

Both formats carry the same speaker notes, session pacing and hidden slides (`SKILL.md` §Speaker notes), and both render from the same style: a name resolved through the plugin's registry, the brandware skill's resolution contract. The deck builders never read a style by path; they load it through `scripts/load-style.js`: pptx builds read the tokens, and the HTML engine copies the brand into the deck (tokens as CSS custom properties, plus the brand's `css/slideware.css` when it ships one).

## Six ways people prompt it

The skill activates on words like "deck", "slides", "presentation", "pitch", "pptx" and "HTML deck", or when a `.pptx` or slide-deck `.html` appears as input or output. Format cues ("PowerPoint" or "share a link") route to pptx or html. Beyond that, what the user hands over decides how the deck is styled.

1. **A style or brand by name.** *"Build me a 6-slide deck on our code review policy. Use style-3."* *"Match the acmecorp brand."* Names resolve through the registry (`node scripts/list-styles.js` lists them). With no name, the `.knowledgeware` and `DEFAULT` markers decide, and failing those the skill uses `style-1` and says so.
2. **A local CSS or markdown brandbook.** *"Use the brandbook at `~/work/acme-brand.css`."* The loader extracts palette, typography and layout tokens; the brandbook spec is `skills/brandware/references/brandbook-spec.md`.
3. **A website.** *"Match the visual style of https://example.com."* `scripts/derive-style.js` scrapes the HTML and CSS into a brandbook. It's a heuristic, so the skill asks the user to verify the palette against the live site.
4. **A Google Drive link.** `scripts/fetch-resource.py` turns the share link into a download; the file must be shared with anyone who has the link.
5. **A sample deck to mimic.** *"Match the visual style of `last-quarter-roadmap.pptx`."* The skill renders the sample, reads a few slides, derives the visual language, and writes new content in it. Style only, never the sample's content.
6. **An existing deck in a new style.** *"Rebuild `q3-review.pptx` with the acmecorp brand."* pptxgenjs is write-only, so this is a rebuild: extract the content, render the old deck for reference, build fresh, write to a new path, offer a visual diff. An HTML deck changes in place: `refresh --brand <name>` switches its brand.

## Workflow

Both formats follow the same path: gather inputs, resolve the style, plan layouts (12 pptx archetypes, or HTML patterns used as starting points, varied per the anti-monotony rule), author the source, run the checker, review every slide visually, iterate. A throwaway deck of up to three slides skips the review loop. The steps and commands are in `pptx/references/workflow.md` and `html/FORMAT.md` §Workflow.

## What it won't do

- Edit an existing `.pptx` in place. pptxgenjs is write-only, so a reformat is a rebuild.
- Embed fonts. A brandbook names them; PowerPoint and the browser substitute when they're missing (the skill installs a style's Google Fonts for pptx builds).
- Render gradients through the pptxgenjs API. Use a gradient image as a background.
- Invent content from a thin brief. It proposes an outline and asks before building.

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Activation, format choice, the shared rules (style resolution, notes and pacing, citations, provenance, editing and handing over) |
| `pptx/FORMAT.md`, `html/FORMAT.md` | What Claude follows after choosing a format: mechanics, pitfalls, output convention |
| `pptx/references/{workflow,layout-patterns,visual-principles,pptxgenjs,canonical-samples}.md` | pptx build path, 12 archetypes, design principles, API gotchas, how to use the sample decks |
| `html/references/{runtime,patterns,visual-principles}.md` | Keys, builds, motion, presenter, overview and the editor; starting points for common slide shapes; design principles |
| `pptx/assets/templates/starter-deck.js` | pptx scaffold with the checklist and pitfalls inline |
| `pptx/assets/samples/<name>/` | Three sample decks: build script, token file, rendered previews |
| `html/runtime/{deck,presenter,lanes,loader}.js` | Inlined into every deck: the runtime (stage, navigation, builds, motion, footer, print), the presenter and overview, lane generation, and the loader that fetches the editor on `E` |
| `html/editor/{editor,serialize}.js` | The in-browser editor, never inlined: loaded from the plugin's data folder or the local server |
| `html/engine/cli.js` and its modules | `new`, `refresh`, `check`, `outline`, `slide`, `lanes`, `export`, `import`, `migrate`, `serve`; a zero-dependency Chrome driver (`cdp.js`), zip and OOXML writers for PowerPoint |
| `html/assets/templates/deck-plan.md` | The planning-record template for a deck assembled from several sources |
| `pptx/scripts/{polish-deck.py,render-slides.sh,text-fit.js}` | pptx pre-render checks, LibreOffice previews, text-capacity estimates |
| `pptx/evals/`, `html/evals/` | Eval fixtures for the skill; no test runs them |
| `../../scripts/{registry,load-style,list-styles,derive-style}.js`, `fetch-resource.py`, `install-fonts.sh` | Plugin-level: the registry, the parser, listing, website derivation, Drive downloads, fonts |
| `../../styles/` | The five generic styles and the `brands/` folder with the `acmecorp` template; your own brands live in `$KNOWLEDGEWARE_BRANDS_DIR` |

## Tests

`tests/slideware-engine-test.js` at the plugin root covers the HTML engine without a browser: regions and splicing, `new` and `refresh` (idempotent, brand hash), lanes, `check`, and the PowerPoint zip; `tests/registry-test.js` covers the registry, the loader and the HTML theme. Both run from `scripts/validate-all.sh` at the repository root and in CI.
