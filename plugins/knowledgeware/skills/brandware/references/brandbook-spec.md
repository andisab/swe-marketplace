# Brandbook spec

The standard every visual identity in the registry follows. Two words, used precisely:

- A **style** is the identity itself: one `brand.md` describing palette, typography and layout, plus the token cache derived from it. The five generic styles under `styles/` are styles.
- A **brandbook** is a style plus everything a brand ships with: its logos and marks in `assets/`, a stylesheet in `css/`, starters, mocks or templates, and a README with provenance. The folder shape is the same for both (SKILL.md §Layout); a brandbook is a style folder with more in it. A consumer treats them alike: it reads the style and uses the extras when they're there.

Every `brand.md` is consumed by all four knowledgeware skills and **carries two layers:**

1. **Prose body — canonical, always required.** Markdown sections (palette table, typography, layout, distinctive treatments) readable by humans and by the model-driven consumers (chartware, knowledgebase), and heuristically parseable by the loaders. Every registry entry works with prose alone.
2. **YAML frontmatter — optional precision layer.** Exact token values in a fixed schema. When present, loaders use these values verbatim instead of heuristics — per field, with prose filling anything the block omits.

Derived token caches (`<name>/tokens.json`) are a third, purely internal layer: regenerated automatically (mtime-invalidated), never hand-edited, never presented to users as a setup step.

**Loader contract**: the plugin's loader (`scripts/load-style.js`) parses both layers, frontmatter first; the html converter (`skills/slideware/html/scripts/load-style.js`) imports that parser and writes the tokens back out as frontmatter. **Generator contract**: anything that produces a brandbook (`scripts/derive-style.js`, the html converter's `.css` import) emits *both* layers, so the machine and prose views of a brand can never live in different files. **What each consumer does with the tokens** is that consumer's own guide; `consumer-contract.md` in this folder is the index and the rules they all follow.

## Layer 1: the prose body (required)

Required sections (heuristics key off the table formats — keep them consistent with the bundled styles):

1. **Palette** — a `| Role | Hex |` table with at least: a background color, an ink/text color, and a brand accent. 6-char hex.
2. **Typography** — a CSS-variables code block naming the font stacks (at least a sans; heading serif and mono optional), plus a role/size table.
3. **Layout** — at least a border-radius value; optionally shadows and spacing.
4. **Slide adaptation (16:9)** — pt values for slide use (title, body, caption). If absent, the pptx format applies the web-to-slide conversion in its `references/pptxgenjs.md` §Brand tokens.

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
  containerPx:   1240                 # optional — page content width for HTML consumers
  gutterPx:      24                   # optional — grid gutter for HTML consumers

paletteDark:                          # optional — the same palette keys for a dark theme
  bg:          '#1C1915'              #   (any subset; consumers fall back to the light value)
  surface:     '#262219'
  ink:         '#F3EEE4'
  accent:      '#E8836B'
---
```

A dark-first brandbook (its base palette is dark, like style-3) uses `paletteLight:` the same way, for viewers who prefer a light theme. Two more optional keys live under `type:`: `headingTracking` and `labelTracking`, in em (e.g. `-0.02` for tight display headings, `0.12` for spaced capitals). Loaders pass `paletteDark`, the tracking values and the container keys through to the tokens untouched; the html converter writes `paletteDark` back into the frontmatter it generates. The five default styles under `styles/` show every optional key in use.

**Hex convention**: hex values are quoted **with** the `#` prefix (IDEs render inline color swatches). The pptx loader strips the `#` (pptxgenjs expects bare 6-char hex); the html renderer keeps it (CSS expects it). One brandbook works for both.

**Consistency rule**: when both layers state the same fact, they must agree — frontmatter wins at load time, but a disagreement is an authoring bug. The audit workflow (SKILL.md §Audit) checks for it.

## Loading a brandbook

```bash
node scripts/load-style.js <name|path> -o style-tokens.json                        # a registry name, or a local .md / .css file
python3 scripts/fetch-resource.py "https://drive.google.com/file/d/FILE_ID/view" ./brand.md   # a Google Drive share link, then load it
node scripts/derive-style.js https://example.com -o ./brand.md                   # a live website, then load it (heuristic: SKILL.md §Derive)
```

The loader handles a frontmatter-bearing `.md` (precision path), a prose-only `.md` with role tables or CSS-variable blocks (heuristic path), and a plain `.css` with `:root { --token: value }` blocks. Names resolve per SKILL.md §Resolution contract.

## Authoring a new brandbook

1. Write `<dest>/<name>/brand.md` (`<dest>` = the brands directory per SKILL.md §Add / import) — copy a bundled style or the `acmecorp` example as the template.
2. Author the **prose body** first (it's the canonical layer), then the **frontmatter block** from the schema above. Keep the two consistent.
3. Test: `node scripts/load-style.js <name>` (pptx tokens) and `node skills/slideware/html/scripts/load-style.js <name>` (html style.md) — sanity-check the values against your intent.
4. Optionally run the audit ("audit the brandbooks") to catch layer disagreements, spec drift, and dead asset references.
