# Layout patterns

8 archetypes shipped in v1. Pick deliberately per slide; vary across the deck.

## 1. title

Opening slide. Large hero text, optional subtitle, optional small footer.

```
┌────────────────────────────────────┐
│                                    │
│  Hero title (44pt serif)           │
│                                    │
│  Subtitle / context (28pt sans)    │
│                                    │
│                                    │
│  footer • date • author     [10pt] │
└────────────────────────────────────┘
```

```js
{ layout: "title", title: "...", subtitle: "...", footer: "..." }
```

## 2. section

Divider between sections of a longer deck. Big heading on `surfaceAlt` background with an accent stripe on the left.

```
┌▌───────────────────────────────────┐
│▌                                   │
│▌ KICKER (10pt accent, uppercase)   │
│▌                                   │
│▌ Section heading (32pt serif)      │
│▌                                   │
│▌                                   │
└▌───────────────────────────────────┘
```

```js
{ layout: "section", kicker: "PART ONE", title: "..." }
```

## 3. two-column

Side-by-side text. Use for compare/contrast, before/after, problem/solution.

```
┌────────────────────────────────────┐
│ Title (28pt serif)                 │
│                                    │
│ ┌─────────────┐ ┌─────────────┐   │
│ │ Left col    │ │ Right col   │   │
│ │ body text   │ │ body text   │   │
│ │ ...         │ │ ...         │   │
│ └─────────────┘ └─────────────┘   │
└────────────────────────────────────┘
```

```js
{ layout: "two-column", title: "...", left: "...", right: "..." }
```

Both `left` and `right` accept light HTML — `<strong>`, `<em>`, `<code>`, `<br>`, `<ul><li>...</li></ul>`.

## 4. card-row

2-4 parallel content blocks. Use for capabilities, KPIs, principles.

```
┌────────────────────────────────────┐
│ Title (28pt serif)                 │
│                                    │
│ ┌────┐ ┌────┐ ┌────┐               │
│ │HD 1│ │HD 2│ │HD 3│               │
│ │body│ │body│ │body│               │
│ └────┘ └────┘ └────┘               │
└────────────────────────────────────┘
```

```js
{
  layout: "card-row",
  title: "...",
  cards: [
    { heading: "...", body: "..." },
    { heading: "...", body: "..." },
    { heading: "...", body: "..." },
  ],
}
```

**Card count constraint**: 2-4. 5+ overflows on 1280×720 with the default type scale.

## 5. bigNumber

A single dominant figure. Use for headline stats, KPIs, "94%" moments.

```
┌────────────────────────────────────┐
│                                    │
│  KICKER (10pt accent, optional)    │
│                                    │
│  94%      ← 144pt serif accent     │
│                                    │
│  Of users completed onboarding     │
│  within 7 days (28pt)              │
│                                    │
│  Source / context (10pt muted)     │
└────────────────────────────────────┘
```

```js
{ layout: "bigNumber", figure: "94", unit: "%", label: "...", context: "..." }
```

`unit` is optional but recommended — a unit-less number floats meaningless.

## 6. quote

Pull-quote with attribution. Use sparingly — once per deck max.

```
┌────────────────────────────────────┐
│                                    │
│  ▌                                 │
│  ▌ "The medium is the message."    │
│  ▌                                 │
│                                    │
│      — Marshall McLuhan, 1964      │
│                                    │
└────────────────────────────────────┘
```

```js
{ layout: "quote", quote: "...", attribution: "— Name, Context" }
```

Attribution is **required**. Anonymous pull-quotes break reader trust.

## 7. bullets

Last resort. Use only when content is genuinely a list — capabilities, requirements, steps.

```
┌────────────────────────────────────┐
│ Title (28pt serif)                 │
│                                    │
│  • Item one                        │
│  • Item two                        │
│  • Item three                      │
│                                    │
└────────────────────────────────────┘
```

```js
{ layout: "bullets", title: "...", items: ["...", "...", "..."] }
```

**If you're reaching for `bullets` twice, you're probably defaulting.** Re-read the content and pick a more specific archetype (card-row, two-column, sequence of bigNumbers).

## 8. image-caption

Full-bleed image with caption below. Use for screenshots, charts, diagrams.

```
┌────────────────────────────────────┐
│        ┌──────────────────┐        │
│        │                  │        │
│        │    [ image ]     │        │
│        │                  │        │
│        └──────────────────┘        │
│                                    │
│         Caption text (10pt)        │
└────────────────────────────────────┘
```

```js
{ layout: "image-caption", src: "./screenshot.png", alt: "...", caption: "..." }
```

**Image path is relative to the deck dir.** For shareable output, either base64-inline the image (manual step), point at an absolute URL, or accept that the image must travel alongside `index.html`.

## Adding new archetypes

A new layout is two changes:

1. Add a `<section class="layout-<name>">...</section>` HTML template in `build-deck.js` under `renderers`.
2. Add the matching CSS rules under `themeCss()`, scoped under `.reveal section.layout-<name>`.

Then document it here with an ASCII sketch and the descriptor schema.

## Anti-monotony quick check

| Deck length | Distinct layouts (target) |
|---|---|
| 3-5 slides | 3-4 |
| 6-10 slides | 4-6 |
| 11+ slides | 5-7 |

If you've used `card-row` 3× in a 6-slide deck, swap one for a `bigNumber` or `two-column` — same content, different shape.
