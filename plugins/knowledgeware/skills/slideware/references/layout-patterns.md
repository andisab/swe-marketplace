# Layout pattern library

12 archetypes. **Pick what fits the content, not what fits the template.** ANTI-MONOTONY: no archetype appears more than once per deck.

ASCII sketches assume 10" × 5.625" canvas (each char ≈ 0.5"). `█` = solid block. `▒` = soft fill.

---

## 1. Title hero (dark or accent)

Single dominant headline, optional eyebrow + lede. Openings and major section breaks.

```
████████████████████  ← 0.08" accent bar
                      
DECK · MODULE          ← 12pt eyebrow, accent color
                      
Your Headline         ← 40-48pt display, 2 lines max
Goes Here             
                      
One line of subtitle  ← 15pt muted
                      
Org · Date            ← 10pt very muted
```

---

## 2. Big stat callout

ONE number anchors the slide. Use at most once per deck.

```
                                       
              68%                      ← 96-120pt number
                                       
       of teams report this            ← 18pt label, centered below
                                       
       Source: ...                     ← 9pt footnote
```

When: a single stat carries the message.

---

## 3. Two-column tradeoff

Always exactly 2 columns. Different fills/borders to reinforce contrast.

```
KICKER · 02                     SLIDE TITLE                       2/8

  ┌──────────────┐  ┌──────────────┐
  │ ✗ Without X  │  │ ✓ With X     │   ← header colors contrast
  │              │  │              │
  │ • point      │  │ • point      │
  │ • point      │  │ • point      │
  └──────────────┘  └──────────────┘
```

When: before/after, problem/solution, current/proposed.

---

## 4. Three-column cards (the overused one)

Use at most ONCE per deck. Default temptation — resist when content is a sequence or tradeoff.

```
KICKER                         SLIDE TITLE                        3/8

  ┌────────┐  ┌────────┐  ┌────────┐
  │  ●     │  │  ●     │  │  ●     │   ← icon top, optional accent strip
  │  Name  │  │  Name  │  │  Name  │
  │ descrip│  │ descrip│  │ descrip│
  └────────┘  └────────┘  └────────┘
```

When: three parallel items of equal weight (features, principles, tiers).

---

## 5. Half-bleed image + content

Full-bleed image on one side; content on the other. The image is the visual element — no extra icons needed.

```
██████████████████  KICKER                    2/8
██████████████████  
██████████████████  Headline
██████████████████  
██████████████████  Body paragraph or
██████████████████  short bullet list.
██████████████████  
██████████████████  Optional small CTA.
```

When: a single concept supported by visual evidence (screenshot, photo, diagram).

---

## 6. Process flow (horizontal)

Sequence of 3-6 steps with arrows.

```
KICKER                         SLIDE TITLE                        4/8

  ┌──┐ → ┌──┐ → ┌──┐ → ┌──┐ → ┌──┐
  │01│   │02│   │03│   │04│   │05│
  └──┘   └──┘   └──┘   └──┘   └──┘
  step    step    step    step    step
  detail  detail  detail  detail  detail
```

When: pipelines, workflows, before-X-then-Y-then-Z.

---

## 7. Vertical timeline (rows)

For 4-7 milestones with dates + descriptions. Cleaner than horizontal for ≥5 items.

```
KICKER                         SLIDE TITLE                        5/8

  ●─────  Q1 2026     Headline of milestone
  │       Sub-detail
  │
  ●─────  Q2 2026     Headline
  │       Sub-detail
  │
  ●─────  Q3 2026     Headline
```

When: dated rollouts, phased plans, history.

---

## 8. Icon-row list (key takeaways)

5-8 short items, each prefixed by an icon. Replaces bullet lists when you want more polish.

```
KICKER                         SLIDE TITLE                        9/9

  ✓   First takeaway in one tight line
  ◆   Second takeaway
  ★   Third takeaway
  →   Fourth takeaway
  ◉   Fifth takeaway
  
  Bottom resources bar: link · link · link
```

When: closing takeaways, principles, ground rules.

---

## 9. Pull quote / testimonial

Large italic quote dominates; small attribution.

```
KICKER                                                            6/8

        "A single sentence that's worth
         repeating, set at 28-32pt serif
         italic."

                              ── Attribution Name
                                 Role, Organization
```

When: customer quotes, expert testimony, founding principle.

---

## 10. Data table

Native pptx table. Use real tables, not stacked text boxes.

```
KICKER                         SLIDE TITLE                        7/8

  ┌──────────┬─────────┬─────────┬─────────┐  ← header row dark fill, white text
  │ Feature  │ Free    │ Pro ★   │ Enterpr.│
  ├──────────┼─────────┼─────────┼─────────┤
  │ X        │ 1k/mo   │ 50k/mo  │ ∞       │
  │ Y        │ —       │ ✓       │ ✓       │
  └──────────┴─────────┴─────────┴─────────┘
```

When: pricing, feature comparisons, anything with rows × cols of small data.

---

## 11. Chart-focused

A single chart dominates. Always include a 1-sentence takeaway above.

```
KICKER                         SLIDE TITLE                        5/8

  TAKEAWAY: one-sentence reading of the chart      ← italic muted

  ┌──────────────────────────────────────────┐
  │            [pres.charts.LINE]            │
  └──────────────────────────────────────────┘

  Source: ...                                ← 9pt muted
```

When: any quantitative claim.

---

## 12. Asymmetric / editorial

Large display headline with a small content panel offset. Short content + visual gravity.

```
KICKER                                                            6/8

  Big idea                       Small panel:
  in just a                      - point
  few words                      - point
                                 - point

                                 Tiny attribution
```

When: section openers mid-deck, manifesto-style slides, single insights with brief support.

---

## Example mix (6-slide deck)

Bad: title → cards → cards → cards → cards → takeaways
Good: title → tradeoff → cards → big-stat → flow → takeaways

The good version has 6 archetypes and 6 visual rhythms.
