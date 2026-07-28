# Style 5 — Material Olive

> Material Design 3 palette: olive primary, sage secondary, teal tertiary on a pale cream-green canvas. Reads as organic and modern — for product roadmaps, sustainability decks, design work that wants natural authority without corporate severity.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#F9FAEF` | Pale cream-green — never pure white |
| Background dark | `#12140E` | Near-black olive — for hero/title slides only |
| Surface | `#FFFFFF` | Cards on light canvas |
| Surface alt | `#EEEFE3` | Quiet zone separation |
| Ink primary | `#1A1C16` | Body and headings |
| Ink body | `#44483D` | Paragraph copy |
| Ink muted | `#75796C` | Captions, meta |
| Ink faint | `#C5C8BA` | Very quiet metadata |
| Border | `#C5C8BA` | Hairlines, card strokes |
| Border strong | `#75796C` | Emphasized dividers |
| **Brand accent (olive primary)** | `#4C662B` | CTAs, key emphasis |
| Brand accent tertiary (teal) | `#386663` | Categorical third — data viz |
| Brand accent secondary (sage) | `#586249` | Quieter supporting color |
| Success | `#586249` | Reuses sage |
| Error | `#BA1A1A` |

## Typography

```css
:root {
  --font-sans: 'Inter', 'Roboto', system-ui, sans-serif;
}
```

Single sans family — Material is sans-first. Inter as a free Roboto substitute.

### Slide adaptation (16:9, pt)

| Role | Family | Size | Weight |
|---|---|---|---|
| Title slide hero | Inter | 44 | 600 |
| Section title | Inter | 32 | 500 |
| Slide title | Inter | 26 | 600 |
| Body / bullet | Inter | 14 | 400 |
| Sub-bullet | Inter | 12 | 400 |
| Caption | Inter | 10 | 500 |
| Kicker (eyebrow) | Inter | 11 | 600 |

Kickers and section labels: ALL CAPS with `charSpacing: 3`. Display sizes: leave tracking at 0.

## Layout

```css
:root { --radius: 12px; }
```

- 12px radius on cards (rounder than other styles — Material-flavored)
- Soft drop shadows (blur 8, offset 2, opacity 0.10) on white-surface cards — the **only style in the bundle where shadows are encouraged**
- Three-token elevation: `bg` → `surface alt` → `surface` (lightest = most elevated)
- Page numbers right-aligned bottom in `ink muted`

## Distinctive treatments

1. **Tri-color accent system**: olive primary, sage secondary, teal tertiary. Pick the one that fits each use case — don't blend.
2. **Material elevation by brightness**: cards sit on a *lighter* surface than the canvas (not via shadow alone).
3. **Cream canvas, not white**: `#F9FAEF` has a faint green undertone — pure white loses the warmth.
4. **Container chips for tags/status**: small olive-tinted rectangles `#CDEDA3` fill + `#354E16` ink instead of bordered tags. The Material idiom.
5. **Soft drop shadows on cards** — Material's "elevation" feel. Other styles in this bundle avoid shadows; this one uses them.

## Gotchas

- Background is `#F9FAEF` (cream-green tint), NOT pure white — losing the tint kills the personality
- The accent isn't one color — it's a triad. Document which one applies where; don't rotate randomly between olive/sage/teal "for variety"
- Olive primary `#4C662B` on white needs ≥18pt to read comfortably — don't use for body text
- Radius is 12px (`rectRadius: 0.125`) — don't hardcode 4px or 16px
- Shadows here are intentional; keep opacity ≤0.12 — anything darker reads as dated rather than Material

## Source

Derived from a Material Design 3 token set: `~/Projects/ab-github/swe-marketplace/plugins/slideware/styles/style-5/{light,dark,light-mc,dark-mc,light-hc,dark-hc}.css`. Six files cover light/dark × default/medium-contrast/high-contrast. This spec captures the light default; swap colors from `*-hc.css` for WCAG-AAA contrast.
