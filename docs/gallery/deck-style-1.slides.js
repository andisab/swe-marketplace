module.exports = { motion: false, minutes: 25, slides: [
  { layout: "title", title: "Platform engineering review, Q3", subtitle: "What changed in how a change reaches production", footer: "Platform team · October 2026",
    notes: "Open with the one number on the next slide, then the three changes.\n\n- Keep the intro under a minute [pause]" },
  { layout: "bigNumber", figure: "3.4", unit: "×", label: "faster from merged PR to production, median, Q3 vs Q1", context: "Q1: 38 min · Q3: 11 min. Source: deploy pipeline events, 2,140 deploys.",
    notes: "Lead with the number, then the story behind it.\n\n- **No mandate:** teams opted in after a two-week pilot\n- The shared setup did most of the work [pause]" },
  { layout: "card-row", kicker: "WHAT GOT BUILT", title: "Three changes that mattered", cards: [
    { heading: "Inline CI", body: "Tests run in the PR's own branch. No remote queue, no second checkout." },
    { heading: "Per-route p99", body: "Latency alerts per route, not per service. 47% fewer pages." },
    { heading: "Canary by default", body: "Every deploy goes 1% → 10% → 50% → 100%. Zero user-facing incidents in Q3." } ] },
  { layout: "image-caption", src: "../charts/waterfall.svg", alt: "Waterfall chart of operating cost per deploy", caption: "Cost per deploy, Q1 to Q3: price and volume effects added, mix, costs and FX took away. Net −1 point." },
  { layout: "two-column", title: "Before and after, for an engineer", left: "<strong>Q1</strong><ul><li>Open a PR, wait for the shared runner</li><li>Ask #deploys for a slot</li><li>Watch the dashboard for an hour</li></ul>", right: "<strong>Q3</strong><ul><li>Open a PR; CI runs in the branch</li><li>Merge; the canary starts itself</li><li>Get paged only for your route</li></ul>" },
  { layout: "quote", quote: "I stopped keeping a browser tab open for deploys. That's the whole review.", attribution: "— Staff engineer, payments team, Q3 retro" },
]};
