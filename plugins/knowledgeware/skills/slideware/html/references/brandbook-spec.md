# Brandbook spec — HTML format frontmatter (slideware/html)

A brandbook is a `.md` file with **YAML frontmatter** (design tokens) and a **prose body** (palette + type pairing + distinctive treatments). The same file format works for both slideware formats (pptx and html) — write once, render in either format.

## Frontmatter schema

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

## Hex storage convention

Hex values are quoted with `#` prefix:

```yaml
palette:
  bg:     '#FAF9F5'   # IDE renders inline color swatch
  accent: '#D97757'
```

The pptx-format renderer strips the `#` (pptxgenjs expects 6-char hex without). The html-format renderer **keeps** the `#` (CSS expects it). One brandbook works for both — each renderer handles the format conversion.

## Token → CSS variable mapping

The build emits CSS variables under `:root` inside the inlined `<style>` block:

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
| `type.heroPt` | `--size-hero` | `<N>pt` |
| `type.sectionPt` | `--size-section` | `<N>pt` |
| `type.titlePt` | `--size-title` | `<N>pt` |
| `type.bodyPt` | `--size-body` | `<N>pt` |
| `type.subBodyPt` | `--size-subbody` | `<N>pt` |
| `type.captionPt` | `--size-caption` | `<N>pt` |
| `type.codePt` | `--size-code` | `<N>pt` |
| `layout.radiusPx` | `--radius` | `<N>px` |
| `layout.shadowOpacity` | `--shadow-opacity` | `<N>` (unitless) |
| `layout.marginIn` | `--margin` | `<N>in` |

## Google Fonts URL generation

The build inspects `type.sans`, `type.serif`, `type.mono` and emits a single `<link>` URL:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;700&family=JetBrains+Mono:wght@400;500&display=swap
```

Weight ranges are hardcoded:

- sans: 400, 500, 600, 700
- serif: 400, 700
- mono: 400, 500

If the brandbook specifies a font that isn't on Google Fonts, the build will still emit the URL (returns a 404 silently) and the browser will fall back to the system font stack. Verify by loading the deck in a browser and checking DevTools for failed font requests.

## Prose body

Everything below the closing `---` is for the LLM authoring decks. Conventions:

- **Palette table** with hex values and use cases.
- **Type pairing notes** — what serif/sans/mono each is, why they pair.
- **Distinctive treatments** — what makes this style recognizable (e.g. "warm cream cards on cool blue page" for style-1).
- **Use-for / not-for** — concrete scenarios.

The prose body is never parsed by the renderer. It's documentation for the LLM that will author against the tokens.

## Adding a new brandbook

1. Create `shared/styles/<name>.md` (default) or `shared/styles/custom/<name>.md` (brand-specific).
2. Author frontmatter from the schema above. Quote all hex values with `#`.
3. Author the prose body — palette table, type pairing, distinctive treatments, use-for.
4. Run `python plugins/slideware/scripts/sync-shared.py` to populate the per-skill mirrors.
5. Test in both skills: build a deck against the new style in each.
