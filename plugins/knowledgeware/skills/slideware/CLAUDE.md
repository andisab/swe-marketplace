# slideware — usage guide

Deep-dive companion to `SKILL.md`: what the skill ships with, the five default styles, and the six prompt patterns users reach it through. `SKILL.md` holds the activation rules and workflow; read this file when you need style personalities, capability boundaries, or the file map.

## What the skill does

Generates slide decks in **two output formats**, chosen per request (the skill asks if the request doesn't make it clear):

- **pptx** (`pptx/`): real PowerPoint `.pptx` files via **pptxgenjs** (Node.js) with React-rendered icons via **react-icons + sharp**. Opens cleanly in PowerPoint, Keynote, and Google Slides.
- **html** (`html/`): single self-contained `index.html` decks via **Reveal.js** — run in any browser, host statically, share by link.

Both are driven by the same layered visual-design system of **styles** (generic) or **brandbooks** (brand-specific) from the plugin's shared registry. The two terms are interchangeable — both are `.md` files following the same spec, and one brandbook renders in either format (and in knowledgebase sites and chartware diagrams).

The skill is opinionated about visual quality (no plain-bullets-on-white) and ships with:

- **5 default styles** at the plugin's `styles/` folder (style-1 through style-5) — generic, no brand references, marketplace-safe. See the **Default styles at a glance** section below for visual personalities.
- **A brand registry** — brandbooks + per-brand logo assets, managed by the sibling **brandware** skill and shared with the knowledgebase and chartware skills. Locations: the user's own `$KNOWLEDGEWARE_BRANDS_DIR` (preferred — survives plugin updates) and `styles/brands/` at the plugin root; user entries shadow plugin entries.
- **Cached design tokens** next to every style and brandbook — `styles/tokens/*.json` and `styles/brands/tokens/*.json`. The loader uses these instead of parsing when fresh.
- **Filesystem-driven discovery** — adding a style or brandbook is a single `.md` drop, no code edits. Run `node <plugin>/scripts/list-styles.js` to see the current set (use `--default` / `--brands` to filter).
- **`polish-deck.py`** — XML-level pre-render checker (text overflow, vertical imbalance, off-grid alignment, edge encroachment, invalid-dimension shapes that break PowerPoint).
- **`text-fit.js`** — per-font character-advance calibration for text-capacity estimates.
- **`render-slides.sh`** — LibreOffice-headless wrapper that renders any `.pptx` to per-slide PNGs at 150 DPI for visual review.
- **`load-style.js` + `derive-style.js`** — parsers that turn a CSS file, markdown style, or live website into pptxgenjs design tokens.

## Default styles at a glance

These 5 styles ship with the plugin. Pick one by name (`style-1` through `style-5`), or use as a starting point for a brandbook. All are generic — no copyrighted brand inspiration.

### style-1 — Editorial Light

> *"Like reading a thoughtful long-form article."*

- **Canvas**: warm cream `#FAF8F2` (never pure white)
- **Type**: Source Serif 4 (display) + Inter (body) — serif headings, sans body
- **Accent**: warm coral `#D9624A` — used sparingly as hairlines, kicker color, emphasis
- **Motif**: thin coral top bar on title/closing slides, hairline rules under kickers
- **Use for**: research write-ups, thought-leadership, polished pitches that want gravitas without darkness

### style-2 — Minimal

> *"Almost nothing on the page, but every choice deliberate."*

- **Canvas**: pure white `#FFFFFF`
- **Type**: Inter throughout, single family
- **Accent**: bright indigo `#4F46E5` — under 5% of slide area
- **Motif**: ALL CAPS extended-tracking kickers in indigo, massive whitespace, no decorative elements
- **Use for**: product announcements, design-led pitches, decks where restraint *is* the message

### style-3 — Dark Precision

> *"Premium SaaS, engineering review, after-hours product work."*

- **Canvas**: deep dark `#0B0B12` (softer than pure black)
- **Type**: Inter with tight negative tracking (`charSpacing: -2`) on display sizes
- **Accent**: bright violet `#7C7AEB`
- **Motif**: three-level surface elevation by brightness (no drop shadows), big violet numerals for stats, accent strip on title only
- **Use for**: engineering reviews, dark-first product decks, anything with a "precise SaaS" vibe

### style-4 — Warm Sage

> *"Hand-crafted, diagrammatic, slow."*

- **Canvas**: warm-gray `#F2EDE3` (cream undertone, NOT cool gray)
- **Type**: Lora (display) + Inter (body) — serif headings, sans body
- **Accent**: muted sage `#7C9A6A`
- **Motif**: outlined-not-filled containers (white fill, hairline border), sage dots before list items, no drop shadows
- **Use for**: technical write-ups, internal training, decks that want to feel hand-crafted rather than corporate

### style-5 — Material Olive

> *"Organic authority. Natural without being earthy."*

- **Canvas**: pale cream-green `#F9FAEF` (light, default) or near-black olive `#12140E` (for hero/title)
- **Type**: Inter (Roboto substitute) throughout, single family
- **Accent system (tri-color)**: olive primary `#4C662B`, sage secondary `#586249`, teal tertiary `#386663`
- **Motif**: Material Design 3 elevation by surface brightness, soft drop shadows on cards (the one style where shadows are encouraged), olive-tint container chips for tags/status, 12px radius
- **Use for**: product roadmaps, sustainability decks, design-team work, anything that wants natural authority without corporate severity

### Quick selector

| You want... | Pick |
|---|---|
| Editorial, considered, warm | style-1 |
| Minimal, modern, precise | style-2 |
| Dark, technical, premium | style-3 |
| Diagrammatic, slow, outlined | style-4 |
| Organic, natural, Material-flavored | style-5 |

### Brandbooks

Brand-specific styles live in the registry (the user's `$KNOWLEDGEWARE_BRANDS_DIR` and/or the plugin's `styles/brands/`), managed by the **brandware** skill. They follow the exact same spec but are proprietary/brand-specific, so only the fictional `acmecorp` example ships publicly. Run `node <plugin>/scripts/list-styles.js --brands` to see what's installed.

## Six ways to prompt the skill

The skill auto-activates on words like "deck", "slides", "presentation", "pitch", "pptx", "reveal", "HTML deck", or when a `.pptx` (or slide-deck `.html`) appears as input or output. Format cues ("PowerPoint" vs "share a link"/"host it") route to pptx or html; when ambiguous, the skill asks. Beyond that, the user controls *how* the deck is styled by what they hand the skill.

### 1. Bundled style or brandbook by name

The fastest path. Available names are discovered at runtime from the registry:

- `styles/*.md` — 5 default styles (`style-1` through `style-5`)
- `styles/brands/*.md` — brandbooks installed in the plugin (via brandware)
- `$KNOWLEDGEWARE_BRANDS_DIR/*.md` — the user's own brands directory, if set (shadows the above)

List them with `node <plugin>/scripts/list-styles.js`.

> *"Build me a 6-slide deck on our new code review policy. Use **style-3**."*
> *"Match the **anthropic** brandbook."* *(if anthropic is in styles/brands/)*

The skill reads pre-built tokens from `tokens/` next to whichever registry entry won. No parsing, no network. If the user doesn't specify: a `DEFAULT` marker in the registry (user directory's wins) names the identity; absent that, `style-1` (Editorial Light).

**To add a new style**, drop `styles/<name>.md` (a generic style — goes in defaults) or `<brands-dir>/<name>.md` (a brandbook — see the brandware skill, which also gathers logos and similar assets). No code edits either way; token caches regenerate automatically.

### 2. Local CSS or markdown brandbook

User supplies a path to a `.css` or `.md` file describing the visual identity.

> *"Use the brandbook at `~/work/acme-brand.css`."*
> *"Here's our internal brandbook: `./docs/visual-identity.md` — use it for this pitch."*

The skill runs `node <plugin>/scripts/load-style.js <path> -o style-tokens.json` which extracts palette (via table-role heuristics + CSS-custom-property scanning), typography, and layout tokens. The brandbook spec — what makes a file parseable — lives in the brandware skill's `references/brandbook-spec.md`.

### 3. URL to a website (live-site derivation)

If the user gives a public URL, the skill scrapes HTML + linked CSS, runs frequency analysis on color and font usage, and emits a markdown brandbook.

> *"Match the visual style of https://example.com — make me a 5-slide pitch."*

Under the hood: `node <plugin>/scripts/derive-style.js <url> -o ./brand.md` then loads it. This is a **heuristic** — the user should verify the resulting palette against the live site before authoring (the skill will surface this caveat).

### 4. Google Drive URL

For brandbooks shared via Google Drive:

> *"Use the brandbook at https://drive.google.com/file/d/.../view"*

The skill calls `bash <plugin>/scripts/fetch-resource.sh <url> ./brand.md` which converts the share URL to a direct-download. If the user hasn't set the file to "Anyone with the link," the script will return HTML and the skill will ask the user to fix sharing.

### 5. Sample `.pptx` for style mimicry

User points the skill at an existing `.pptx` to *match the visual style* — but with completely different content.

> *"Build me a 5-slide deck on agent observability that **matches the visual style** of `~/Documents/last-quarter-roadmap.pptx`."*

The skill:
1. Renders the sample to PNGs (`bash scripts/render-slides.sh <sample.pptx> ./sample-preview/`).
2. Extracts the text (`python -m markitdown <sample.pptx> > sample-text.md`).
3. Reads 3-4 representative slide PNGs and derives palette, type pairing, layout patterns, motif, density.
4. Authors a new deck using those design tokens but with the user's new content.

The skill will not copy content from the sample — only style.

### 6. Reformat an existing `.pptx` into a different style

User has an existing deck and wants the *same content* in a different visual system. This is the "rebrand my deck" pattern.

> *"Take `~/Downloads/q3-review.pptx` and rebuild it with the **linear** brandbook."*
> *"Reformat `./old-pitch.pptx` to match `./new-brand-style.pptx`."*

Because pptxgenjs is **write-only** (it can't edit existing decks), the skill treats this as a rebuild:
1. Extracts the existing deck's content (`python -m markitdown`).
2. Renders the existing deck for visual reference (`render-slides.sh`).
3. Builds a fresh `build-deck.js` that reproduces the slide structure with the requested new style.
4. Writes to a new path (never overwrites the original).
5. Renders the new deck and offers a visual diff.

## Workflow at a glance

```
gather inputs ────► resolve brandbook ────► (optional: ingest sample)
                                                      │
                                                      ▼
                                      plan layouts (12 archetypes)
                                                      │
                                                      ▼
                                   scaffold build dir (Node + pptxgenjs)
                                                      │
                                                      ▼
                                          author build-deck.js
                                                      │
                                                      ▼
                                       node build-deck.js → deck.pptx
                                                      │
                                                      ▼
                                  polish-deck.py (cheap pre-flight check)
                                                      │
                                                      ▼
                              render-slides.sh → per-slide PNGs
                                                      │
                                                      ▼
                              inspect every PNG, find ≥1 issue, iterate
                                                      │
                                                      ▼
                                                  deliver
```

For **short / throwaway decks (1-3 slides)**, the skill has a fast-path that skips the render → inspect → iterate loop and ships after polish-deck reports clean.

For **polished decks (≥4 slides)**, the full path with 2-3 iteration cycles is the default — the first render is almost never visually clean and image inspection catches issues that XML-level checks miss.

## What the skill *won't* do

- Edit an existing `.pptx` in place (pptxgenjs is write-only — reformat = rebuild).
- Embed proprietary fonts the system doesn't have (it specifies the font, but the renderer will fall back).
- Render gradients via pptxgenjs API (use a gradient image as a background instead).
- Generate slide content from thin air — if the brief is vague, it'll propose an outline and ask for confirmation before building.

## Files the skill exposes

| Path | Purpose |
|---|---|
| `SKILL.md` | Activation + format choice + shared style resolution |
| `pptx/FORMAT.md` / `html/FORMAT.md` | Per-format mechanics the AI follows after choosing |
| `pptx/references/workflow.md` | pptx build path (fast + full) |
| `pptx/references/layout-patterns.md` | 12 pptx layout archetypes with ASCII sketches |
| `pptx/references/visual-principles.md` | Design principles (hierarchy, color, type, spacing) |
| `pptx/references/pptxgenjs.md` | API patterns + gotchas |
| `html/references/{workflow,layout-patterns,reveal}.md` | HTML build path, 8 archetypes, Reveal.js conventions |
| `../brandware/references/brandbook-spec.md` | What makes a style/brandbook parseable (same spec for both) |
| `pptx/references/canonical-samples.md` | How to use the 3 reference samples |
| `<plugin>/styles/style-{1..5}.md` | 5 default generic styles (marketplace-safe) |
| `<plugin>/styles/tokens/*.json` | Pre-built tokens for default styles (skip-parse) |
| `<plugin>/styles/brands/*.md` | Brandbooks (host-installed via brandware, kept out of the public repo) |
| `<plugin>/styles/brands/tokens/*.json` | Pre-built tokens for brandbooks (skip-parse) |
| `<brands-dir>/<name>/assets/` | Per-brand assets — logos, wordmarks (gathered by brandware; never mixed across brands) |
| `pptx/assets/samples/<bb>/` | Canonical sample decks (build script + rendered PNGs) |
| `pptx/assets/templates/starter-deck.js` | pptx scaffold with checklist + pitfalls inline |
| `html/assets/templates/{build-deck,slides}.js` | HTML renderer + slide-descriptor scaffold |
| `html/scripts/load-style.js` | Registry/brandbook → YAML-frontmatter style.md converter |
| `<plugin>/scripts/list-styles.js` | List discovered styles + brandbooks |
| `<plugin>/scripts/load-style.js` | Style/brandbook → tokens parser |
| `<plugin>/scripts/derive-style.js` | URL → brandbook via HTML/CSS scraping |
| `<plugin>/scripts/fetch-resource.sh` | Google Drive URL → local file |
| `pptx/scripts/polish-deck.py` | pptx pre-render heuristic checks |
| `pptx/scripts/render-slides.sh` | LibreOffice headless → per-slide PNGs |
| `pptx/scripts/text-fit.js` | Text-capacity check for a given box + font |
| `html/scripts/{polish-deck.py,render-slides.sh}` | HTML checks + headless-Chromium render fallback (visual review prefers Claude in Chrome / Playwright MCP) |

## When *not* to use this skill

- The user needs a deck right now and quality doesn't matter — use python-pptx or hand-roll. The skill's full path takes 15-30 min for a polished deck.
- The output isn't a `.pptx` or an HTML deck — Google Slides API decks, Keynote-native, or PDF-first outputs need different tools.
- The user wants slide-by-slide hand-editing in PowerPoint — the skill builds programmatically; if you want a designer's interactive workflow, this isn't it.
