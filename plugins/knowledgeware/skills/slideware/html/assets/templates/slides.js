// slides.js — slide descriptors for the slideware html format builder.
//
// Each slide is one object. The `layout` field picks a layout archetype; the
// remaining fields are layout-specific content. See references/layout-patterns.md
// for the full archetype list and field schemas.
//
// ── AUTHORING CHECKLIST (read while editing) ──
// 1. Vary layouts. Don't reach for "bullets" or "card-row" twice in a row unless
//    the content's parallel structure genuinely demands it.
// 2. Each `card-row` should have 2-4 cards. 5+ overflows on 16:9.
// 3. `bigNumber` slides need a label *and* a unit, or the figure floats meaningless.
// 4. Quote attribution is required; an anonymous pull-quote breaks reader trust.
// 5. `title` is the FIRST slide. Subsequent section dividers use `section`.
// 6. Body strings can include light HTML — <strong>, <em>, <code>, <br>, <a href>.
//    Don't author <h1>/<h2> tags; layouts emit their own heading hierarchy.
// 7. Any slide takes optional `notes` (plain text: blank lines split paragraphs,
//    "- " lines form a list, **bold**, *italic*, [pause]), a `cue`
//    { session, module, run } (run: default | cut-first | add-back | backup), and
//    `hidden: true` to leave it out of the deck. For a pace plan, export
//    { minutes: 20, slides: [...] } or { sessions: { "Session 1": 90 }, slides: [...] }
//    instead of the bare array. Press S in the deck to present, N for a rehearsal
//    drawer, O for an overview of every slide grouped by `section` slide. See
//    references/reveal.md §Speaker notes.
// 8. Entrance motion is on by default. Turn it off with `motion: false` next to
//    `slides` (or on one slide). See references/reveal.md §Entrance motion.
// 9. `footer: "Program name"` (or an array of strings) next to `slides` puts a running
//    footer on every slide but the title slide: the text, the brand's logo (staged by
//    load-style.js into ./assets/ when the style is a brand; none for a generic style)
//    and the page number. `logo` names another SVG; `logo: false` leaves it out.
//    See references/reveal.md §Running footer and logo.
// 10. Lanes: the same deck worked for another audience. Give the slides that change a
//    `key`, list overlay files in `lanes` (each exports { name, replace, slides: { key:
//    { fields } } }), and one build writes index.html plus index-<id>.html per lane, each
//    with a lane switcher in its overview. See references/reveal.md §Lanes.
// 11. `review: true` next to `slides` also writes index.review.html (and a .review file per
//    lane): E edits text and notes, L edits a slide's layout, the overview reorders slides,
//    and once the deck folder is connected the edits save themselves as ./edits.json, which
//    every build folds back into this file. index.html stays the file to share. See
//    references/reveal.md §Review mode.
// 12. Layout knobs a slide may set, and that layout mode writes: `ratio: "40/60"` (two-column),
//    `gap` and `pad` in px, `scale` in percent of the slide width (image-caption), and
//    `tweaks: { "cards.1": { dx: 12, dy: -8 }, image: { w: 60 } }` to nudge a block (dx, dy in px)
//    or size media (w in percent). Leave them out for the layout's defaults.
// 13. Builds: `steps: true` on a bullets, card-row, two-column, image-caption or quote slide
//    reveals its items one click at a time (`steps: "rest"` shows the first at once); an array
//    gives one entry per click in any order of arrival: item indices, or the `id` of an element in
//    the slide's HTML (an SVG group, a span), grouped in an array when several arrive together:
//    `steps: [[0, 1], 2, ["chart-g2", 3]]`. Each item's entrance motion plays on its click.
//    Mark the clicks in the notes as [click 1], [click 2]. A deck assembled from several sources
//    can carry a deck-plan.md beside this file (SKILL.md §Planning a deck); the build reads it.
// 12. `spec: "../my-unit.html"` next to `slides` names the deck's spec page (the knowledgebase
//    page with its volatility table and outline), and `teaches: "<section-id>"` on a slide names
//    the section it teaches. Neither renders; both let the librarian keep the deck current.

module.exports = [
  {
    layout: "title",
    title: "Deck title goes here",
    subtitle: "Optional subtitle or context",
    footer: "Optional small caption / date / author",
  },
  {
    layout: "section",
    kicker: "PART ONE",
    title: "Section heading",
  },
  {
    layout: "two-column",
    title: "Two-column layout",
    left: "Left column body. Markdown-ish: <strong>bold</strong>, <em>italic</em>.",
    right: "Right column. Can be a list — wrap items in <ul><li>...</li></ul>.",
  },
  {
    layout: "card-row",
    title: "Card row — 2-4 cards in a row",
    cards: [
      { heading: "Card 1", body: "Short body. One or two sentences max." },
      { heading: "Card 2", body: "Short body. Parallel structure across cards." },
      { heading: "Card 3", body: "Short body. Resist the urge to overfill." },
    ],
    notes: "What the presenter says over this slide.\n\n- One point per card\n- Land the **third** card [pause]",
    cue: { module: "Part one", run: "default" },
  },
  {
    layout: "bigNumber",
    figure: "94",
    unit: "%",
    label: "Of users completed onboarding within 7 days",
    context: "Up from 71% in Q1. Source: internal analytics, 2025-08.",
  },
  {
    layout: "quote",
    quote: "The medium is the message.",
    attribution: "— Marshall McLuhan, Understanding Media (1964)",
  },
];
