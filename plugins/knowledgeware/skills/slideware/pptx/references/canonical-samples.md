# Canonical sample decks

Three reference decks ship with this skill. They demonstrate **what good looks like** across three distinct brandbook personalities. **Read the rendered PNGs first** before authoring — concrete examples are stronger than abstract rules.

| Sample | Brandbook | Personality | Use as reference for |
|---|---|---|---|
| [`assets/samples/aab/`](../assets/samples/aab) | aab (default) | Warm-gray editorial, diagrammatic, outlined containers | Light, calm, technical decks — the default for unspecified requests |
| [`assets/samples/anthropic/`](../assets/samples/anthropic) | anthropic | Cream canvas, serif body, single clay accent | Editorial, research, "publication-voice" content |
| [`assets/samples/linear/`](../assets/samples/linear) | linear | Dark layered backgrounds, indigo accent, tight tracking | Dark-first product decks, engineering reviews, anything "precise SaaS" |

## How to use them

### Before authoring a new deck

1. Identify the closest matching brandbook (or the explicit brandbook the user requested).
2. **Look at the PNGs** in `assets/samples/<bb>/preview/slide-*.png`. Each sample is 6 slides covering 6 distinct archetypes.
3. Read the source `assets/samples/<bb>/build-deck.js` to see the *exact* pptxgenjs patterns that produce those visuals: chrome (kicker, page number), card layouts, accent placement, table styling.
4. Borrow patterns. Adapt to the new content.

### What each sample covers

**aab** (default — warm-gray editorial):
1. Title hero with single light-blue accent bar
2. Big stat in an outlined card (the AAB "diagrammatic" signature)
3. Two-column tradeoff (red vs sage-green hairline borders)
4. Horizontal process flow with light-blue connectors
5. Data table with sage-tinted highlight row
6. Icon-row takeaways with hairline divider + resources footer

**anthropic** (cream + serif):
1. Title hero — cream bg, clay top bar, serif display headline
2. Pull quote (large serif italic with decorative quote mark)
3. Three big stats with hairline rules, serif numerals
4. Two-column tradeoff using cream cards on cream bg
5. Vertical timeline with clay dots and serif content
6. Icon-row takeaways with left clay accent strip

**linear** (dark precision):
1. Title hero on deepest dark with bright accent strip
2. Big stat — 200pt bright accent number
3. Three-column cards on elevated dark surfaces (level-3 backgrounds, no shadows)
4. Asymmetric editorial mid-deck divider
5. Data table with translucent row alternation + status icons (✓/✗)
6. Closing CTA — bullet column + indigo brand button

## Don't copy — adapt

Each sample is one of *infinitely many* good decks for that brandbook. The same brandbook can take many forms — the samples just demonstrate the principles in action.

**Reuse:**
- Chrome patterns (kicker placement, page-number style, hairline rule positions)
- Color application (which color goes on accent strips vs text vs borders)
- Layout coordinates and proportions for common archetypes
- Font-size + weight + tracking combinations

**Don't reuse:**
- The literal slide content (it's about platform engineering — your deck is about something else)
- The specific number of slides (your outline determines that)
- The exact archetype mix (pick archetypes that fit *your* content)

## Rebuilding the samples (e.g., if you update a brandbook)

```bash
cd assets/samples/<bb>
node $PLUGIN/scripts/load-style.js <bb> -o style-tokens.json
node build-deck.js .
bash $PLUGIN/skills/slideware/pptx/scripts/render-slides.sh deck.pptx preview/
python3 $PLUGIN/skills/slideware/pptx/scripts/polish-deck.py deck.pptx
```

All three samples pass polish-deck cleanly. Keep it that way if you edit them.
