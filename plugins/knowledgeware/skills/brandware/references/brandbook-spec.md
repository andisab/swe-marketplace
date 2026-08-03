# Brandbook spec

A "brandbook" (or "style" — the terms are interchangeable) is one `.md` file describing a visual identity, consumed by all four knowledgeware skills. **One file carries two layers:**

1. **Prose body — canonical, always required.** Markdown sections (palette table, typography, layout, distinctive treatments) readable by humans and by the model-driven consumers (chartware, knowledgebase), and heuristically parseable by both machine loaders. Every registry entry works with prose alone.
2. **YAML frontmatter — optional precision layer.** Exact token values in a fixed schema. When present, loaders use these values verbatim instead of heuristics — per field, with prose filling anything the block omits.

Derived token caches (`tokens/<name>.json`) are a third, purely internal layer: regenerated automatically (mtime-invalidated), never hand-edited, never presented to users as a setup step.

**Loader contract**: the pptx token loader (`scripts/load-style.js`) and the html converter (`skills/slideware/html/scripts/load-style.js`) both prefer frontmatter when present and heuristically parse the prose otherwise. **Generator contract**: anything that produces a brandbook (`scripts/derive-style.js`, the html converter's `.css` import) emits *both* layers, so the machine and prose views of a brand can never live in different files.

## Layer 1: the prose body (required)

Required sections (heuristics key off the table formats — keep them consistent with the bundled styles):

1. **Palette** — a `| Role | Hex |` table with at least: a background color, an ink/text color, and a brand accent. 6-char hex.
2. **Typography** — a CSS-variables code block naming the font stacks (at least a sans; heading serif and mono optional), plus a role/size table.
3. **Layout** — at least a border-radius value; optionally shadows and spacing.
4. **Slide adaptation (16:9)** — pt values for slide use (title, body, caption). If absent, loaders apply the conversion table in Appendix A.

Optional but high-value (this is what the model-read consumers use most):
- **Distinctive treatments** — rules-of-thumb for the brand voice, what makes the look recognizable
- **Gotchas** — known traps when replicating the look

Skeleton:

````markdown
# Brand Name — Brandbook

> One-paragraph mood / voice description.

## Palette
| Role | Hex |
|------|-----|
| Background | `#...` |
| Ink primary | `#...` |
| Brand (primary accent) | `#...` |

## Typography
```css
--font-sans: '...';
--font-serif: '...';
```
| Role | Size | Weight | LS |
|------|------|--------|----|
| Hero | 64px | 700 | -0.02em |
| Body | 16px | 400 | 0 |

## Slide adaptation (16:9)
| Role | pt |
|------|----|
| Title | 32 |
| Body | 14 |
| Caption | 10 |

## Layout
- Radius: 8px
- Shadows: subtle / none

## Distinctive treatments
1. ...

## Gotchas
- ...
````

## Layer 2: the frontmatter schema (optional precision)

Field annotations mean *required within the block when the block is present* — a brandbook with no frontmatter at all is fully valid (loaders fall back to prose heuristics).

```yaml
---
name: <slug>                          # required — filename without .md
description: <one-line summary>       # required — vibe + use case

palette:
  bg:          '#FAF9F5'              # required — main canvas
  bgDark:      '#0D0D0D'              # optional — dark hero canvas
  surface:     '#FFFFFF'              # required — card/panel background
  surfaceAlt:  '#F0EDE6'              # optional — section divider, quiet panels
  ink:         '#181C20'              # required — heading color
  inkBody:     '#1E1C13'              # optional — body color (falls back to ink)
  inkMuted:    '#5A5A5A'              # required — captions, sources
  inkFaint:    '#7F7667'              # optional — faintest text (falls back to inkMuted)
  border:      '#E0E0E0'              # required — hairlines, dividers
  accent:      '#D97757'              # required — stats, CTAs, kickers
  accent2:     '#216487'              # optional — categorical contrast (falls back to accent)
  success:     '#3F8A4F'              # optional — status (defaults sensible)
  warning:     '#C97A1A'              # optional
  error:       '#BA1A1A'              # optional

type:
  sans:   'Inter'                     # required — body font family
  serif:  'Source Serif 4'            # optional — heading font (Georgia fallback)
  mono:   'JetBrains Mono'            # optional — code font

  heroPt:    44                       # required — hero slide title
  sectionPt: 32                       # required — section divider
  titlePt:   28                       # required — slide title
  bodyPt:    14                       # required — body text
  subBodyPt: 12                       # optional — card sub-text
  captionPt: 10                       # required — footnotes, captions
  codePt:    12                       # optional — code blocks

layout:
  radiusIn:      0.04                 # optional — pptx-side (inches)
  radiusPx:      4                    # required — corner radius in CSS pixels
  shadowOpacity: 0                    # required — card shadow strength (0-1)
  marginIn:      0.6                  # required — slide padding (CSS supports `in`)
---
```

**Hex convention**: hex values are quoted **with** the `#` prefix (IDEs render inline color swatches). The pptx loader strips the `#` (pptxgenjs expects bare 6-char hex); the html renderer keeps it (CSS expects it). One brandbook works for both.

**Consistency rule**: when both layers state the same fact, they must agree — frontmatter wins at load time, but a disagreement is an authoring bug. The audit workflow (SKILL.md §Audit) checks for it.

## Appendix A: pptx mapping (tokens → pptxgenjs)

| CSS concept | pptxgenjs equivalent | Notes |
|---|---|---|
| `color: #FAF9F5` | `color: "FAF9F5"` | 6-char hex, NO `#` |
| `background: #FAF9F5` | `slide.background = { color: "FAF9F5" }` | same |
| `font-size: 1.25rem` (20px) | `fontSize: 15` (pt) | web px × 0.75 = pt |
| `font-family: 'Inter', sans-serif` | `fontFace: "Inter"` | first family only |
| `font-weight: 600` | `bold: true` (>=600) or omitted | pptx is binary bold/normal |
| `font-weight: 510` (non-standard) | `bold: false` | non-standard weights collapse to normal |
| `letter-spacing: -0.022em` at 64px | `charSpacing: -1.4` (pt) | LS × (size in pt) |
| `border-radius: 8px` | `rectRadius: 0.083` (in) | px ÷ 96 dpi |
| `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` | `shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.3 }` | approximations only |
| 1px hairline border | `line: { color: "...", width: 0.5 }` | pt, not px |
| `padding: 0` on text | `margin: 0` | counterintuitive but correct |

### Web px → slide pt conversion

Slides are physical points, web is pixels. Don't 1:1 copy sizes — slides need bigger type for readability at projection distance.

| Web size | Slide pt equivalent |
|----------|---------------------|
| 12-14px body | 11-12pt body |
| 16px body (web default) | 14pt body |
| 20px subhead | 16pt subhead |
| 24-28px section h2 | 22-26pt |
| 32-48px section h1 | 28-36pt |
| 56-80px hero h1 | 40-48pt |

### Letter-spacing conversion

CSS `letter-spacing` is in em or px at a given size; pptxgenjs `charSpacing` is in points: `charSpacing = letterSpacing_em × fontSize_pt`. So `-0.022em` at 40pt → `charSpacing: -0.88` (round to `-1`).

### What the pptx loader emits

```javascript
{
  "name": "acmecorp",
  "source": "/path/to/acmecorp.md",
  "palette": { "bg": "FAFAF7", "bgDark": null, "surface": "FFFFFF", "surfaceAlt": null,
               "ink": "16211C", "inkBody": null, "inkMuted": "5A6B63", "inkFaint": null,
               "border": "E2E6E1", "accent": "0E6B5C", "accent2": null,
               "success": "16A34A", "warning": "D97706", "error": "DC2626" },
  "type":    { "sans": "Inter", "serif": "Georgia", "mono": "JetBrains Mono",
               "heroPt": 44, "sectionPt": 32, "titlePt": 28, "bodyPt": 14,
               "subBodyPt": 12, "captionPt": 10, "codePt": 12 },
  "layout":  { "radiusIn": 0.083, "radiusPx": 8, "shadowOpacity": 0.12, "marginIn": 0.5 }
}
```

Destructure at the top of a build script: `const { palette: P, type: T, layout: L } = require("./style-tokens.json");`

## Appendix B: html mapping (tokens → CSS variables)

The html build emits CSS variables under `:root` inside the inlined `<style>` block:

| Token | CSS variable | CSS unit |
|---|---|---|
| `palette.bg` | `--color-bg` | hex with `#` |
| `palette.bgDark` | `--color-bg-dark` | hex with `#` (falls back to `ink`) |
| `palette.surface` | `--color-surface` | hex with `#` |
| `palette.surfaceAlt` | `--color-surface-alt` | hex with `#` (falls back to `surface`) |
| `palette.ink` | `--color-ink` | hex with `#` |
| `palette.inkBody` | `--color-ink-body` | hex with `#` (falls back to `ink`) |
| `palette.inkMuted` | `--color-ink-muted` | hex with `#` |
| `palette.inkFaint` | `--color-ink-faint` | hex with `#` (falls back to `inkMuted`) |
| `palette.border` | `--color-border` | hex with `#` |
| `palette.accent` | `--color-accent` | hex with `#` |
| `palette.accent2` | `--color-accent2` | hex with `#` (falls back to `accent`) |
| `palette.success / warning / error` | `--color-success / --color-warning / --color-error` | hex with `#` |
| `type.sans` | `--font-sans` | `'<name>', system-ui, sans-serif` |
| `type.serif` | `--font-serif` | `'<name>', Georgia, serif` (or `Georgia, serif` if unset) |
| `type.mono` | `--font-mono` | `'<name>', ui-monospace, monospace` |
| `type.heroPt … codePt` | `--size-hero … --size-code` | `<N>pt` |
| `layout.radiusPx` | `--radius` | `<N>px` |
| `layout.shadowOpacity` | `--shadow-opacity` | `<N>` (unitless) |
| `layout.marginIn` | `--margin` | `<N>in` |

### Google Fonts URL generation

The html build inspects `type.sans/serif/mono` and emits a single `<link>` URL (`https://fonts.googleapis.com/css2?family=…&display=swap`). Weight ranges are hardcoded: sans 400/500/600/700 · serif 400/700 · mono 400/500. A non-Google font still emits the URL (404s silently) and falls back to the system stack — verify in DevTools if fidelity matters.

## Loading a brandbook

### Bundled names

```bash
node scripts/load-style.js acmecorp    # prints pptx tokens as JSON
# Names are discovered from the registry (user brands dir > styles/brands/ > styles/).
# List them: node scripts/list-styles.js (or --names / --json for scripting)
```

### Local file path

```bash
node scripts/load-style.js /path/to/my-brand.md
node scripts/load-style.js ./brandbook.css        # CSS files also accepted
```

The loaders handle: frontmatter-bearing `.md` (precision path), prose-only `.md` with role tables / CSS-variable blocks (heuristic path), and plain `.css` files with `:root { --token: value }` blocks.

### Google Drive

```bash
bash scripts/fetch-resource.sh "https://drive.google.com/file/d/FILE_ID/view" ./brand.md
node scripts/load-style.js ./brand.md
```

The fetch script extracts the file ID and uses Google's direct-download URL. If the file isn't shared as "Anyone with the link", the script will return HTML (login wall); tell the user to fix the sharing permission or download manually.

### Website URL (derived on the fly)

```bash
node scripts/derive-style.js https://example.com -o ./brand.md
node scripts/load-style.js ./brand.md -o style-tokens.json
```

The script fetches the HTML, all linked stylesheets, and inline `<style>` blocks, then extracts:

- **CSS custom properties** (`--foo: #hex`) — the highest-signal source, since brands tend to define their tokens explicitly
- **Body-level rules** (`body { background, color, font-family }`) — the canonical defaults
- **Hex colors by frequency** — most common near-white = background, most common near-black = ink, most common saturated color = accent
- **Border-radius distribution** — most common value
- **Font-family declarations** — first non-system font (likely the brand font), plus a serif if one is present in the stack

Output is a both-layer brandbook (frontmatter + prose) that every loader and consumer handles without modification.

**Caveats** (the script prints these as `notes` when relevant):

- **Compiled CSS strips signal.** Sites that pre-compile Tailwind, CSS-in-JS, or Webpack-bundled styles will have fewer custom properties exposed. The accent detection may pick a chart color or CTA blue instead of the actual brand color.
- **The accent is the most-frequent saturated color**, which isn't always the brand color — it may be a generic link blue used more often than the sparingly-applied brand hue. Always check the result against the live site.
- **JS-rendered styles are invisible.** If the site only applies its brand styles after JS hydration, static CSS extraction misses them. Use a bundled brandbook if one exists, or the sample-deck workflow.
- **No JS execution.** Raw HTTP fetch, not a headless browser — SPA-only sites may yield incomplete output.

**Refining the derivation:** read the output side-by-side with the live site; swap the accent if the frequency heuristic picked a link/CTA color; replace fallback fonts; adjust slide-adaptation pt values if the site uses unusual base sizes. Update **both layers** when you edit — a 60-second manual refinement beats authoring from scratch.

## Authoring a new brandbook

1. Write `<dest>/<name>.md` (`<dest>` = the brands directory per SKILL.md §Add / import) — copy a bundled style or the `acmecorp` example as the template.
2. Author the **prose body** first (it's the canonical layer), then the **frontmatter block** from the schema above. Keep the two consistent.
3. Test: `node scripts/load-style.js <name>` (pptx tokens) and `node skills/slideware/html/scripts/load-style.js <name>` (html style.md) — sanity-check the values against your intent.
4. Optionally run the audit ("audit the brandbooks") to catch layer disagreements, spec drift, and dead asset references.
