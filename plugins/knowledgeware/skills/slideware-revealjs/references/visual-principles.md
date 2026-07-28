# Visual principles

The same principles apply to HTML decks as to PowerPoint decks — only the implementation differs.

## Hierarchy

Three levels of emphasis, no more:

1. **Hero / title** — what the slide is about. Serif (`--font-serif`), `--size-hero` or `--size-title`.
2. **Body** — supporting text. Sans (`--font-sans`), `--size-body`.
3. **Muted / context** — captions, sources, footnotes. Sans, `--size-caption`, `--color-ink-muted`.

If a fourth level seems necessary, the slide is doing too much — split it.

## Color

- **One bg, one accent, one ink.** Body text is `--color-ink-body`; muted text is `--color-ink-muted`. Stat numerals and CTAs are `--color-accent`. That's it.
- **Reserve `--color-accent2`** for categorical contrast (e.g. one stat type vs another), not decoration.
- **Surface vs surface-alt** is the elevation cue — `surface-alt` is for `section` divider slides or muted card backgrounds.
- **Status colors** (`--color-success`, `--color-warning`, `--color-error`) belong only on status chips or alert callouts. Never on body text.

## Type pairing

Default to **serif heading + sans body** unless the brandbook specifies otherwise. Reasons:

- Serif headings carry editorial weight, which decks rarely have intrinsically.
- Sans body keeps reading fast at small sizes.
- Mono is for code and tabular data — never body text.

Pairings that ship in default styles:

| Style | Serif | Sans | Mono |
|---|---|---|---|
| style-1 Executive Steel | Source Serif 4 | Inter | JetBrains Mono |
| style-2 Joplin Gruvbox | Bitter | Inter (light) | Fira Code |
| style-3 Editorial Scale | Merriweather | Inter | (default) |
| style-4 Warm Terracotta | (Inter throughout) | Inter | (default) |
| style-5 Material Olive | (Inter throughout) | Inter | (default) |

Note: styles 4/5 use a single sans family — Material Design intentionally avoids serif/sans mixing. Pick a style that matches the visual register you're going for.

## Spacing

`build-deck.js` handles inter-slide spacing via Reveal's slide-frame model. Within a slide:

- `padding: var(--margin)` on every `<section>` — the brandbook's `marginIn` value (default 0.5in).
- Card gap in `card-row`: `1.2em` — tuned for the default body size; scales with `--size-body`.
- Column gap in `two-column`: `2em` — wider than card gap because column content is denser.

Don't override these with inline styles. If a layout needs different spacing, add a new layout archetype.

## Density

A slide should fit the eye at a single glance — about 7 ± 2 chunks of information. Chunks:

- A heading
- A paragraph (≤3 sentences)
- A bullet list item
- A card
- A statistic
- An image

7 cards exceed glanceable density. 3-4 work. Split when in doubt.

## Anti-decoration

- **No drop shadows on text.** Use `--color-ink` if it needs more weight.
- **No gratuitous gradients.** CSS supports them but the brandbook doesn't define them — adding one inserts a token outside the system.
- **No icon-for-icon's-sake.** If an icon doesn't carry meaning (status, category, action), skip it.
- **No fly-in animations.** Default Reveal transition is `fade` for a reason — let content land, don't perform it.

## What good looks like

- A new viewer understands the slide's point in under 5 seconds.
- The type hierarchy reads at a glance — hero, supporting, muted.
- Palette is consistent across the deck — no rogue colors.
- Every slide has a clear single subject.
- The deck's visual story is told by *what's on each slide*, not by *how each slide looks*.
