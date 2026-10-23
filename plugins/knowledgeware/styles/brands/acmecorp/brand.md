# AcmeCorp — Brandbook

> **Checked-in example brand.** AcmeCorp is fictional; this file demonstrates the brand-folder layout and the brandbook format every real (private) brand follows: one `<name>.md` (this file, canonical), a derived token cache at `tokens/<name>.json`, and per-brand assets at `<name>/assets/`. Spec: `skills/brandware/references/brandbook-spec.md`.

Grounded, technical, quietly confident. Warm paper canvas, deep teal as the single working accent, rust reserved for contrast moments. Reads like an engineering company that ships.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Background | `#FAFAF7` | Warm off-white canvas — never pure white |
| Background deep | `#132420` | Dark hero canvas (covers, closing slides) |
| Surface | `#FFFFFF` | Cards / elevated panels |
| Surface alt | `#F1F0EA` | Quiet section background |
| Ink primary | `#16211E` | Headings and emphasized text — never `#000` |
| Ink body | `#242E2A` | Body copy |
| Ink muted | `#5B655F` | Captions, sources, secondary labels |
| Border | `#E3E1D8` | Hairlines, dividers, card strokes |
| Primary accent | `#0E6B5C` | Deep teal — links, kickers, the one working accent |
| Accent | `#B4552D` | Rust — sparing contrast (one stat, one highlight per page) |
| Success | `#2E7D43` | Positive status |
| Warning | `#C28712` | Caution status |
| Error | `#C6423B` | Failure / risk |

### Diagram categorical strokes

| Category | Stroke |
|---|---|
| Application / UX | `#6C8EBF` |
| Security / Risk | `#C6423B` |
| Ops / Platform | `#8FB3C9` |
| Data | `#5C8A58` |
| Neutral | `#8A8A85` |

## Typography

All families are free Google Fonts — install locally with `bash scripts/install-fonts.sh acmecorp`.

```css
--font-sans:  'Inter', system-ui, -apple-system, sans-serif;      /* body + UI */
--font-serif: 'Lora', Georgia, serif;                             /* display headings only */
--font-mono:  'JetBrains Mono', Menlo, monospace;                 /* code, metrics, labels */
```

Serif is for display sizes (titles, section openers); everything else is Inter. Mono marks verifiable facts — numbers, code, API names.

### Slide adaptation

| Role | Size (pt) | Weight |
|---|---|---|
| Title slide | 40 | 600 |
| Section title | 30 | 600 |
| Slide title | 26 | 600 |
| Body | 14 | 400 |
| Sub-bullet | 12 | 400 |
| Caption | 10 | 400 |
| Code | 12 | 400 |

## Layout

```css
--radius: 8px;
```

Outlined over filled: white cards with `border` hairlines on the warm canvas. Teal appears as strokes, kickers, and one filled moment per page — never as a background wash. Dark surfaces (`#132420`) are reserved for covers and the closing slide.

## Assets

Per-brand folder: `acmecorp/assets/` (relative to this file). Fictional marks created for this example — free to reuse or replace.

| File | What | Use on |
|---|---|---|
| `acmecorp/assets/logo-light.svg` | Mark + wordmark for light backgrounds | Canvas `#FAFAF7`, white surfaces |
| `acmecorp/assets/logo-dark.svg` | Mark + wordmark for dark backgrounds | Dark hero `#132420` |
