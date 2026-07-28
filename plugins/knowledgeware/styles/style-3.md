# Style 3 — Dark Precision

> Dark-first canvas, bright violet accent, sans with tight negative tracking. Elevated surfaces (no drop shadows — separation comes from brightness levels). Reads as premium SaaS, engineering review, after-hours product work.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#0B0B12` | Deepest level — slide canvas |
| Surface | `#16161D` | Elevated card / panel |
| Surface alt | `#1F1F28` | Most-elevated surface |
| Ink primary | `#F4F4F8` | Headings on dark |
| Ink body | `#D4D4DC` |
| Ink muted | `#9090A0` |
| Ink faint | `#5A5A6A` |
| Border | `#2A2A35` | Subtle dividers on dark |
| Border strong | `#3D3D4A` |
| **Brand accent (violet)** | `#7C7AEB` | The bright spot |
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Error | `#F87171` |

## Typography

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', Menlo, monospace;
}
```

### Slide adaptation (16:9, pt)

| Role | Family | Size | Weight |
|---|---|---|---|
| Title slide hero | Inter | 48 | 600 |
| Section title | Inter | 32 | 600 |
| Slide title | Inter | 28 | 500 |
| Big stat number | Inter | 120 | 700 |
| Body / bullet | Inter | 14 | 400 |
| Sub-bullet | Inter | 12 | 400 |
| Caption | Inter | 10 | 500 |
| Code | JetBrains Mono | 12 | 400 |

Display sizes (≥28pt) use `charSpacing: -2` (tight tracking).

## Layout

```css
:root { --radius: 6px; }
```

- 6px radius on cards
- **No drop shadows** — surface elevation comes from going lighter, not from shadow
- Three-level elevation: `bg` → `surface` → `surface alt`
- Violet accent strip (0.12" wide) on title slide; never on content slides
- Big numbers (stats) in 100-120pt violet — the signature visual

## Distinctive treatments

1. Background is `#0B0B12`, not pure black — softer
2. Elevation by brightness level, not shadow
3. Tight negative tracking on all display sizes
4. Violet accent strip on opener/closer only
5. Stats and key numbers in big violet numerals
6. Hairline borders on cards (`#2A2A35`, 0.5pt) — barely visible but structurally important

## Gotchas

- Pure `#000` background reads as crushed; use `#0B0B12`
- Don't use drop shadows on dark — they don't read, just add visual noise
- Body weight 400 (regular), NOT 500+ — heavier weights on dark surfaces look aggressive
- Violet must stay one specific hue (`#7C7AEB`) — drifting to blue-violet or red-violet breaks the look
