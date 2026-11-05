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
- **The example** uses neutral placeholder content, carries notes, and marks its builds (`data-step`). Check it with `gallery` in two brands before adding it.
