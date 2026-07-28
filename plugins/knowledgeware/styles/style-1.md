# Style 1 — Editorial Light

> Publication voice. Warm cream canvas, serif display headings paired with a humanist sans body, single warm coral accent. Reads slow and considered — for research write-ups, thought-leadership, polished pitches that want gravitas without darkness.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#FAF8F2` | Warm cream — never pure white |
| Surface | `#FFFFFF` | For cards / elevated content |
| Surface alt | `#F4F1E8` | Quiet background variant |
| Ink primary | `#1A1A1A` | Body and headings — never `#000` |
| Ink body | `#3D3A35` | Paragraph copy |
| Ink muted | `#7A7468` | Captions, eyebrows |
| Ink faint | `#A8A294` | Very quiet metadata |
| Border | `#E8E2D5` | Hairline rules |
| Border strong | `#1A1A1A` | Rare — emphasis only |
| **Brand accent (warm coral)** | `#D9624A` | Used sparingly |
| Success | `#3F8A4F` |
| Warning | `#C97A1A` |
| Error | `#C24A3F` |

## Typography

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', 'Source Serif Pro', Georgia, serif;
}
```

### Slide adaptation (16:9, pt)

| Role | Family | Size | Weight |
|---|---|---|---|
| Title slide hero | Source Serif 4 | 44 | 600 |
| Section title | Source Serif 4 | 32 | 600 |
| Slide title | Source Serif 4 | 28 | 500 |
| Body / bullet | Inter | 14 | 400 |
| Sub-bullet | Inter | 12 | 400 |
| Caption | Inter | 10 | 400 |
| Code | JetBrains Mono | 12 | 400 |

## Layout

```css
:root { --radius: 4px; }
```

- Single radius: 4px
- Hairlines (0.5pt) under kickers; never decorative lines under titles
- Thin coral top bar (0.08") on title and closing slides — that's the motif
- Generous margins (≥0.5"), comfortable line height for body (1.5)

## Distinctive treatments

1. Cream canvas — pure white loses the personality immediately
2. Serif headings, sans body — never reverse the pairing
3. Coral `#D9624A` strictly as accent: hairlines, kicker color, occasional emphasis. Never as fill on body shapes
4. Italic for asides and pull quotes
5. Sentence case throughout (no ALL CAPS labels)

## Gotchas

- Background is `#FAF8F2`, NOT `#FFFFFF`
- Coral is the single brand color — don't add a second accent
- Serif at body sizes (≤14pt) becomes hard to read; keep serif for ≥18pt only
