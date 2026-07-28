# Style 4 — Warm Sage

> Warm-gray canvas, serif headings + sans body, sage green accent, outlined-not-filled containers. Reads as thoughtful, slow, diagrammatic — for technical write-ups, internal training, decks that want to feel hand-crafted rather than corporate.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#F2EDE3` | Warm gray with cream undertone |
| Surface | `#FFFFFF` | Inside outlined containers |
| Surface alt | `#EAE4D6` | Quiet zone separation |
| Ink primary | `#1F1810` | Deep brown-black |
| Ink body | `#3D342B` |
| Ink muted | `#7A6F60` |
| Ink faint | `#B0A696` |
| Border | `#C9C3B7` | Outlined-container stroke |
| Border strong | `#1F1810` |
| **Brand accent (sage)** | `#7C9A6A` | Calm green-gray |
| Success | `#7C9A6A` | (same as accent — sage doubles as success) |
| Warning | `#C97A1A` |
| Error | `#C24A3F` |

## Typography

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Lora', Georgia, serif;
  --font-mono: 'JetBrains Mono', Menlo, monospace;
}
```

### Slide adaptation (16:9, pt)

| Role | Family | Size | Weight |
|---|---|---|---|
| Title slide hero | Lora | 40 | 500 |
| Section title | Lora | 28 | 500 |
| Slide title | Lora | 26 | 500 |
| Body / bullet | Inter | 14 | 400 |
| Sub-bullet | Inter | 12 | 400 |
| Caption | Inter | 10 | 400 |
| Code | JetBrains Mono | 11 | 400 |

## Layout

```css
:root { --radius: 6px; }
```

- 6px uniform radius
- **Outlined-not-filled**: white-fill containers with 0.5pt `#C9C3B7` border on the warm-gray canvas. This is THE signature motif.
- No drop shadows — separation comes from outline + canvas contrast
- Small sage dots (0.15" diameter) before list items instead of bullets
- Lora at headlines only; never on body copy (Lora becomes hard to read below ~18pt)

## Distinctive treatments

1. Warm-gray `#F2EDE3` canvas — cream undertone, NOT cool gray
2. Outlined containers (white fill, gray hairline) — the diagrammatic signature
3. Sage-green dots and connectors throughout
4. Serif headings, sans body — always
5. No filled rectangles for cards; always outlined

## Gotchas

- Background must be warm (cream-tinted), not cool gray — `#F0F0F0` kills the personality
- Cards are OUTLINED, not filled. Filled cards on this canvas look like alert/error boxes
- Sage accent is `#7C9A6A` (muted green-gray) — bright green looks wrong
- Lora below 18pt becomes unreadable; keep serif large
- Don't add drop shadows — would conflict with the outlined-container language
