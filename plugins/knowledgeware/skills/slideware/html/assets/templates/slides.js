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
