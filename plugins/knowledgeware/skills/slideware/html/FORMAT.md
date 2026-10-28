# slideware — HTML format (Reveal.js)

Format guide for HTML output. Read [../SKILL.md](../SKILL.md) first for format choice and style resolution — this file covers the HTML-specific mechanics: **Reveal.js + js-yaml** (Node.js), producing a single `index.html` that runs in any modern browser, share-able via link or hosted statically.

## Reference map

| Need | Read |
|------|------|
| End-to-end workflow (fast + full paths) | [references/workflow.md](references/workflow.md) |
| 8 layout archetypes | [references/layout-patterns.md](references/layout-patterns.md) |
| Visual principles (hierarchy, color, type, spacing) | [references/visual-principles.md](references/visual-principles.md) |
| Reveal.js API + theme conventions | [references/reveal.md](references/reveal.md) |
| Speaker notes, pacing, hidden slides, presenter view | [references/reveal.md](references/reveal.md) §Speaker notes |
| Brandbook → CSS-variable mapping | [references/brandbook-spec.md](references/brandbook-spec.md) |

**Recommended order**: layout-patterns → visual-principles → reveal (when you hit a specific API question).

## Staging a style

"Style"/"brandbook" resolution is shared — see [../SKILL.md](../SKILL.md). This format consumes a **YAML-frontmatter `style.md`**: the renderer reads the frontmatter; the LLM reads both frontmatter and prose body. This format's loader converts any registry style, brandbook, or local `.css`/`.md` into that form (pass-through if the input already has frontmatter):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js <name|path> -o ./style.md
```

The renderer (`build-deck.js`) reads `./style.md` and extracts tokens from its YAML frontmatter. There is no separate tokens.json file — the tokens live in the .md.

## Token → CSS mapping

The renderer converts `style.md` frontmatter to CSS variables:

| Token | CSS variable | Notes |
|---|---|---|
| `palette.bg` | `--color-bg` | Hex with `#` (CSS expects it; no strip) |
| `palette.bgDark` | `--color-bg-dark` | Falls back to `palette.ink` if missing |
| `palette.surface`, `surfaceAlt` | `--color-surface`, `--color-surface-alt` | |
| `palette.ink`, `inkBody`, `inkMuted`, `inkFaint` | `--color-ink`, `--color-ink-body`, etc. | |
| `palette.accent`, `accent2` | `--color-accent`, `--color-accent2` | |
| `type.sans`, `serif`, `mono` | `--font-sans`, `--font-serif`, `--font-mono` | Generates matching Google Fonts `<link>` |
| `type.heroPt`, `titlePt`, `bodyPt`, ... | `--size-hero`, `--size-title`, `--size-body`, ... | Points (CSS supports `pt` natively) |
| `layout.radiusPx` | `--radius` | Pixels |
| `layout.shadowOpacity` | `--shadow-opacity` | 0-1 |
| `layout.marginIn` | `--margin` | Inches (CSS supports `in`) |

**Critical**: unlike pptxgenjs (which needs hex *without* `#`), CSS expects the `#`. The build-deck.js does NOT strip it.

## Two paths

| Path | When | Cycle |
|---|---|---|
| **Fast** | 1-3 slides, throwaway, prototype | scaffold → author → build → ship |
| **Full** | ≥4 slides, anything shipped | + inspect every slide visually → find ≥1 issue → iterate 2-3× |

See [workflow.md](references/workflow.md) for both. Don't pay the full-path tax on a throwaway deck.

## Visual review (tool preference order)

Inspect the deck in a real browser via an MCP whenever one is available — an interactive session sees fonts loading, transitions, and fragment states that static captures can't:

1. **Claude in Chrome** (`mcp__claude-in-chrome__*`) — open the deck in a new tab and screenshot each slide (navigate with arrow-key presses via the `computer` tool). If the extension can't open `file://` URLs, serve the deck first: `python3 -m http.server 8010 -d <deck-dir>` → `http://localhost:8010/`.
2. **Playwright MCP** (find its tools via `tool_search` for "playwright browser") — `browser_navigate` to the deck (file:// or localhost), `browser_take_screenshot` per slide, advancing with `browser_press_key` ArrowRight.
3. **Fallback (no browser MCP — headless/CI):** `bash ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/render-slides.sh ./index.html ./preview/` — Puppeteer per-slide PNGs (or a bare `chrome --headless` single-slide capture if Puppeteer isn't installed). Then read every PNG at full size.

Whichever tool captures the slides, the review bar is the same: inspect **every** slide, find ≥1 issue, fix, re-render, repeat 2-3 cycles. For a first pass over the whole deck at once (layout variety, section balance, a slide that's visibly overfull), open it with `?overview`: one screenshot shows every slide as a thumbnail, grouped by section. It doesn't replace the per-slide pass; thumbnails hide type-size and wrapping problems.

## Pitfalls (single canonical home — read once, refer back)

- **Slide dimensions are 1280×720 px** in `build-deck.js`. Reveal's default 960×700 is too small for our type scale. Don't author at the default size.
- **Theme CSS rules MUST be scoped under `.reveal`** — Reveal's reset is aggressive and unprefixed rules get clobbered.
- **`display=swap` on the Google Fonts URL** is required — without it, you get FOIT (invisible text during load).
- **Don't reference `./style.md` from the output HTML.** Output must stand alone. The build inlines theme CSS into a `<style>` block.
- **Reveal is pinned and inlined** (`reveal.js` 5.0.5 in `package.json` and `REVEAL_VERSION` in `build-deck.js`). Run `npm install` in the deck dir before the first build; the build refuses a mismatched version. Decks then run offline; only fonts need a network. Bumping the version is a deliberate change to both pins — diff the output HTML after.
- **Entrance motion is on by default.** Turn it off with `motion: false` in `slides.js` (deck) or on a slide. See [references/reveal.md](references/reveal.md) §Entrance motion.
- **Copy `presenter.js` along with `build-deck.js`.** The build inlines it (presenter view, section overview, notes drawer) and exits with an error if it's missing. Speaker notes go in each slide's `notes` and `cue` fields, never in the slide markup.
- **`section` slides also structure the overview.** `O` in a deck opens a grid of thumbnails grouped under each `section` slide's kicker and title (see [references/reveal.md](references/reveal.md) §Speaker notes, Presenting). A long deck without section slides shows as one flat grid, so give a deck of more than a dozen slides dividers.
- **Pacing and hidden slides live in `slides.js`.** Session lengths go in `sessions` (or `minutes` for a deck without sessions) next to `slides`; `hidden: true` takes a slide out of the deck and out of the time per slide. For "hide slide 12", "session 2 is 75 minutes" or "which slides are hidden?", edit `slides.js`, rebuild, and quote the pacing summary the build prints.
- **Reveal initializes with `controls`, `progress`, `slideNumber`, and `transition: 'fade'`** by default. Override these only if you have a reason — match the medium (kiosk, walkthrough, recorded presentation).
- **Image references in slides** are relative paths the deck dir; if you ship a `.skill` or move the deck, images break unless you base64-inline them or fetch from an absolute URL.
- **Markdown-style content in body strings** is NOT processed — slides take light HTML (`<strong>`, `<em>`, `<code>`, `<br>`, `<a>`). Don't author `<h1>`/`<h2>` tags; layouts emit their own heading hierarchy.
- **`card-row` overflows beyond 4 cards** on 1280×720. Split across two slides or use a different layout.
- **Long unbreakable tokens wrap mid-character.** URLs, code identifiers, and uppercase headings with letter-spacing can be wider than their card/column track. The theme CSS forces them to break (overflow-wrap: anywhere + min-width: 0 on grid items) so they don't push past the slide's right edge — but mid-token wraps still look bad. `polish-deck.py` flags any unbreakable run > 28 chars in a card or > 50 chars in a column. Shorten the URL, abbreviate the identifier, or insert a soft hyphen (`&shy;`) at a sensible break point.

## Anti-monotony rule

Shared rule in [../SKILL.md](../SKILL.md). The 8 HTML archetypes live in [references/layout-patterns.md](references/layout-patterns.md).

## Maintenance section (required for decks with volatile facts)

An HTML deck is a hosted, long-lived artifact — it gets the knowledgebase skill's design-for-decay treatment scaled to a deck (full contract: `../../knowledgebase/references/maintenance.md`; apply it proportionally, not verbatim — a deck is not a site):

- **Final slide: "Sources & verification"** (or a vertical appendix stack for large decks). Every cited source as a live `<a href="…" target="_blank" rel="noopener">` link in the deck's muted caption treatment, grouped by the slide it supports (use slide titles as group labels). A citation nobody can click is a citation nobody re-verifies.
- **A `Last verified: YYYY-MM-DD` stamp** on that slide, plus a one-line staleness note ("facts older than 90 days: re-verify before presenting externally"). Per-slide stamps are allowed where one slide's facts churn much faster than the rest.
- **For large or long-lived decks**, add a compact volatility list on the same slide: fact class · source link · how often it moves. This is the deck-scale master volatility table and is what lets the librarian agent (or a human) plan checks without reading every slide.
- The maintenance slide follows the deck's visual style — it's a designed slide, not a plain-text dump; layout it like a `refs`/resources slide.

When iterating on an existing deck, update this slide with what actually changed and bump only stamps whose facts were re-verified.

## Output convention

Default `<cwd>/index.html` unless the user specifies. Print the absolute path after writing. Open it in a browser via `open ./index.html` (macOS), `xdg-open` (Linux), or `start` (Windows) — Reveal works over `file://` for local preview.

For sharing via link: drop the directory on any static host (GitHub Pages, Netlify, S3) — no build pipeline needed.

## Style mimicry (style only, never content)

When the user provides a sample HTML deck or screenshots:

- For an HTML deck: open it via Claude in Chrome or Playwright MCP (preferred — screenshot slides and read computed styles with the page/JS tools; fall back to manual DevTools), extract palette/type/layout tokens, encode as `style.md`. Use `node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js <path-to-css> -o ./style.md` if there's a standalone CSS file.
- For screenshots: read 3-4 representative slide images. Derive palette, type pairing, layout patterns, motif, density. Apply to the new deck. **Don't copy content.**

**Mimicry overrides anti-monotony.** If the sample has a distinctive non-standard layout, faithfully echoing *that* layout matters more than picking from the canonical 8 archetypes.
