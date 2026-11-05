# Slide pattern catalogue

Proven ways to express one kind of idea on a slide: a sequence, a comparison, a number that matters. Each pattern is written against the brand's tokens, so it renders in any brand; the brand's `css/slideware.css` and its brandbook refine it, and where the brand says otherwise, the brand wins. The catalogue is a source of ideas, not a closed set: adapt a pattern, combine patterns, or invent a layout in the deck's CSS when none expresses the content clearly ([../../SKILL.md](../../SKILL.md) §Anti-monotony).

```
node $PLUGIN/skills/slideware/html/engine/cli.js catalog            # every pattern: name, title, the idea it expresses
node $PLUGIN/skills/slideware/html/engine/cli.js pattern steps      # one pattern's file: when to use it, its CSS, an example slide
node $PLUGIN/skills/slideware/html/engine/cli.js gallery out.html --brand <name>   # all the examples as a deck
```

## Using a pattern

Copy the pattern's example slide into the deck, give it a new `data-key`, and replace the content. The section's class names the pattern (`class="layout-steps"`); `new` and `refresh` copy the CSS of `core` and of every pattern the slides use into the deck's `#sw-kit` region. Changes for one deck go in `#sw-deck-css`, never in `#sw-kit`, which `refresh` rewrites.

## Where patterns live

| Catalogue | Path | Who adds to it |
|---|---|---|
| The plugin's | `skills/slideware/html/catalog/` | the plugin's maintainer; Claude asks before proposing an addition |
| Yours | `slideware/catalog/` in the knowledgeware home (`~/.claude/knowledgeware`, or `$KNOWLEDGEWARE_HOME`; `node scripts/home.js` prints it) | you; Claude offers when a deck produces a pattern worth keeping |

A pattern in your catalogue shadows the plugin's pattern of the same name. Your catalogue is yours to keep in version control or not.

## Writing a pattern

One file, `<name>.html`:

```html
<!-- pattern
name: steps
title: Numbered steps
idea: A sequence the audience follows in order, with the result beside it.
use: Procedures, runbooks, a rollout; three to six steps.
avoid: Items without an order (use card-row).
builds: one step per click
from: where it was proven (a deck and slide)
-->
<style>
section[data-key].layout-steps ol.steps { … }
</style>
<section data-key="example-steps" class="layout-steps"> … </section>
```

- **Scope** every rule under `section[data-key].layout-<name>`.
- **Tokens only** for colour, type, radius and spacing: `--color-*`, `--font-*`, `--size-*`, `--radius`, `--margin`, `--shadow-opacity` ([../FORMAT.md](../FORMAT.md) §Token → CSS mapping). A name outside that set gets a fallback to one inside it (`var(--size-eyebrow, var(--size-caption))`), so the pattern works in every brand without a schema change.
- **Leave identity to the brand**: no hard-coded colours or faces, no logos; structure, spacing and hierarchy are the pattern's job.
- **The brand layer wins**, whatever the selector, and a brand's `slideware.css` may style `p`, `li`, `small`, headings, `pre` and `code` directly. Give an element with its own typography (a verdict line, a big number's caption) a `div` or `span`, not a `p`; colour code on its line spans, not on `pre`; avoid class names a brand already uses for something else (`.badge`).
- **On a dark ground, use `.inverse`** from core. It sets the element on `--color-bg-dark` and redefines the ink, border and surface tokens inside it, so the kit's text rules and the brand's follow. A pattern rule that sets the same element's background needs one more line for its `.inverse` state.
- **Let the content set the count.** Lay out with grid and flex, and take the number of items as a variable (`--n`) rather than hand-placing SVG coordinates; `cos()` and `sin()` place items on a ring. Percent heights need `box-sizing: border-box`.
- **Fill the slide.** The main block takes the free height (`flex: 1 1 auto; min-height: 0`) and spreads its content across it; an example whose content sits in the top third reads as unfinished.
- **The example** uses neutral placeholder content, carries notes, and marks its builds (`data-step`). Check it with `gallery` and `check --render` in a light style, a dark style (style-3) and a brand with its own `slideware.css` before adding it.
