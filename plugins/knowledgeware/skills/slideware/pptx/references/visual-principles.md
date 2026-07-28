# Visual principles

Distilled from Apple HIG, Tufte, Lupton's *Thinking with Type*, and the Swiss grid tradition. These are **principles** — internalize them, then break them on purpose.

## The four that matter most for slides

### 1. Hierarchy — make importance visible at a glance

Within 2 seconds the viewer should know what's primary, secondary, tertiary. Achieve via **size** (>2× ratio between levels), **weight** (semibold ≠ regular), **color** (ink vs muted vs faint), and **position** (top-left first in LTR). Don't rely on just one.

A 36pt title next to 14pt body works. A 24pt title next to 18pt body doesn't.

### 2. Proximity — related things touch, unrelated things separate

If a caption belongs to an image, leave 0.05–0.1" between them. If it belongs to the next image, leave 0.4"+. The gap is a relationship signal. **Uneven gaps == accidental meaning.** Equal gaps everywhere means nothing reads as grouped.

**Column width should match content width.** A text column 8" wide with paragraphs that wrap at ~5" leaves 3" of whitespace on the right and reads as accidentally truncated — the viewer assumes content was cut off. Either narrow the column to match the actual text width, or put something in the empty space (a pull quote, a callout, an image). Bounding boxes that are obviously larger than the content they hold are the most common silent visual failure.

### 3. Alignment — every element snaps to something

A grid, the slide center, or another element's edge. **Optical alignment beats mathematical.** A right-pointing arrow centered at `(10-w)/2` looks slightly left because its visual mass leans right — compensate by eye.

For text, baselines align — not bounding boxes. pptxgenjs text boxes have internal padding (~0.05–0.1"); set `margin: 0` when aligning text with shape edges, then nudge by hand.

### 4. Whitespace — a positive element, not absence

Crowded slides read as panicked. For 16:9 (10×5.625"), aim for **0.5"+ margins** on all four sides and **0.3–0.5" gaps** between content blocks. If a slide feels cluttered, the answer is almost always *remove*, not *resize*.

## Three more that catch common failures

### Contrast — dominance, not equality

One element dominates. Title, a single stat, an image, or a quote — pick one. The 60-30-10 rule: 60% of visual weight on the dominant, 30% on supporting, 10% on the accent.

### Repetition — repeat to create unity

Pick a motif (icon-in-circle, accent bar on one side, hairline rule under kicker, soft card shadow) and use it on **every** slide it applies to. Skipping it on one slide reads as half-finished, not creative.

### Optical centering

Headlines mathematically centered often look slightly low. Nudge up 2-4pt. For vertically-centered text in a box, prefer `valign: "middle"` + a height that matches actual content height (oversized boxes + center valign get thrown off by internal padding).

## Color

- **One brand color**, used at one or two intensities. The brandbook is the source.
- **Accents** appear at <10% area, never as the primary background or text.
- **Background ≠ pure black, ≠ pure white.** Soften by 2-5 RGB units (`#121212`, `#FAFAFA`). The brandbook handles this if you load it.
- **Two colors create relationship; three creates a triad; four+ creates chaos** unless there's a real categorical reason (e.g., status: red/amber/green).
- Check every text-on-fill combination for ≥4.5:1 contrast.

### Color must be semantic, not decorative

If you assign different accent colors across cards/items in a slide, the variation must encode a **category** — otherwise the eye reads it as random.

- ✓ Three cards using red/amber/green to encode risk levels (high/medium/low).
- ✓ Three cards using one consistent accent — visual cohesion, meaning is in the text.
- ✗ Three cards each with a different brandbook color "for variety" — reads as chaotic.
- ✗ Four icons all blue except one yellow, with no reason — the viewer wastes cycles decoding meaning that isn't there.

If you can't articulate *why* element A is one color and element B is another, give them the same color.

## Type

- **Two type families max** per deck (one display, one body). Three only if mono is justified (code).
- **Line length**: 45-75 characters comfortable; >90 hard to read. At 14pt body, that's roughly 5-7" wide.
- **Line-height**: 1.2-1.4 for body, 1.0-1.15 for headlines.
- **Letter-spacing**: leave at 0 unless the brandbook says otherwise. Negative tracking (-0.01 to -0.02em) only at >36pt. ALL CAPS labels can take +0.05em.

### Size scale (16:9 slides)

| Element | Size |
|---------|------|
| Title slide hero | 40-48pt bold |
| Slide title | 28-36pt bold |
| Section header | 18-24pt bold |
| Body / bullets | 14-16pt |
| Sub-bullets | 12pt |
| Captions / footnotes | 9-11pt muted |
| Slide numbers | 9pt right-aligned |

### Type pairings (when no brandbook specifies)

| Header | Body |
|--------|------|
| Georgia | Calibri |
| Source Serif 4 | Inter |
| Bitter | Inter |
| Lora | Source Sans 3 |
| Libre Franklin | Source Serif 4 |

Default Arial everywhere reads as "draft." Pick a pairing with personality.

## Per-slide design rules

- **Every slide needs a visual element.** Icon, shape, chart, photo, stat callout, or accent bar. Text-only slides are forgettable.
- **Sandwich the dark/light contrast.** Dark backgrounds for title + closing (or commit to dark throughout). Don't mix random light/dark slides mid-deck.
- **Commit to ONE motif.** Rounded image frames, icons in colored circles, thick single-side borders, hairline rules under kickers, soft card shadows — pick one, carry it.

## Spacing

- **0.5" minimum** from slide edges.
- **0.3-0.5"** between content blocks.
- **Pick one gap value** (0.3 OR 0.5) and reuse — random spacing kills rhythm.
- Leave breathing room; don't fill every inch.

## Anti-patterns (don't do these)

- **Repeating the same layout** five slides in a row.
- **Centering body text** — left-align paragraphs; only titles get centered.
- **Skimping on size contrast** — titles below 28pt look weak against 14pt body.
- **Defaulting to blue** — pick colors that fit the topic.
- **Decorative accent lines under every title** — the AI-deck tell. Replace with whitespace, a kicker eyebrow, or a soft background change.
- **Styling one slide elaborately and leaving the rest plain** — commit fully or keep it consistently simple.
- **Mismatched fonts across slides** — pick a pairing and stick to it.

## When you break a principle, do it loud

Half-broken rules look like mistakes. Fully-broken rules look like style.

## What "creativity" means here

It's not weird layouts — it's *fit*. The layout arises from the content's structure. Timeline → horizontal flow. Choice → side-by-side. Trajectory → big stat. Stop reaching for the 3-card row when the content is a sequence, a tradeoff, or a single insight. See [layout-patterns.md](layout-patterns.md).
