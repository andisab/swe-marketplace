# Style 2 — Minimal

> Pure white canvas, geometric sans throughout, single bright indigo accent. Massive whitespace. Reads precise and modern — for product announcements, design-led pitches, decks where the message *is* the restraint.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#FFFFFF` | Pure white |
| Surface | `#FFFFFF` | (same — no card distinction) |
| Surface alt | `#FAFAFA` | Very faint zone separation |
| Ink primary | `#111111` | Body and headings — never `#000` |
| Ink body | `#222222` |
| Ink muted | `#6B6B6B` |
| Ink faint | `#B8B8B8` |
| Border | `#E5E5E5` | Hairlines |
| Border strong | `#111111` |
| **Brand accent (indigo)** | `#4F46E5` | The only color besides ink/border |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |

## Typography

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

Single family. No serif. No mono unless code requires it.

### Slide adaptation (16:9, pt)

| Role | Family | Size | Weight |
|---|---|---|---|
| Title slide hero | Inter | 48 | 600 |
| Section title | Inter | 32 | 600 |
| Slide title | Inter | 28 | 500 |
| Body / bullet | Inter | 14 | 400 |
| Sub-bullet | Inter | 12 | 400 |
| Caption | Inter | 10 | 500 |
| Kicker (eyebrow) | Inter | 11 | 600 |

Kickers ALL CAPS with `charSpacing: 4` (extended tracking).

## Layout

```css
:root { --radius: 2px; }
```

- Tiny radius (2px) — sharper geometric feel than rounded styles
- No drop shadows
- No accent strips on slide edges
- Single dominant element per slide — heavy lean on whitespace
- Indigo used in <5% of slide area: kicker color, single button fill, one underline

## Distinctive treatments

1. Pure white canvas (the only style with no warm tint)
2. Single sans family — geometric precision
3. ALL CAPS extended-tracking kickers in indigo
4. No decorative elements: no top bars, no hairline rules under kickers, no accent strips
5. Composition over decoration — leave 60%+ of every slide as whitespace

## Gotchas

- Don't add a second accent color — the restraint is the point
- Don't use serif anywhere
- ALL CAPS kickers need `+4` charSpacing minimum; without it they look cramped
- If a slide feels empty, that's correct — resist filling it
