// build-deck.js — Reveal.js deck builder for the slideware/html skill.
//
// Reads:
//   ./style.md      — design styleSpec (YAML frontmatter) — the brandbook, written out by html/scripts/load-style.js (spec: brandware references/brandbook-spec.md)
//   ./slides.js     — array of slide descriptors — see slides.js for the schema
//   ./assets/logo-light.svg, logo-dark.svg — optional; the brand's logo for the running footer.
//                     load-style.js copies them from the brand's folder; a generic style has none.
//   ./edits.json    — optional; text and notes edited in a deck's review mode (E in the deck,
//                     see ./review.js). Folded into slides.js (or the lane's overlay) before
//                     every build, then deleted; what can't be folded stays and is layered.
//
// Writes:
//   ./index.html    — single self-contained HTML file: Reveal (from node_modules), theme
//                     CSS and the presenter plugin (./presenter.js) INLINED, so the deck
//                     runs with no network. Only the fonts load from Google Fonts (<link>);
//                     offline they fall back to system fonts.
//   ./index.review.html (and index-<lane>.review.html) — with `review: true` next to `slides`
//                     (or `--review`): the same deck with ./review.js inlined, for the person
//                     building it. E edits text and notes in place, the overview reorders, hides
//                     and deletes slides, Shift+B rebuilds through serve-deck.js. Share the
//                     plain files; keep the .review files with the deck folder.
//
// Setup (one-time per deck dir):
//   cp $PLUGIN/skills/slideware/html/assets/templates/{build-deck.js,presenter.js,review.js,slides.js,package.json} .
//   npm install                     # js-yaml and the pinned reveal.js
//   node $PLUGIN/skills/slideware/html/scripts/load-style.js <name|path> -o ./style.md
//   node build-deck.js .            # add --review to inline the review mode for this build
//
// ── PRE-BUILD ALIGNMENT CHECKLIST (run mentally per slide before building) ──
// 1. Vary layouts. The anti-monotony rule applies — see SKILL.md.
// 2. `card-row` slides need 2-4 cards. 5+ overflows the 1280×720 frame.
// 3. Long body text in narrow columns wraps unpredictably. Test in a browser.
// 4. Background contrast: light-mode styles use palette.bg; dark-mode hero slides
//    pull palette.bgDark when present. The renderer picks per-layout.
// 5. NEVER inline absolute pixel positions in slide content — let layouts handle
//    geometry. If a slide needs custom positioning, add a new layout archetype.
//
// ── PITFALLS (these silently break the output) ──
// - Slide width/height defaults: Reveal uses 960×700; we override to 1280×720
//   for closer parity with 16:9 PowerPoint. Don't author at the default size.
// - Google Fonts URL needs `display=swap` to avoid FOIT (invisible text during load).
// - Custom CSS injected via the theme block MUST be scoped under .reveal — Reveal's
//   reset is aggressive and unprefixed rules get clobbered.
// - Don't reference ./style.md from the output HTML. Output must stand alone.
// - puppeteer/playwright for render-slides.sh need `--no-sandbox` on CI runners.

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const REVEAL_VERSION = "5.0.5"; // pinned here and in package.json; bump both together (reveal.js releases on GitHub)

const SLIDE_W_PX = 1280;
const SLIDE_H_PX = 720;

// Speaker-notes cue fields read by presenter.js (see references/reveal.md §Speaker notes).
const CUE_FIELDS = ["session", "module", "run"];
const CUE_RUNS = ["default", "cut-first", "add-back", "backup"];

// ── Brandbook styleSpec (from YAML frontmatter of ./style.md) ───────────
function loadStyleSpec(cwd) {
  const stylePath = path.join(cwd, "style.md");
  if (!fs.existsSync(stylePath)) {
    console.error("style.md missing. Either:");
    console.error("  node $PLUGIN/skills/slideware/html/scripts/load-style.js <name> -o ./style.md   # e.g. style-1, or a brand");
    console.error("  # or for custom brandbooks:");
    console.error("  node $PLUGIN/skills/slideware/html/scripts/load-style.js ./my-brand.md -o ./style.md");
    console.error("  # or generate from a CSS/URL via the loader script:");
    console.error("  node scripts/load-style.js <path> -o ./style.md");
    process.exit(1);
  }
  const text = fs.readFileSync(stylePath, "utf8");
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error("style.md has no YAML frontmatter. First lines must be:\n---\nname: ...\npalette: { ... }\n---");
    process.exit(1);
  }
  const styleSpec = yaml.load(fmMatch[1]);
  // Keep `#` in palette hex — CSS expects it. (Unlike pptxgenjs, which needs it stripped.)
  return styleSpec;
}

// ── Google Fonts URL builder ─────────────────────────────────────────
// Build a single `<link>` URL that pulls all the families we reference,
// each with a sensible weight range. Browsers cache per-family.
function googleFontsUrl(type) {
  const families = new Set();
  if (type.sans)  families.add(`${type.sans.replace(/ /g, "+")}:wght@400;500;600;700`);
  if (type.serif) families.add(`${type.serif.replace(/ /g, "+")}:wght@400;700`);
  if (type.mono)  families.add(`${type.mono.replace(/ /g, "+")}:wght@400;500`);
  if (families.size === 0) return null;
  const families_q = [...families].map(f => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${families_q}&display=swap`;
}

// ── Theme CSS generator ──────────────────────────────────────────────
function themeCss({ palette: P, type: T, layout: L }) {
  // CSS variables — palette hex includes `#` because that's how style.md stores it.
  // Defensive: if for some reason a value comes in without `#`, prepend it.
  const hex = (v) => v == null ? "" : (String(v).startsWith("#") ? v : `#${v}`);
  return `
:root {
  --color-bg:          ${hex(P.bg)};
  --color-bg-dark:     ${hex(P.bgDark) || hex(P.ink)};
  --color-surface:     ${hex(P.surface)};
  --color-surface-alt: ${hex(P.surfaceAlt) || hex(P.surface)};
  --color-ink:         ${hex(P.ink)};
  --color-ink-body:    ${hex(P.inkBody) || hex(P.ink)};
  --color-ink-muted:   ${hex(P.inkMuted)};
  --color-ink-faint:   ${hex(P.inkFaint) || hex(P.inkMuted)};
  --color-border:      ${hex(P.border)};
  --color-accent:      ${hex(P.accent)};
  --color-accent2:     ${hex(P.accent2) || hex(P.accent)};
  --color-success:     ${hex(P.success)};
  --color-warning:     ${hex(P.warning)};
  --color-error:       ${hex(P.error)};

  --font-sans:  ${T.sans ? `'${T.sans}', system-ui, sans-serif` : "system-ui, sans-serif"};
  --font-serif: ${T.serif ? `'${T.serif}', Georgia, serif` : "Georgia, serif"};
  --font-mono:  ${T.mono ? `'${T.mono}', ui-monospace, Menlo, monospace` : "ui-monospace, monospace"};

  --size-hero:    ${T.heroPt}pt;
  --size-section: ${T.sectionPt}pt;
  --size-title:   ${T.titlePt}pt;
  --size-body:    ${T.bodyPt}pt;
  --size-subbody: ${T.subBodyPt}pt;
  --size-caption: ${T.captionPt}pt;
  --size-code:    ${T.codePt}pt;

  --radius:         ${L.radiusPx}px;
  --shadow-opacity: ${L.shadowOpacity};
  --margin:         ${L.marginIn}in;
}

/* Reveal overrides — all scoped under .reveal to survive Reveal's reset */
.reveal {
  font-family: var(--font-sans);
  color: var(--color-ink-body);
  background: var(--color-bg);
}
.reveal .slides {
  text-align: left;
}
/* Reveal shows the current slide with an inline display taken from its display
   option, set to flex in Reveal.initialize so layouts can center vertically. */
.reveal .slides section {
  padding: var(--pad, var(--margin));
  box-sizing: border-box;
  height: 100%;
  flex-direction: column;
}
/* Bottom-left, clear of the navigation arrows in the bottom-right corner. */
.reveal .slide-number {
  right: auto;
  left: 8px;
}
.reveal h1, .reveal h2, .reveal h3, .reveal h4 {
  font-family: var(--font-serif);
  color: var(--color-ink);
  text-transform: none;
  margin: 0 0 0.5em 0;
  line-height: 1.15;
}
.reveal h1 { font-size: var(--size-hero); }
.reveal h2 { font-size: var(--size-section); }
.reveal h3 { font-size: var(--size-title); }
.reveal p, .reveal li {
  font-size: var(--size-body);
  line-height: 1.5;
  color: var(--color-ink-body);
}
.reveal small, .reveal .caption {
  font-size: var(--size-caption);
  color: var(--color-ink-muted);
}
.reveal code, .reveal pre {
  font-family: var(--font-mono);
  font-size: var(--size-code);
}
.reveal a {
  color: var(--color-accent);
  text-decoration: none;
  border-bottom: 1px solid var(--color-accent);
}
.reveal .kicker {
  font-family: var(--font-sans);
  font-size: var(--size-caption);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 0.4em;
}

/* ── Layout: title ─────────────────────────────────────────────── */
.reveal section.layout-title {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--color-bg);
}
.reveal section.layout-title h1 {
  font-size: var(--size-hero);
  margin-bottom: 0.3em;
}
.reveal section.layout-title .subtitle {
  font-size: var(--size-title);
  color: var(--color-ink-muted);
  font-family: var(--font-sans);
  margin: 0;
}
.reveal section.layout-title .footer {
  position: absolute;
  bottom: var(--margin);
  left: var(--margin);
  font-size: var(--size-caption);
  color: var(--color-ink-faint);
}

/* ── Layout: section ────────────────────────────────────────── */
.reveal section.layout-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--color-surface-alt);
  border-left: 6px solid var(--color-accent);
}

/* Grid items default to min-width: auto, so a single long unbreakable word (a URL,
   a code identifier, an uppercase heading with letter-spacing) can blow out the column
   and push the row past the slide's right edge. Two safeguards: min-width:0 lets
   columns shrink to their track, and overflow-wrap lets long strings break mid-word. */
.reveal section .cards > *,
.reveal section .columns > * {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ── Layout: two-column ─────────────────────────────────────── */
.reveal section.layout-two-column .columns {
  display: grid;
  grid-template-columns: var(--ratio, 1fr 1fr);
  gap: var(--gap, 2em);
  margin-top: 1em;
}

/* ── Layout: card-row ──────────────────────────────────────── */
.reveal section.layout-card-row .cards {
  display: grid;
  grid-template-columns: repeat(var(--card-count, 3), 1fr);
  gap: var(--gap, 1.2em);
  margin-top: 1em;
}
.reveal section.layout-card-row .card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, var(--shadow-opacity));
  overflow: hidden;
}
.reveal section.layout-card-row .card h4 {
  font-family: var(--font-sans);
  color: var(--color-accent);
  font-size: var(--size-subbody);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.3em;
}

/* ── Layout: bigNumber ─────────────────────────────────────── */
.reveal section.layout-bignumber {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}
.reveal section.layout-bignumber .figure-row {
  display: flex;
  align-items: baseline;
  gap: 0.2em;
  margin: 0.5em 0 0.3em 0;
}
.reveal section.layout-bignumber .figure {
  font-family: var(--font-serif);
  font-size: 144pt;
  color: var(--color-accent);
  line-height: 1;
  font-weight: 700;
}
.reveal section.layout-bignumber .unit {
  font-family: var(--font-serif);
  font-size: 72pt;
  color: var(--color-accent);
  line-height: 1;
}
.reveal section.layout-bignumber .label {
  font-size: var(--size-title);
  color: var(--color-ink);
  max-width: 80%;
  margin: 0.2em 0;
}
.reveal section.layout-bignumber .context {
  font-size: var(--size-caption);
  color: var(--color-ink-muted);
  margin-top: 0.8em;
}

/* ── Layout: quote ─────────────────────────────────────────── */
.reveal section.layout-quote {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.reveal section.layout-quote blockquote {
  font-family: var(--font-serif);
  font-size: var(--size-section);
  font-style: italic;
  color: var(--color-ink);
  border-left: 4px solid var(--color-accent);
  padding-left: 0.8em;
  margin: 0 0 0.6em 0;
  line-height: 1.3;
}
.reveal section.layout-quote .attribution {
  font-family: var(--font-sans);
  font-size: var(--size-subbody);
  color: var(--color-ink-muted);
  padding-left: 1em;
}

/* ── Layout: bullets ───────────────────────────────────────── */
.reveal section.layout-bullets ul {
  margin-top: 1em;
  padding-left: 1.5em;
}
.reveal section.layout-bullets li {
  margin-bottom: var(--gap, 0.6em);
}

/* ── Layout: image-caption ─────────────────────────────────── */
.reveal section.layout-image-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.reveal section.layout-image-caption img {
  max-width: var(--scale, 80%);
  max-height: 75%;
  object-fit: contain;
  border-radius: var(--radius);
}
.reveal section.layout-image-caption .caption {
  margin-top: 0.6em;
  font-size: var(--size-caption);
  color: var(--color-ink-muted);
  text-align: center;
}

/* Running footer (deck-level \`footer\` in slides.js): text left, the brand's logo and the page
   number right, on every slide but the title slide. Mono caption, muted, never in the way. */
.reveal .chrome-bot {
  position: absolute; left: var(--margin); right: var(--margin); bottom: 14px;
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--color-ink-muted); pointer-events: none;
}
.reveal .chrome-bot .ch-l { display: flex; align-items: center; min-width: 0; white-space: nowrap; overflow: hidden; }
.reveal .chrome-bot .ch-l span + span::before {
  content: ""; display: inline-block; width: 3px; height: 3px; border-radius: 50%;
  background: var(--color-ink-faint); margin: 0 14px; vertical-align: middle;
}
.reveal .chrome-bot .ch-r { display: flex; align-items: center; flex: none; }
.reveal .chrome-bot .ch-logo { height: 13px; width: auto; opacity: 0.85; }
.reveal .chrome-bot .ch-logo + .ch-pg { margin-left: 14px; }
.reveal .chrome-bot .ch-pg { letter-spacing: 0.08em; color: var(--color-ink-body); font-variant-numeric: tabular-nums; }

/* Blocks (data-b) take a nudge from a slide's tweaks: --dx / --dy as a relative offset (not a
   transform, which the entrance motion owns) and, on media, a width. Review mode's layout mode writes them. */
.reveal .slides section [data-b] { position: relative; left: var(--dx, 0px); top: var(--dy, 0px); }
.reveal .slides section [data-b][data-w] { width: var(--w); max-width: var(--w); }

/* Entrance motion: [data-a] elements animate in each time their slide becomes current,
   staggered by --i. Off in print, for reduced-motion viewers, and in the presenter view. */
.reveal .slides section.present [data-a] { animation: .5s cubic-bezier(.4, 0, .2, 1) calc(100ms + var(--i, 0) * 70ms) both; }
.reveal .slides section.present [data-a="up"]     { animation-name: a-up; }
.reveal .slides section.present [data-a="fade"]   { animation-name: a-fade; animation-duration: .7s; }
.reveal .slides section.present [data-a="left"]   { animation-name: a-left; }
.reveal .slides section.present [data-a="right"]  { animation-name: a-right; }
.reveal .slides section.present [data-a="pop"]    { animation-name: a-pop; animation-timing-function: cubic-bezier(.3, 1.4, .5, 1); }
.reveal .slides section.present [data-a="grow-x"] { animation-name: a-grow-x; animation-duration: .8s; transform-origin: left center; }
.reveal .slides section.present [data-a="grow-y"] { animation-name: a-grow-y; animation-duration: .8s; transform-origin: center bottom; }
.reveal .slides section.present [data-a="wipe"]   { animation-name: a-wipe; animation-duration: .9s; }
.reveal .slides section.present [data-a="draw"]   { animation-name: a-draw; animation-duration: 1.1s; }
.reveal [data-a="draw"] { stroke-dasharray: 1; }   /* the SVG shape needs pathLength="1" */
@keyframes a-up     { from { opacity: 0; transform: translateY(14px); } }
@keyframes a-fade   { from { opacity: 0; } }
@keyframes a-left   { from { opacity: 0; transform: translateX(-18px); } }
@keyframes a-right  { from { opacity: 0; transform: translateX(18px); } }
@keyframes a-pop    { from { opacity: 0; transform: scale(.82); } }
@keyframes a-grow-x { from { transform: scaleX(0); } }
@keyframes a-grow-y { from { transform: scaleY(0); } }
@keyframes a-wipe   { from { clip-path: inset(0 100% 0 0); } }
@keyframes a-draw   { from { stroke-dashoffset: 1; } }
html.reveal-print .reveal [data-a] { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .reveal [data-a] { animation: none !important; } }
/* Builds: a .fragment that also carries entrance motion waits for its click, then plays it
   (otherwise the animation would run while the fragment is still hidden and it would just pop in).
   The presenter plugin sets html.rp-builds while builds are live (a presenter window connected);
   otherwise every fragment is shown and the normal stagger applies. */
.reveal .slides section.present .fragment[data-a]:not(.visible) { animation-name: none; }
html.rp-builds .reveal .slides section.present .fragment.visible[data-a] { animation-delay: 0s; }
`.trim();
}

// ── Slide HTML renderers (one per layout) ──────────────────────────
// Every text field carries data-f="<field>" (array items as "cards.1.body"), HTML-bearing fields
// also data-html, and the section data-key: review.js edits by these, and build-deck folds the
// edits back into slides.js by the same names. Structural blocks carry data-b="<block>" with
// data-bk = block | item | media, and a slide's `tweaks` land on them as --dx / --dy / --w (see
// `b` below). Cheap, so every deck has them.
// `a(i, kind)` adds entrance motion to a block (data-a, stagger position i) when the slide
// has motion on, and nothing otherwise.
const f = (name, html = false) => ` data-f="${name}"${html ? " data-html=\"\"" : ""}`;
// Builds (PowerPoint-style click reveals) on bullets and card-row: `steps: true` makes every item
// a Reveal fragment in order; `steps: "rest"` shows the first at once and the rest on clicks. They
// play only while a presenter window is connected (presenter.js); otherwise the slide shows
// complete, with its normal stagger. On a click, a stepped item's entrance motion plays at once.
const stepped = (s, i) => s.steps === true || (s.steps === "rest" && i > 0);
const step = (s, i) => stepped(s, i) ? ` class="fragment" data-fragment-index="${s.steps === "rest" ? i - 1 : i}"` : "";
const renderers = {
  title(s, a, b) {
    return `<section class="layout-title">
  <h1${a(0)}${f("title")}>${esc(s.title)}</h1>
  ${s.subtitle ? `<p class="subtitle"${a(1)}${f("subtitle")}>${esc(s.subtitle)}</p>` : ""}
  ${s.footer ? `<div class="footer"${a(2, "fade")}${f("footer")}>${esc(s.footer)}</div>` : ""}
</section>`;
  },
  section(s, a, b) {
    return `<section class="layout-section">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h2${a(1)}${f("title")}>${esc(s.title)}</h2>
</section>`;
  },
  "two-column"(s, a, b) {
    return `<section class="layout-two-column">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <div class="columns"${b("columns", "block")}>
    <div class="col-left"${a(2, "up", "left", "block")}${f("left", true)}>${s.left || ""}</div>
    <div class="col-right"${a(3, "up", "right", "block")}${f("right", true)}>${s.right || ""}</div>
  </div>
</section>`;
  },
  "card-row"(s, a, b) {
    const cards = (s.cards || []).map((c, i) =>
      `<div class="card${stepped(s, i) ? " fragment" : ""}"${stepped(s, i) ? ` data-fragment-index="${s.steps === "rest" ? i - 1 : i}"` : ""}${a(2 + i, "up", `cards.${i}`, "item")}><h4${f(`cards.${i}.heading`)}>${esc(c.heading)}</h4><p${f(`cards.${i}.body`, true)}>${c.body || ""}</p></div>`
    ).join("\n    ");
    return `<section class="layout-card-row" style="--card-count: ${s.cards.length};">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <div class="cards"${b("cards", "block")}>
    ${cards}
  </div>
</section>`;
  },
  bigNumber(s, a, b) {
    return `<section class="layout-bignumber">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <div class="figure-row"${a(1, "pop", "figure", "block")}>
    <div class="figure"${f("figure")}>${esc(s.figure)}</div>
    ${s.unit ? `<div class="unit"${f("unit")}>${esc(s.unit)}</div>` : ""}
  </div>
  ${s.label ? `<div class="label"${a(2)}${f("label")}>${esc(s.label)}</div>` : ""}
  ${s.context ? `<div class="context"${a(3)}${f("context")}>${esc(s.context)}</div>` : ""}
</section>`;
  },
  quote(s, a, b) {
    return `<section class="layout-quote">
  <blockquote${a(0, "fade", "quote", "block")}${f("quote")}>${esc(s.quote)}</blockquote>
  ${s.attribution ? `<div class="attribution"${a(1)}${f("attribution")}>${esc(s.attribution)}</div>` : ""}
</section>`;
  },
  bullets(s, a, b) {
    const items = (s.items || []).map((item, i) => `<li${step(s, i)}${a(2 + i, "up", `items.${i}`, "item")}${f(`items.${i}`, true)}>${item}</li>`).join("\n    ");
    return `<section class="layout-bullets">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <ul${b("items", "block")}>
    ${items}
  </ul>
</section>`;
  },
  "image-caption"(s, a, b) {
    return `<section class="layout-image-caption">
  <img src="${s.src}" alt="${esc(s.alt || "")}"${a(0, "fade", "image", "media")}/>
  ${s.caption ? `<div class="caption"${a(1)}${f("caption")}>${esc(s.caption)}</div>` : ""}
</section>`;
  },
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Speaker notes → <aside class="notes" data-session/module/run>. Notes are plain text;
// newlines are encoded so the page assembly's indentation can't leak into them.
function notesHtml(slide) {
  if (slide.notes == null && slide.cue == null) return "";
  const cue = slide.cue || {};
  if ("minutes" in cue) throw new Error("cue.minutes isn't supported: pacing comes from session lengths. Set `sessions` (or `minutes` for a deck without sessions) next to `slides` in slides.js.");
  const unknown = Object.keys(cue).filter(k => !CUE_FIELDS.includes(k));
  if (unknown.length) throw new Error(`Unknown cue field(s): ${unknown.join(", ")}. Supported: ${CUE_FIELDS.join(", ")}`);
  if (cue.run != null && !CUE_RUNS.includes(cue.run)) throw new Error(`Unknown cue.run: "${cue.run}". Supported: ${CUE_RUNS.join(", ")}. To take a slide out of the deck, set hidden: true.`);
  const attrs = CUE_FIELDS.filter(k => cue[k] != null && cue[k] !== "").map(k => ` data-${k}="${esc(cue[k])}"`).join("");
  return `<aside class="notes" data-f="notes"${attrs}>${esc(slide.notes || "").replace(/\r?\n/g, "&#10;")}</aside>`;
}

// The running footer of one slide: the deck's footer text on the left, the logo (if the deck
// has one) and the page number on the right. Hidden slides get no number: Reveal drops them.
function footerHtml(chrome) {
  const parts = chrome.footer.map(t => `<span>${esc(t)}</span>`).join("");
  const page = chrome.n ? `<span class="ch-pg">${String(chrome.n).padStart(2, "0")} / ${String(chrome.total).padStart(2, "0")}</span>` : "";
  return `<div class="chrome-bot" aria-hidden="true"><span class="ch-l">${parts}</span><span class="ch-r">${chrome.logo}${page}</span></div>`;
}

// `motion` is the deck's default; a slide's own `motion` field overrides it. `chrome` is the
// running footer for this slide ({ footer, logo, n, total }) or null; the title slide never gets it.
// `key` is the slide's address for review edits: its own `key`, else "s<n>" by position in slides.js.
function slideKey(slide, index) { return slide.key || `s${index + 1}`; }
// `laneChanged` marks a slide a lane overlay changed (data-lane-changed), for the overview's lane bar.
// The layout knobs a slide may set (review mode's layout mode writes them): `ratio` "40/60" for the
// two columns, `gap` and `pad` in px, `scale` in percent of the slide width for the image. They
// become custom properties on the section that the layout CSS reads, with its own defaults.
const KNOBS = ["ratio", "gap", "pad", "scale"];
function knobStyle(slide) {
  const parts = [];
  if (slide.ratio) { const [l, r] = slide.ratio.split("/"); parts.push(`--ratio: ${l}fr ${r}fr`); }
  if (slide.gap != null) parts.push(`--gap: ${slide.gap}px`);
  if (slide.pad != null) parts.push(`--pad: ${slide.pad}px`);
  if (slide.scale != null) parts.push(`--scale: ${slide.scale}%`);
  return parts.join("; ");
}
// A block's tweak as inline custom properties: dx / dy in px, w in percent (media only).
function tweakStyle(t) {
  const parts = [];
  if (t.dx) parts.push(`--dx: ${t.dx}px`);
  if (t.dy) parts.push(`--dy: ${t.dy}px`);
  if (t.w) parts.push(`--w: ${t.w}%`);
  return parts.join("; ");
}
function renderSlide(slide, motion = false, chrome = null, key = null, laneChanged = false) {
  const fn = renderers[slide.layout];
  if (!fn) throw new Error(`Unknown layout: "${slide.layout}". Supported: ${Object.keys(renderers).join(", ")}`);
  const moving = slide.motion != null ? !!slide.motion : motion;
  const tweaks = slide.tweaks || {};
  // b(name, kind): the block's address and kind, plus its tweak. a(i, kind, name, bkind): entrance
  // motion and, when a block name is given, its address too, merged into one style attribute.
  const b = (name, bkind) => {
    const t = tweaks[name], st = t ? tweakStyle(t) : "";
    return ` data-b="${name}" data-bk="${bkind}"${t && t.w ? ' data-w=""' : ""}${st ? ` style="${st}"` : ""}`;
  };
  const a = (i, kind = "up", name = null, bkind = "block") => {
    const motionAttr = moving ? ` data-a="${kind}"` : "";
    const styles = [moving ? `--i: ${i}` : "", name && tweaks[name] ? tweakStyle(tweaks[name]) : ""].filter(Boolean).join("; ");
    const block = name ? ` data-b="${name}" data-bk="${bkind}"${tweaks[name] && tweaks[name].w ? ' data-w=""' : ""}` : "";
    return `${motionAttr}${block}${styles ? ` style="${styles}"` : ""}`;
  };
  let html = fn(slide, a, b);
  // The knobs ride on the section as custom properties, merged into any style the layout set.
  const knobs = knobStyle(slide);
  if (knobs) html = /^<section class="[^"]*" style="/.test(html) ? html.replace(/^(<section class="[^"]*" style=")/, `$1${knobs}; `) : html.replace(/^(<section class="[^"]*")/, `$1 style="${knobs}"`);
  // data-key-auto says the key is positional (the slide has no `key` of its own), which a lane overlay can't address.
  if (key) html = html.replace(/^(<section class="[^"]*")/, `$1 data-key="${esc(key)}"${slide.key ? "" : ' data-key-auto=""'}${laneChanged ? ' data-lane-changed=""' : ""}`);
  // Reveal removes hidden slides when the deck loads, so the presenter doesn't count them either.
  if (slide.hidden) html = html.replace(/^(<section class="[^"]*")/, '$1 data-visibility="hidden"');
  const tail = [chrome && slide.layout !== "title" ? footerHtml(chrome) : "", notesHtml(slide)].filter(Boolean);
  return tail.length ? html.replace(/<\/section>$/, tail.map(t => `  ${t}\n`).join("") + "</section>") : html;
}

// The brand's logo for the footer, inlined: ./assets/logo-light.svg on a light background,
// logo-dark.svg on a dark one, whichever exists. A deck-level `logo` names another SVG file;
// `logo: false` leaves the logo out. No file, no logo: a generic style ships none.
function logoSvg(cwd, deck, palette) {
  if (deck.logo === false) return "";
  const dark = luminance(palette.bg) < 0.5;
  const candidates = deck.logo ? [deck.logo] : (dark ? ["assets/logo-dark.svg", "assets/logo-light.svg"] : ["assets/logo-light.svg", "assets/logo-dark.svg"]);
  for (const rel of candidates) {
    const file = path.resolve(cwd, rel);
    if (!fs.existsSync(file)) { if (deck.logo) throw new Error(`logo: ${rel} not found`); continue; }
    if (!/\.svg$/i.test(file)) throw new Error(`logo must be an SVG file, got ${rel}`);
    const svg = fs.readFileSync(file, "utf8").replace(/<\?xml[^>]*>/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    if (!/^<svg[\s>]/i.test(svg)) throw new Error(`${rel} doesn't start with an <svg> element`);
    return { file: rel, svg: svg.replace(/^<svg/i, '<svg class="ch-logo" aria-hidden="true"') };
  }
  return "";
}
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return 1;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The tab icon: a rounded square in the style's ink, a slide in its background, an accent bar
// under it. Tells a deck tab from a knowledge-base tab, in the deck's own colours.
function faviconHref(palette) {
  const hex = (v, fallback) => (v == null ? fallback : String(v).startsWith("#") ? v : `#${v}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${hex(palette.ink, "#1A1A18")}"/>` +
    `<rect x="6" y="10" width="20" height="12" rx="1.5" fill="${hex(palette.bg, "#FFFFFF")}"/><rect x="6" y="20" width="20" height="2" fill="${hex(palette.accent, "#3B5249")}"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// ── Deck spec and pacing ───────────────────────────────────────────
// slides.js exports either an array of slides or { slides, sessions, minutes, motion, footer, logo }:
//   sessions  session label (cue.session) → length in minutes
//   minutes   length of the slides that have no cue.session (a deck without sessions)
//   motion    entrance motion on every slide (default true); a slide's own `motion` overrides it
//   footer    running footer text: a string, or an array of strings shown dot-separated; with it,
//             every slide but the title slide carries the footer, the logo and its page number
//   logo      path of the SVG for the footer (default ./assets/logo-light.svg or logo-dark.svg),
//             or false for no logo
//   lanes     paths of lane overlays (see applyLane): one build writes index.html for the base
//             deck and index-<id>.html per lane, each with a lane switcher in its overview
//   lane      the base deck's name in that switcher (default "Base")
//   review    true also writes the .review flavour of every output, with review.js inlined (see §Review edits)
//   spec      path (relative to the deck dir) of the deck's spec page: the knowledgebase page that
//             carries its volatility table and outline. Embedded as <meta name="knowledgeware-spec">
//             so the librarian finds the spec from the deck. A slide's `teaches` names the spec
//             section it teaches (ignored here; the librarian maps a stale row to its slides).
// The presenter gives every in-run slide of a session an equal share of its length.
function readDeck(spec) {
  const deck = Array.isArray(spec) ? { slides: spec } : (spec || {});
  if (!Array.isArray(deck.slides)) throw new Error("slides.js must export an array of slides, or { slides: [...], sessions: {...} }.");
  if (deck.motion != null && typeof deck.motion !== "boolean") throw new Error(`motion must be true or false, got "${deck.motion}"`);
  const footer = deck.footer == null || deck.footer === "" ? [] : Array.isArray(deck.footer) ? deck.footer : [deck.footer];
  if (!footer.every(t => typeof t === "string" && t.trim())) throw new Error("footer must be a string or an array of strings");
  if (deck.logo != null && deck.logo !== false && typeof deck.logo !== "string") throw new Error(`logo must be a file path or false, got "${deck.logo}"`);
  const lanes = deck.lanes == null ? [] : deck.lanes;
  if (!Array.isArray(lanes) || !lanes.every(p => typeof p === "string" && p.trim())) throw new Error("lanes must be an array of overlay file paths");
  if (deck.lane != null && (typeof deck.lane !== "string" || !deck.lane.trim())) throw new Error("lane must be the base deck's name, a string");
  if (deck.review != null && typeof deck.review !== "boolean") throw new Error(`review must be true or false, got "${deck.review}"`);
  if (deck.spec != null && (typeof deck.spec !== "string" || !deck.spec.trim())) throw new Error(`spec must be the path of the deck's spec page, got "${deck.spec}"`);
  for (const [i, s] of deck.slides.entries()) {
    if (s.teaches != null && (typeof s.teaches !== "string" || !s.teaches.trim())) throw new Error(`slide ${i + 1}: teaches must name a section id in the spec, got "${s.teaches}"`);
    if (s.ratio != null && !/^\d+\/\d+$/.test(String(s.ratio))) throw new Error(`slide ${i + 1}: ratio must look like "40/60", got "${s.ratio}"`);
    if (s.steps != null && s.steps !== false && s.steps !== true && s.steps !== "rest") throw new Error(`slide ${i + 1}: steps must be true, "rest" or false, got "${s.steps}"`);
    if (s.steps && !["bullets", "card-row"].includes(s.layout)) throw new Error(`slide ${i + 1}: steps works on bullets and card-row, not ${s.layout}`);
    for (const k of ["gap", "pad", "scale"]) if (s[k] != null && !(typeof s[k] === "number" && s[k] >= 0)) throw new Error(`slide ${i + 1}: ${k} must be a number, got "${s[k]}"`);
    if (s.tweaks != null) {
      if (typeof s.tweaks !== "object" || Array.isArray(s.tweaks)) throw new Error(`slide ${i + 1}: tweaks must be an object of blocks`);
      for (const [name, t] of Object.entries(s.tweaks)) {
        if (!t || typeof t !== "object") throw new Error(`slide ${i + 1}: tweaks["${name}"] must be an object`);
        for (const k of Object.keys(t)) if (!["dx", "dy", "w"].includes(k) || typeof t[k] !== "number") throw new Error(`slide ${i + 1}: tweaks["${name}"].${k} must be a number (dx, dy or w)`);
      }
    }
  }
  const keys = deck.slides.map(s => s.key).filter(k => k != null);
  if (keys.some(k => typeof k !== "string" || !k)) throw new Error("a slide's key must be a non-empty string");
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) throw new Error(`two slides have the key "${dup}"`);
  const labels = new Set(deck.slides.map(s => (s.cue && s.cue.session) || ""));
  const sessions = Object.assign(deck.minutes != null ? { "": deck.minutes } : {}, deck.sessions);
  for (const [label, minutes] of Object.entries(sessions)) {
    const name = label ? `sessions["${label}"]` : "minutes";
    if (!labels.has(label)) throw new Error(label ? `${name}: no slide has cue.session "${label}"` : "minutes: every slide has a cue.session, so set sessions instead");
    if (!(Number(minutes) > 0)) throw new Error(`${name} must be a number of minutes, got "${minutes}"`);
    sessions[label] = Number(minutes);
  }
  return { slides: deck.slides, sessions, motion: deck.motion !== false, footer: footer.map(t => t.trim()), logo: deck.logo, lanes, lane: deck.lane || "Base", review: deck.review === true, spec: deck.spec ? deck.spec.trim() : null };
}

// ── Lanes ──────────────────────────────────────────────────────────
// A lane is the same deck worked for another audience or example: one overlay file per lane,
// listed in `lanes`, applied to a copy of the slides. The overlay exports
//   { name: "Acme Investments",                       // shown in the lane switcher
//     replace: [["Acme Corp", "Acme Investments"]],   // string replacements over every text field
//     slides: { "s1-07": { right: "…", notes: "…" } },  // fields replaced whole, by the slide's `key`
//     color: "#2F7DE1" }                               // optional: the lane's colour in the overview
// The lane's id is the overlay's file name without .js, and its output is index-<id>.html.
// Replacements skip `layout`, `key`, `src`, `cue` and `motion`, so they change words, not structure.
const REPLACE_SKIP = new Set(["layout", "key", "src", "cue", "motion", "hidden", "teaches", "spec", "tweaks", "ratio", "steps"]);
function applyLane(slides, overlay, id) {
  if (!overlay || typeof overlay !== "object") throw new Error(`lane ${id}: the overlay must export an object`);
  const out = structuredClone(slides);
  const byKey = new Map(out.filter(s => s.key).map(s => [s.key, s]));
  for (const [key, fields] of Object.entries(overlay.slides || {})) {
    const slide = byKey.get(key);
    if (!slide) throw new Error(`lane ${id}: no slide has key "${key}"`);
    if (!fields || typeof fields !== "object") throw new Error(`lane ${id}: slides["${key}"] must be an object of fields`);
    Object.assign(slide, structuredClone(fields));
  }
  const reps = overlay.replace || [];
  if (!Array.isArray(reps) || !reps.every(r => Array.isArray(r) && r.length === 2 && r.every(x => typeof x === "string") && r[0])) {
    throw new Error(`lane ${id}: replace must be an array of [from, to] string pairs`);
  }
  const walk = (v) => typeof v === "string" ? reps.reduce((t, [a, b]) => t.split(a).join(b), v)
    : Array.isArray(v) ? v.map(walk)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, REPLACE_SKIP.has(k) ? x : walk(x)]))
    : v;
  return reps.length ? out.map(walk) : out;
}
function laneId(file) { return path.basename(file).replace(/\.js$/i, ""); }
// Each lane's colour in the overview (its switcher and the bar under the slides it changes); the
// base deck is drawn in ink. An overlay's `color` wins; otherwise lanes take these in turn.
const LANE_COLORS = ["#2F7DE1", "#1FA26A", "#E0892B", "#9B5DE5", "#E2487E", "#17A2B8"];
// Which slides of a lane differ from the base deck, by key (the overlay's fields or its replacements).
function laneChangedKeys(base, laneSlides) {
  const keys = new Set();
  laneSlides.forEach((s, i) => { if (JSON.stringify(s) !== JSON.stringify(base[i])) keys.add(slideKey(s, i)); });
  return keys;
}

// ── Reveal, inlined ────────────────────────────────────────────────
// Read from the deck dir's node_modules (npm install), so the page needs no CDN. The
// installed version must match the pin, or a stale install would slip in unnoticed.
function revealAssets(fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const pkg = path.join(dir, "node_modules", "reveal.js");
    if (fs.existsSync(path.join(pkg, "package.json"))) {
      const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version;
      if (version !== REVEAL_VERSION) throw new Error(`reveal.js ${version} is installed, but this builder is pinned to ${REVEAL_VERSION}. Run: npm install reveal.js@${REVEAL_VERSION}`);
      return {
        css: fs.readFileSync(path.join(pkg, "dist", "reveal.css"), "utf8"),
        js: fs.readFileSync(path.join(pkg, "dist", "reveal.js"), "utf8"),
      };
    }
    if (path.dirname(dir) === dir) throw new Error(`reveal.js isn't installed. Run npm install in the deck dir (package.json pins reveal.js ${REVEAL_VERSION}).`);
  }
}
// A module read fresh from disk. require's cache is keyed by real path, so a deck dir given
// through a symlink (macOS /tmp) would otherwise serve the module read before a fold rewrote it.
function loadFresh(file) {
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  return require(resolved);
}
// Keep inlined code from closing its own tag early.
const inlineScript = (js) => js.replace(/<\/script/gi, "<\\/script");
const inlineStyle = (css) => css.replace(/<\/style/gi, "<\\/style");

// Printed after every build, so whoever edits the deck (often Claude) sees the timing plan
// and which slides are hidden without opening the presenter.
function pacingSummary(slides, sessions) {
  const groups = new Map();
  for (const s of slides) {
    const cue = s.cue || {}, label = cue.session || "";
    if (!groups.has(label)) groups.set(label, { run: 0, extra: 0 });
    if (s.hidden) continue;
    if (cue.run === "add-back" || cue.run === "backup") groups.get(label).extra++;
    else groups.get(label).run++;
  }
  const lines = [];
  if (Object.keys(sessions).length || slides.some(s => s.cue)) {
    lines.push("Pacing (each slide in the run gets an equal share of its session):");
    for (const [label, g] of groups) {
      const len = sessions[label];
      const share = len && g.run ? `${minSec(len / g.run)} per slide` : "no length set, so no pace plan";
      lines.push(`  ${label || "Deck"}: ${len ? `${len} min, ` : ""}${g.run} slide${g.run === 1 ? "" : "s"} in the run${g.extra ? `, ${g.extra} add-back/backup` : ""} → ${share}`);
    }
  }
  const hidden = slides.flatMap((s, i) => (s.hidden ? [`#${i + 1} ${s.title || s.figure || s.layout}`] : []));
  if (hidden.length) lines.push(`Hidden (not shown, not counted): ${hidden.join(" · ")}`);
  return lines.join("\n");
}
function minSec(minutes) {
  const s = Math.round(minutes * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── HTML page assembly ─────────────────────────────────────────────
function pageHtml({ title, fontsUrl, css, slidesHtml, reveal, presenterJs, sessions = {}, favicon = "", footer = false, lanes = [], reviewJs = "", review = null, spec = null }) {
  const presenterConfig = { sessions, ...(lanes.length > 1 ? { lanes } : {}) };
  const plugins = ["RevealPresenter", ...(reviewJs ? ["RevealReview"] : [])];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  ${favicon ? `<link rel="icon" href="${favicon.replace(/"/g, "%22")}"/>` : ""}
  ${spec ? `<meta name="knowledgeware-spec" content="${esc(spec)}"/>` : ""}
  ${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontsUrl}" rel="stylesheet"/>` : ""}
  <style>
${inlineStyle(reveal.css)}
  </style>
  <style>
${css}
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml.split("\n").map(l => "      " + l).join("\n")}
    </div>
  </div>
  <script>
${inlineScript(reveal.js)}
  </script>
  ${presenterJs ? `<script>\n${inlineScript(presenterJs)}\n  </script>` : ""}
  ${reviewJs ? `<script>\n${inlineScript(reviewJs)}\n  </script>` : ""}
  <script>
    Reveal.initialize({
      width: ${SLIDE_W_PX},
      height: ${SLIDE_H_PX},
      hash: true,
      display: 'flex',
      controls: false,   // the presenter plugin's navigation pill replaces Reveal's arrows
      progress: true,
      slideNumber: ${footer ? "false" : "'c/t'"},${footer ? "   // the running footer carries the page number" : ""}
      transition: 'fade',${presenterJs ? `
      plugins: [${plugins.join(", ")}],
      presenter: ${JSON.stringify(presenterConfig).replace(/</g, "\\u003c")},` : ""}${reviewJs ? `
      review: ${JSON.stringify(review).replace(/</g, "\\u003c")},` : ""}
    });
  </script>
</body>
</html>
`;
}

// ── Review edits ───────────────────────────────────────────────────
// review.js (E in a deck built with `review: true`) saves text and notes edits as ./edits.json:
//   { built: "<ISO time of the build the edits were made on>", lane: null | "<lane id>", file: "index.html",
//     keys: ["cover", "s2", …],                       // every slide's key in the built order
//     slides: { "<key>": { title: { from: "old", to: "new" }, "cards.1.body": { from, to }, notes: { from, to },
//                          comment: "a note for whoever edits the deck next" } },
//     deck: { hidden: { "<key>": true | false }, deleted: ["<key>"], order: ["<key>", …] } }
// A slide entry may also carry layout edits from review mode's layout mode:
//     knobs: { ratio: { from: null | "50/50", to: "40/60" }, gap: { from, to }, … }   // to: null removes the field
//     tweaks: { from: null | {…}, to: { "cards.1": { dx: 12, dy: -8 } } }            // the whole object; to: null removes it
//     arrays: { cards: [0, 2] }                                                      // kept original indices, in the new order
// They fold into the slide's object literal (set or insert the field, replace `tweaks`, rewrite the
// array's items), text edits on the same slide first; in a lane, knobs and tweaks go to the overlay
// by the slide's own key and array edits are layered.
// Keys are the slides' own `key`s, else "s<n>" by position in slides.js. Before every build the
// edits are folded into the source: each `from` is looked up as a string literal in slides.js (or
// in the lane's overlay when the edits were made in a lane) and rewritten to `to`, with the same
// quote style and the file's comments and layout untouched. A `from` the file doesn't hold exactly
// once can't be placed, so it stays in edits.json and is layered over this build instead; comments
// stay too, for whoever iterates on the deck (often Claude). edits.json is deleted when nothing is left.
// `deck` holds the overview's structural edits: `hidden` sets or clears a slide's `hidden` field
// (in the lane's overlay when made in a lane), `deleted` removes slide objects from slides.js (in a
// lane it hides them there instead), and `order` rearranges them, comments riding along with each.
// They need slides.js's list to be plain object literals in the order `keys` records; otherwise
// they're layered and reported.
const EDITS_FILE = "edits.json";

// String literals of a JS source with their spans, skipping comments. Template literals with
// substitutions are skipped: they aren't constants. Good enough for slides.js, which is data.
function stringLiterals(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const start = i++;
      let value = "", constant = true;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") { i += 2; continue; }
        if (c === "`" && src[i] === "$" && src[i + 1] === "{") constant = false;
        if (c !== "`" && src[i] === "\n") break;   // unterminated; let it be
        i++;
      }
      const end = i + 1;
      if (constant && src[i] === c) {
        try { value = new Function(`return ${src.slice(start, end)}`)(); } catch (e) { value = null; }
        if (typeof value === "string") out.push({ start, end, quote: c, value });
      }
      i = end;
      continue;
    }
    i++;
  }
  return out;
}
function literal(text, quote) {
  if (quote === "`") return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
  const json = JSON.stringify(text);
  return quote === '"' ? json : "'" + json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";
}
// Light HTML as the browser gives it back (innerHTML) vs as the source wrote it: self-closing
// tags, attribute quotes, entities and whitespace runs may differ without a word changing.
function looseHtml(t) {
  return String(t).replace(/\s*\/>/g, ">").replace(/\s+/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let o = obj;
  for (const k of parts.slice(0, -1)) { if (o == null || typeof o !== "object") return false; o = o[k]; }
  if (o == null || typeof o !== "object") return false;
  o[parts[parts.length - 1]] = value;
  return true;
}
function readEdits(cwd) {
  const file = path.join(cwd, EDITS_FILE);
  if (!fs.existsSync(file)) return null;
  let edits;
  try { edits = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { throw new Error(`${EDITS_FILE} isn't valid JSON: ${e.message}`); }
  if (!edits || typeof edits !== "object" || !edits.slides || typeof edits.slides !== "object") throw new Error(`${EDITS_FILE} must hold { slides: { <key>: { <field>: { from, to } } } }`);
  return { file, edits };
}
// Rewrite one source file's literals. Returns the fields it couldn't place, with the reason.
function foldInto(file, entries) {
  const original = fs.readFileSync(file, "utf8");
  const lits = stringLiterals(original);
  const left = [], applied = [];
  for (const { key, field, from, to } of entries) {
    let hits = lits.filter(l => l.value === from);
    if (hits.length !== 1) { const loose = looseHtml(from); hits = lits.filter(l => looseHtml(l.value) === loose); }
    if (hits.length === 0) { left.push({ key, field, from, to, reason: `text not found in ${path.basename(file)}` }); continue; }
    if (hits.length > 1) { left.push({ key, field, from, to, reason: `text appears ${hits.length} times in ${path.basename(file)}` }); continue; }
    if (applied.some(a => a.start === hits[0].start)) { left.push({ key, field, from, to, reason: "two edits land on the same text" }); continue; }
    applied.push({ ...hits[0], to, key, field });
  }
  if (applied.length) {
    let src = original;
    for (const a of applied.sort((x, y) => y.start - x.start)) src = src.slice(0, a.start) + literal(a.to, a.quote) + src.slice(a.end);
    fs.writeFileSync(file, src);
    try { loadFresh(file); } catch (e) {
      fs.writeFileSync(file, original);
      throw new Error(`folding ${EDITS_FILE} into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold the edits by hand.`);
    }
  }
  return { applied, left };
}
// ── Structural fold: slide objects in slides.js, overlay entries in a lane file ──
// The top-level items of the array or object whose bracket opens at `open`: each item's span
// (first to last significant character), the lead before it (whitespace and comments after
// the previous comma) and whether a comma follows. Strings and comments are skipped.
function splitTopLevel(src, open) {
  const close = { "[": "]", "{": "}" }[src[open]];
  if (!close) throw new Error("splitTopLevel: not a bracket");
  const items = [];
  let depth = 0, i = open + 1, itemStart = -1, lastSig = -1, leadStart = open + 1;
  const sig = (k) => { if (itemStart < 0) itemStart = k; lastSig = k; };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      sig(i); i++;
      while (i < src.length && src[i] !== c) { if (src[i] === "\\") i++; i++; }
      sig(i); i++; continue;
    }
    if (depth === 0 && (c === close)) break;
    if (depth === 0 && c === ",") {
      if (itemStart >= 0) items.push({ start: itemStart, end: lastSig + 1, leadStart, comma: i });
      itemStart = -1; leadStart = i + 1; i++; continue;
    }
    if ("[{(".includes(c)) depth++;
    else if ("]})".includes(c)) depth--;
    if (!/\s/.test(c)) sig(i);
    i++;
  }
  if (i >= src.length) throw new Error("splitTopLevel: unbalanced brackets");
  if (itemStart >= 0) items.push({ start: itemStart, end: lastSig + 1, leadStart, comma: -1 });
  return { close: i, items };
}
// The index of the matching bracket for the one at `open` (strings and comments skipped).
function matchBracket(src, open) { return splitTopLevel(src, open).close; }
function isIdent(s) { return /^[A-Za-z_$][\w$]*$/.test(s); }
function entryKey(src, item) {   // "key:" or "'key':" at the start of an object entry, else null
  const m = src.slice(item.start, item.end).match(/^([A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*:/);
  if (!m) return null;
  const k = m[1];
  return k[0] === '"' || k[0] === "'" ? new Function(`return ${k}`)() : k;
}
// The export's object (`module.exports = {`) or array (`module.exports = [`): the bracket index.
function exportBracket(src) {
  const lits = stringLiterals(src);
  const inLit = (k) => lits.some(l => k >= l.start && k < l.end);
  const re = /module\.exports\s*=\s*([\[{])/g;
  let m;
  while ((m = re.exec(src))) if (!inLit(m.index)) return m.index + m[0].length - 1;
  throw new Error("no `module.exports = {` or `= [` found");
}
// The slides array of slides.js: its bracket index, or -1 when the file exports no plain list.
function slidesArray(src) {
  const open = exportBracket(src);
  if (src[open] === "[") return open;
  const { items } = splitTopLevel(src, open);
  const it = items.find(x => entryKey(src, x) === "slides");
  if (!it) return -1;
  const b = src.indexOf("[", it.start);
  return b > 0 && b < it.end && /^slides\s*:\s*\[/.test(src.slice(it.start, b + 1)) ? b : -1;
}
// Set, clear or replace `hidden` in the object literal at `open`. Returns the new source.
function setHiddenIn(src, open, value) {   // value: true | false | null (remove)
  const { items } = splitTopLevel(src, open);
  const at = items.findIndex(x => entryKey(src, x) === "hidden"), it = items[at];
  if (it) {
    if (value === null) {   // drop the entry with its own comma, or with the comma before it when it's last
      const prev = items[at - 1];
      const from = it.comma >= 0 || !prev ? it.leadStart : prev.comma, to = it.comma >= 0 ? it.comma + 1 : it.end;
      return src.slice(0, from) + src.slice(to);
    }
    return src.slice(0, it.start) + `hidden: ${value}` + src.slice(it.end);
  }
  if (value === null) return src;
  return src.slice(0, open + 1) + ` hidden: ${value},` + src.slice(open + 1);
}
// Fold the structural edits into slides.js: reorder and remove slide objects, set `hidden`.
function foldDeckInto(file, keys, ops) {
  const original = fs.readFileSync(file, "utf8");
  const open = slidesArray(original);
  if (open < 0) throw new Error("slides.js doesn't export a plain `slides: [ … ]` list");
  const { close, items } = splitTopLevel(original, open);
  if (items.length !== keys.length) throw new Error(`slides.js lists ${items.length} slides, the edits were made on ${keys.length}`);
  for (const it of items) {
    if (original[it.start] !== "{" || matchBracket(original, it.start) !== it.end - 1) throw new Error("a slide in slides.js isn't a plain object literal");
  }
  // Each slide's text, with its lead (comments above it travel with it) and `hidden` applied.
  const texts = new Map();
  keys.forEach((key, i) => {
    const it = items[i];
    let text = original.slice(it.start, it.end);
    if (key in ops.hidden) text = setHiddenIn(text, 0, ops.hidden[key] ? true : null);
    texts.set(key, { lead: original.slice(it.leadStart, it.start), text });
  });
  const order = (ops.order || keys).filter(k => !ops.deleted.includes(k));
  const last = items[items.length - 1];
  const tail = original.slice(last.comma >= 0 ? last.comma + 1 : last.end, close);
  const body = order.map(k => texts.get(k).lead + texts.get(k).text + ",").join("");
  const src = original.slice(0, open + 1) + body + (tail.trim() ? tail : tail || "\n") + original.slice(close);
  fs.writeFileSync(file, src);
  // Auto keys are positional, so they shift with the order: `want` is each kept slide's key after
  // the fold (its own `key` if it has one, else its new position), and the returned map says
  // which old key became which, for whatever still refers to the old ones.
  const ownKey = (text) => splitTopLevel(text, 0).items.some(it => entryKey(text, it) === "key");
  const want = order.map((k, i) => ownKey(texts.get(k).text) ? k : `s${i + 1}`);
  try {
    const deck = readDeck(loadFresh(file));
    const got = deck.slides.map((s, i) => slideKey(s, i));
    if (got.join("\n") !== want.join("\n")) throw new Error("the folded list doesn't match the edits");
    for (const [k, h] of Object.entries(ops.hidden)) {
      const at = order.indexOf(k);
      if (at >= 0 && !!deck.slides[at].hidden !== !!h) throw new Error(`hidden didn't take on ${k}`);
    }
  } catch (e) {
    fs.writeFileSync(file, original);
    throw new Error(`folding the slide list into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold it by hand.`);
  }
  return new Map(order.map((k, i) => [k, want[i]]));
}
// Fold a lane's `hidden` edits into its overlay: slides: { <key>: { hidden: <bool> } }.
function foldLaneHidden(file, hidden) {
  const original = fs.readFileSync(file, "utf8");
  let src = original;
  for (const [key, value] of Object.entries(hidden)) {
    const open = exportBracket(src);
    if (src[open] !== "{") throw new Error("the overlay must export an object");
    let { items } = splitTopLevel(src, open);
    let slidesIt = items.find(x => entryKey(src, x) === "slides");
    if (!slidesIt) {
      src = src.slice(0, open + 1) + "\n  slides: {},".replace(/^\n/, src[open + 1] === "\n" ? "\n" : " ") + src.slice(open + 1);
      items = splitTopLevel(src, open).items;
      slidesIt = items.find(x => entryKey(src, x) === "slides");
    }
    const sOpen = src.indexOf("{", slidesIt.start);
    if (sOpen < 0 || sOpen > slidesIt.end) throw new Error("the overlay's `slides` isn't an object");
    const entries = splitTopLevel(src, sOpen).items;
    const it = entries.find(x => entryKey(src, x) === key);
    if (it) {
      const oOpen = src.indexOf("{", it.start);
      if (oOpen < 0 || oOpen > it.end) throw new Error(`the overlay's slides["${key}"] isn't an object`);
      src = setHiddenIn(src, oOpen, value);
    } else {
      const k = isIdent(key) ? key : JSON.stringify(key);
      src = src.slice(0, sOpen + 1) + ` ${k}: { hidden: ${value} },` + src.slice(sOpen + 1);
    }
  }
  fs.writeFileSync(file, src);
  try {
    const o = loadFresh(file);
    for (const [key, value] of Object.entries(hidden)) if (!o.slides || !o.slides[key] || o.slides[key].hidden !== value) throw new Error(`hidden didn't take on ${key}`);
  } catch (e) {
    fs.writeFileSync(file, original);
    throw new Error(`folding hidden slides into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold it by hand.`);
  }
}
// Set, replace or (literal undefined) remove a top-level entry of the object literal at `open`.
function setEntryIn(src, open, name, literalText) {
  const { items } = splitTopLevel(src, open);
  const at = items.findIndex(x => entryKey(src, x) === name), it = items[at];
  if (it) {
    if (literalText === undefined) {
      const prev = items[at - 1];
      const from = it.comma >= 0 || !prev ? it.leadStart : prev.comma, to = it.comma >= 0 ? it.comma + 1 : it.end;
      return src.slice(0, from) + src.slice(to);
    }
    const colon = src.indexOf(":", it.start);
    return src.slice(0, colon + 1) + " " + literalText + src.slice(it.end);
  }
  if (literalText === undefined) return src;
  const key = isIdent(name) ? name : JSON.stringify(name);
  const last = items[items.length - 1];   // a new entry goes last, so key and layout stay first
  if (!last) return src.slice(0, open + 1) + ` ${key}: ${literalText} ` + src.slice(open + 1);
  return src.slice(0, last.end) + `, ${key}: ${literalText}` + src.slice(last.end);
}
// Rewrite the array entry `name` of the object literal at `open` to hold the items at `kept`
// (original indices, in the new order), each with the comments above it.
function keepArrayItems(src, open, name, kept) {
  const { items } = splitTopLevel(src, open);
  const it = items.find(x => entryKey(src, x) === name);
  if (!it) throw new Error(`the slide has no ${name}`);
  const aOpen = src.indexOf("[", it.start);
  if (aOpen < 0 || aOpen > it.end) throw new Error(`${name} isn't an array literal`);
  const { close, items: els } = splitTopLevel(src, aOpen);
  if (!Array.isArray(kept) || kept.some(i => !(Number.isInteger(i) && i >= 0 && i < els.length))) throw new Error(`${name}: an index is out of range`);
  const last = els[els.length - 1];
  const tail = last ? src.slice(last.comma >= 0 ? last.comma + 1 : last.end, close) : src.slice(aOpen + 1, close);
  // An item keeps the comment above it; the whitespace that frames it comes from the position it
  // lands in (never that position's old comment), so the list's layout holds.
  const lead = (el) => src.slice(el.leadStart, el.start);
  const frame = (el) => { const l = lead(el); return l.includes("\n") ? l.slice(0, l.indexOf("\n") + 1).replace(/[^\n]/g, "") + l.slice(l.lastIndexOf("\n") + 1) : l.replace(/\/\*.*?\*\//g, ""); };
  const body = kept.map((i, pos) => { const own = lead(els[i]); return (own.trim() ? own : frame(els[Math.min(pos, els.length - 1)])) + src.slice(els[i].start, els[i].end) + ","; }).join("");
  return src.slice(0, aOpen + 1) + body + tail + src.slice(close);
}
// The slide objects of slides.js's list, in order, or null when the list isn't plain object literals.
function slideItems(src, count) {
  const open = slidesArray(src);
  if (open < 0) return null;
  const { items } = splitTopLevel(src, open);
  if (items.length !== count) return null;
  for (const it of items) if (src[it.start] !== "{" || matchBracket(src, it.start) !== it.end - 1) return null;
  return items;
}
// Fold layout edits into slides.js: per slide (by key position), knobs set or removed, `tweaks`
// replaced whole, arrays rewritten to their kept items. Verified by re-reading the file.
function foldSlideFields(file, keys, perSlide) {
  const original = fs.readFileSync(file, "utf8");
  const items = slideItems(original, keys.length);
  if (!items) throw new Error("slides.js doesn't export a plain list of slide objects");
  const work = Object.entries(perSlide).map(([key, ops]) => ({ idx: keys.indexOf(key), key, ops })).filter(w => w.idx >= 0).sort((x, y) => y.idx - x.idx);
  let src = original;
  for (const { idx, ops } of work) {   // from the last slide back, so earlier offsets stay valid
    const it = items[idx];
    let text = original.slice(it.start, it.end);
    for (const [name, kept] of Object.entries(ops.arrays || {})) text = keepArrayItems(text, 0, name, kept);
    if (ops.tweaks) text = setEntryIn(text, 0, "tweaks", ops.tweaks.to && Object.keys(ops.tweaks.to).length ? JSON.stringify(ops.tweaks.to) : undefined);
    for (const [name, v] of Object.entries(ops.knobs || {})) text = setEntryIn(text, 0, name, v.to == null ? undefined : JSON.stringify(v.to));
    src = src.slice(0, it.start) + text + src.slice(it.end);
  }
  fs.writeFileSync(file, src);
  try {
    const deck = readDeck(loadFresh(file));
    for (const { idx, key, ops } of work) {
      const sl = deck.slides[idx];
      for (const [name, v] of Object.entries(ops.knobs || {})) if (!(v.to == null ? sl[name] == null : sl[name] === v.to)) throw new Error(`${name} didn't take on ${key}`);
      if (ops.tweaks && JSON.stringify(sl.tweaks || null) !== JSON.stringify(ops.tweaks.to && Object.keys(ops.tweaks.to).length ? ops.tweaks.to : null)) throw new Error(`tweaks didn't take on ${key}`);
      for (const [name, kept] of Object.entries(ops.arrays || {})) if (!Array.isArray(sl[name]) || sl[name].length !== kept.length) throw new Error(`${name} didn't take on ${key}`);
    }
  } catch (e) {
    fs.writeFileSync(file, original);
    throw new Error(`folding the layout edits into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold them by hand.`);
  }
}
// Fold entries into a lane's overlay: slides: { <key>: { <name>: <literal> } } (a literal of
// undefined removes the entry). Verified by re-reading the file.
function foldLaneEntries(file, perKey) {
  const original = fs.readFileSync(file, "utf8");
  let src = original;
  for (const [key, entries] of Object.entries(perKey)) {
    for (const [name, literalText] of Object.entries(entries)) {
      const open = exportBracket(src);
      if (src[open] !== "{") throw new Error("the overlay must export an object");
      let { items } = splitTopLevel(src, open);
      let slidesIt = items.find(x => entryKey(src, x) === "slides");
      if (!slidesIt) {
        src = setEntryIn(src, open, "slides", "{}");
        items = splitTopLevel(src, open).items;
        slidesIt = items.find(x => entryKey(src, x) === "slides");
      }
      const sOpen = src.indexOf("{", slidesIt.start);
      if (sOpen < 0 || sOpen > slidesIt.end) throw new Error("the overlay's `slides` isn't an object");
      const it = splitTopLevel(src, sOpen).items.find(x => entryKey(src, x) === key);
      if (it) {
        const oOpen = src.indexOf("{", it.start);
        if (oOpen < 0 || oOpen > it.end) throw new Error(`the overlay's slides["${key}"] isn't an object`);
        src = setEntryIn(src, oOpen, name, literalText);
      } else if (literalText !== undefined) {
        src = setEntryIn(src, sOpen, key, `{ ${isIdent(name) ? name : JSON.stringify(name)}: ${literalText} }`);
      }
    }
  }
  fs.writeFileSync(file, src);
  try {
    const o = loadFresh(file);
    for (const [key, entries] of Object.entries(perKey)) for (const [name, literalText] of Object.entries(entries)) {
      const got = o.slides && o.slides[key] ? o.slides[key][name] : undefined;
      const want = literalText === undefined ? undefined : new Function(`return ${literalText}`)();
      if (JSON.stringify(got === undefined ? null : got) !== JSON.stringify(want === undefined ? null : want)) throw new Error(`${name} didn't take on ${key}`);
    }
  } catch (e) {
    fs.writeFileSync(file, original);
    throw new Error(`folding into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold it by hand.`);
  }
}

// The deck ops of edits.json, checked. Returns { hidden: {key: bool}, deleted: [key], order: [key] | null }.
function readDeckOps(edits) {
  const d = edits.deck;
  if (d == null) return null;
  if (typeof d !== "object") throw new Error(`${EDITS_FILE}: deck must be an object`);
  const ops = { hidden: {}, deleted: [], order: null };
  for (const [k, v] of Object.entries(d.hidden || {})) { if (typeof v !== "boolean") throw new Error(`${EDITS_FILE}: deck.hidden.${k} must be true or false`); ops.hidden[k] = v; }
  if (d.deleted != null) { if (!Array.isArray(d.deleted) || !d.deleted.every(k => typeof k === "string")) throw new Error(`${EDITS_FILE}: deck.deleted must be a list of keys`); ops.deleted = d.deleted; }
  if (d.order != null) { if (!Array.isArray(d.order) || !d.order.every(k => typeof k === "string")) throw new Error(`${EDITS_FILE}: deck.order must be a list of keys`); ops.order = d.order; }
  return Object.keys(ops.hidden).length || ops.deleted.length || ops.order ? ops : null;
}

// Fold ./edits.json into slides.js or the lane's overlay. Returns what to layer over this build:
// { lane, fields: [{ key, field, to }] }, plus the comments, or null when there was no file.
function foldEdits(cwd, deckLanes) {
  const found = readEdits(cwd);
  if (!found) return null;
  const { file, edits } = found;
  const laneFile = edits.lane ? deckLanes.find(l => laneId(l) === edits.lane) : null;
  if (edits.lane && !laneFile) throw new Error(`${EDITS_FILE} was saved in lane "${edits.lane}", which slides.js no longer lists`);
  const target = edits.lane ? path.resolve(cwd, laneFile) : path.join(cwd, "slides.js");
  const entries = [], perSlide = {};   // perSlide: layout edits by key
  let comments = [];
  for (const [key, fields] of Object.entries(edits.slides)) {
    if (!fields || typeof fields !== "object") continue;
    for (const [field, v] of Object.entries(fields)) {
      if (field === "comment") { if (typeof v === "string" && v.trim()) comments.push({ key, comment: v.trim() }); continue; }
      if (field === "knobs" || field === "tweaks" || field === "arrays") {
        if (!v || typeof v !== "object") throw new Error(`${EDITS_FILE}: ${key}.${field} must be an object`);
        if (field === "knobs") for (const [n, kv] of Object.entries(v)) { if (!KNOBS.includes(n)) throw new Error(`${EDITS_FILE}: ${key}.knobs.${n} isn't a knob (${KNOBS.join(", ")})`); if (!kv || typeof kv !== "object" || !("to" in kv)) throw new Error(`${EDITS_FILE}: ${key}.knobs.${n} must be { from, to }`); }
        if (field === "tweaks" && !("to" in v)) throw new Error(`${EDITS_FILE}: ${key}.tweaks must be { from, to }`);
        if (field === "arrays") for (const [n, arr] of Object.entries(v)) if (!Array.isArray(arr) || !arr.every(Number.isInteger)) throw new Error(`${EDITS_FILE}: ${key}.arrays.${n} must be a list of kept indices`);
        (perSlide[key] = perSlide[key] || {})[field] = v;
        continue;
      }
      if (!v || typeof v.from !== "string" || typeof v.to !== "string") throw new Error(`${EDITS_FILE}: ${key}.${field} must be { from, to }`);
      if (v.from !== v.to) entries.push({ key, field, from: v.from, to: v.to });
    }
  }
  let { applied, left } = entries.length ? foldInto(target, entries) : { applied: [], left: [] };
  const rel = path.relative(process.cwd(), target) || path.basename(target);
  if (applied.length) console.log(`Folded ${applied.length} edit${applied.length === 1 ? "" : "s"} from ${EDITS_FILE} into ${rel} (${new Set(applied.map(a => a.key)).size} slide${new Set(applied.map(a => a.key)).size === 1 ? "" : "s"}).`);
  for (const l of left) console.log(`  kept in ${EDITS_FILE}: ${l.key}.${l.field} (${l.reason}); layered over this build. Fold it by hand.`);
  for (const c of comments) console.log(`  comment on ${c.key}: ${c.comment}`);

  const slidesPath = path.join(cwd, "slides.js");
  const current = readDeck(loadFresh(slidesPath)).slides.map((s, i) => slideKey(s, i));
  const keys = Array.isArray(edits.keys) ? edits.keys : null;
  const listMatches = keys && keys.join("\n") === current.join("\n");

  // Layout edits: knobs, tweaks and array items, into the slide objects (or a lane's overlay).
  let layoutLeft = {};
  if (Object.keys(perSlide).length) {
    const describe = (ps) => { let k = 0, t = 0, a = 0; for (const o of Object.values(ps)) { k += Object.keys(o.knobs || {}).length; t += o.tweaks ? 1 : 0; a += Object.keys(o.arrays || {}).length; } return `${k} knob${k === 1 ? "" : "s"}, ${t} tweak set${t === 1 ? "" : "s"}, ${a} array edit${a === 1 ? "" : "s"}`; };
    const keepLayout = (ps, reason) => { Object.assign(layoutLeft, ps); console.log(`  kept in ${EDITS_FILE}: the layout edits of ${Object.keys(ps).join(", ")} (${reason}); layered over this build. Fold them by hand.`); };
    if (!listMatches) keepLayout(perSlide, keys ? "slides.js's slide list changed since the edits were made" : "the file doesn't record the built slide order");
    else if (!edits.lane) {
      try { foldSlideFields(slidesPath, keys, perSlide); console.log(`Folded the layout edits into slides.js (${describe(perSlide)}).`); }
      catch (e) { keepLayout(perSlide, e.message); }
    } else {
      // In a lane: knobs and tweaks go to the overlay under the slide's own key; array edits can't
      // partially replace an inherited array, so they're layered.
      const laneEntries = {}, kept = {};
      for (const [key, o] of Object.entries(perSlide)) {
        const own = !(/^s\d+$/.test(key) && !deckLanesKeyed(cwd, key));
        if (own && (o.knobs || o.tweaks)) {
          const e = {};
          for (const [n, v] of Object.entries(o.knobs || {})) e[n] = v.to == null ? undefined : JSON.stringify(v.to);
          if (o.tweaks) e.tweaks = o.tweaks.to && Object.keys(o.tweaks.to).length ? JSON.stringify(o.tweaks.to) : undefined;
          laneEntries[key] = e;
        }
        const rest = { ...(own ? {} : { knobs: o.knobs, tweaks: o.tweaks }), ...(o.arrays ? { arrays: o.arrays } : {}) };
        for (const k of Object.keys(rest)) if (rest[k] == null) delete rest[k];
        if (Object.keys(rest).length) kept[key] = rest;
      }
      if (Object.keys(laneEntries).length) {
        try { foldLaneEntries(target, laneEntries); console.log(`Folded knobs and tweaks for ${Object.keys(laneEntries).join(", ")} into ${rel}.`); }
        catch (e) { for (const [key, o] of Object.entries(perSlide)) if (laneEntries[key]) kept[key] = { ...(kept[key] || {}), ...(o.knobs ? { knobs: o.knobs } : {}), ...(o.tweaks ? { tweaks: o.tweaks } : {}) }; console.log(`  kept in ${EDITS_FILE}: the lane's knobs and tweaks (${e.message}); layered over this build.`); }
      }
      if (Object.keys(kept).length) keepLayout(kept, "array edits and unkeyed slides can't be folded into a lane overlay");
    }
    // A text edit on an item of an array that was just rewritten points at an old index: drop it.
    left = left.filter(l => {
      const o = perSlide[l.key];
      const changed = o && o.arrays && !layoutLeft[l.key] && Object.keys(o.arrays).some(n => l.field.startsWith(n + "."));
      if (changed) console.log(`  dropped ${l.field} on ${l.key}: its list was rewritten; edit the text again on the new build.`);
      return !changed;
    });
  }

  // Structural edits: the slide list in slides.js, `hidden` in a lane's overlay.
  const ops = readDeckOps(edits);
  let deckLeft = null, remap = null;   // remap: old key → new key, once the slide list was reordered
  if (ops) {
    const keep = (reason, layerOrder = true) => { deckLeft = { ...ops, reason, layerOrder }; console.log(`  kept in ${EDITS_FILE}: the hidden / deleted / order edits (${reason}); layered over this build. Fold them by hand.`); };
    const n = (o) => `${Object.keys(o.hidden).length} hidden or shown, ${o.deleted.length} deleted${o.order ? ", reordered" : ""}`;
    const permutation = (order, of) => order.length === of.length && new Set(order).size === of.length && order.every(k => of.includes(k));
    if (!keys) keep("the file doesn't record the built slide order");
    else if (!listMatches) keep("slides.js's slide list changed since the edits were made");
    else if (ops.order && !permutation(ops.order, keys)) keep("the order doesn't list every slide exactly once", false);   // kept for the record, but an order like that can't be layered either
    else if (!edits.lane) {
      try { remap = foldDeckInto(slidesPath, keys, ops); console.log(`Folded the slide list into slides.js (${n(ops)}).`); }
      catch (e) { keep(e.message); }
    } else {
      // In a lane: hidden (and deleted, which means hidden there) go to the overlay by key; the
      // order is the base deck's and shared by every lane, so it goes to slides.js.
      const laneHidden = { ...ops.hidden };
      for (const k of ops.deleted) laneHidden[k] = true;
      const unkeyed = Object.keys(laneHidden).filter(k => /^s\d+$/.test(k) && !deckLanesKeyed(cwd, k));
      const keyed = Object.fromEntries(Object.entries(laneHidden).filter(([k]) => !unkeyed.includes(k)));
      const laneOps = { hidden: {}, deleted: [], order: null };
      let hiddenDone = !Object.keys(keyed).length;
      try {
        if (!hiddenDone) { foldLaneHidden(target, keyed); hiddenDone = true; console.log(`Folded ${Object.keys(keyed).length} hidden / deleted slide${Object.keys(keyed).length === 1 ? "" : "s"} into ${rel} (deleted in a lane means hidden there).`); }
        if (ops.order) { remap = foldDeckInto(slidesPath, keys, { hidden: {}, deleted: [], order: ops.order }); console.log("Folded the slide order into slides.js (the order is shared by every lane)."); }
      } catch (e) {
        if (!hiddenDone) laneOps.hidden = keyed;
        laneOps.order = ops.order;
        deckLeft = { ...laneOps, reason: e.message };
        console.log(`  kept in ${EDITS_FILE}: the lane's ${hiddenDone ? "order" : "hidden / order"} edits (${e.message}); layered over this build.`);
      }
      if (unkeyed.length) {
        for (const k of unkeyed) laneOps.hidden[k] = laneHidden[k];
        deckLeft = { ...(deckLeft || laneOps), hidden: { ...(deckLeft ? deckLeft.hidden : {}), ...Object.fromEntries(unkeyed.map(k => [k, laneHidden[k]])) }, reason: (deckLeft && deckLeft.reason) || "unkeyed slides" };
        console.log(`  kept in ${EDITS_FILE}: hidden for ${unkeyed.join(", ")} (a lane overlay needs the slide's own \`key\`; give the slide one in slides.js); layered over this build.`);
      }
    }
  }

  // The slide list was reordered: everything still keyed by the old positions follows the
  // slides to their new keys, and an edit on a deleted slide has nowhere to go.
  if (remap) {
    const follow = (what, key) => {
      if (remap.has(key)) return remap.get(key);
      console.log(`  dropped ${what} on ${key}: the slide was deleted.`);
      return null;
    };
    for (const l of left) l.key = follow(`${l.field}`, l.key);
    left = left.filter(l => l.key);
    for (const c of comments) c.key = follow("the comment", c.key);
    comments = comments.filter(c => c.key);
    if (deckLeft) deckLeft.hidden = Object.fromEntries(Object.entries(deckLeft.hidden).map(([k, v]) => [remap.get(k) || k, v]));
    layoutLeft = Object.fromEntries(Object.entries(layoutLeft).filter(([k]) => remap.has(k)).map(([k, v]) => [remap.get(k), v]));
    edits.keys = [...remap.values()];
  }

  if (left.length || comments.length || deckLeft || Object.keys(layoutLeft).length) {
    const slides = {};
    for (const l of left) (slides[l.key] = slides[l.key] || {})[l.field] = { from: l.from, to: l.to };
    for (const c of comments) (slides[c.key] = slides[c.key] || {}).comment = c.comment;
    for (const [k, o] of Object.entries(layoutLeft)) Object.assign(slides[k] = slides[k] || {}, o);
    const out = { ...edits, slides };
    if (deckLeft) out.deck = { ...(Object.keys(deckLeft.hidden).length ? { hidden: deckLeft.hidden } : {}), ...(deckLeft.deleted.length ? { deleted: deckLeft.deleted } : {}), ...(deckLeft.order ? { order: deckLeft.order } : {}) };
    else delete out.deck;
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  } else {
    fs.unlinkSync(file);
    console.log(`${EDITS_FILE} folded and removed.`);
  }
  return { lane: edits.lane || null, fields: left.map(l => ({ key: l.key, field: l.field, to: l.to })), comments,
    deck: deckLeft ? { hidden: deckLeft.hidden, deleted: deckLeft.deleted, order: deckLeft.layerOrder === false ? null : deckLeft.order } : null,
    layout: Object.keys(layoutLeft).length ? layoutLeft : null };
}
// Whether slides.js gives the slide at auto key s<n> an own key (then the auto key isn't its key).
function deckLanesKeyed(cwd, autoKey) {
  const slides = readDeck(loadFresh(path.join(cwd, "slides.js"))).slides;
  const i = Number(autoKey.slice(1)) - 1;
  return !!(slides[i] && slides[i].key);
}
// Layer the edits that couldn't be folded over the slides of one output: field values, then
// hidden flags, deletions and the order (keys are read against the slides' built positions).
function applyEdits(slides, fields, deck = null, layout = null) {
  if (!fields.length && !deck && !layout) return slides;
  let out = structuredClone(slides);
  const keyed = out.map((s, i) => [slideKey(s, i), s]);
  const byKey = new Map(keyed);
  for (const { key, field, to } of fields) {
    const slide = byKey.get(key);
    if (!slide) throw new Error(`${EDITS_FILE}: no slide has key "${key}"`);
    if (!setPath(slide, field, to)) throw new Error(`${EDITS_FILE}: slide ${key} has no field "${field}"`);
  }
  for (const [key, o] of Object.entries(layout || {})) {
    const slide = byKey.get(key);
    if (!slide) throw new Error(`${EDITS_FILE}: no slide has key "${key}"`);
    for (const [n, v] of Object.entries(o.knobs || {})) { if (v.to == null) delete slide[n]; else slide[n] = v.to; }
    if (o.tweaks) { if (o.tweaks.to && Object.keys(o.tweaks.to).length) slide.tweaks = o.tweaks.to; else delete slide.tweaks; }
    for (const [n, kept] of Object.entries(o.arrays || {})) if (Array.isArray(slide[n])) slide[n] = kept.map(i => slide[n][i]).filter(x => x !== undefined);
  }
  if (deck) {
    for (const [key, h] of Object.entries(deck.hidden || {})) { const s = byKey.get(key); if (!s) throw new Error(`${EDITS_FILE}: no slide has key "${key}"`); if (h) s.hidden = true; else delete s.hidden; }
    if (deck.order) { const missing = deck.order.find(k => !byKey.has(k)); if (missing) throw new Error(`${EDITS_FILE}: deck.order names "${missing}", which no slide has`); out = deck.order.map(k => byKey.get(k)).concat(keyed.filter(([k]) => !deck.order.includes(k)).map(([, s]) => s)); }
    if (deck.deleted && deck.deleted.length) out = out.filter(s => !deck.deleted.includes(keyed.find(([, x]) => x === s)[0]));
  }
  return out;
}

// ── deck-plan.md ───────────────────────────────────────────────────
// An optional planning record beside slides.js (SKILL.md §Planning a deck): one markdown table per
// section with columns like # · Slide · Source · Builds · Status, a row naming its slide by key
// in a `Key` column or as a backticked key in the Slide cell. The build reads it and reports, as
// information only, how the plan and the deck line up: rows marked done whose key isn't in the
// deck, and slides the plan doesn't mention.
function readDeckPlan(text) {
  const rows = [];
  let cols = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) { cols = null; continue; }
    const cells = line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if (!cols) { cols = cells.map(c => c.toLowerCase()); continue; }
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
    const row = {};
    cols.forEach((c, i) => { row[c] = cells[i] || ""; });
    const key = (row.key || "").replace(/`/g, "") || ((row.slide || "").match(/`([^`]+)`/) || [])[1] || "";
    if (!("status" in row) && !("slide" in row)) continue;
    rows.push({ key, status: (row.status || "").toLowerCase(), slide: row.slide || "" });
  }
  return rows;
}
function deckPlanSummary(cwd, slides) {
  const file = path.join(cwd, "deck-plan.md");
  if (!fs.existsSync(file)) return "";
  const rows = readDeckPlan(fs.readFileSync(file, "utf8"));
  if (!rows.length) return "deck-plan.md: no slide tables found (a table needs a Status column; see SKILL.md §Planning a deck).";
  const keys = new Set(slides.map((s, i) => slideKey(s, i)));
  const done = rows.filter(r => /^done/.test(r.status)), todo = rows.filter(r => !/^done/.test(r.status));
  const missing = done.filter(r => r.key && !keys.has(r.key)).map(r => r.key);
  const planned = new Set(rows.map(r => r.key).filter(Boolean));
  const unplanned = [...keys].filter(k => !planned.has(k));
  const lines = [`deck-plan.md: ${rows.length} rows, ${done.length} done, ${todo.length} to do`];
  if (missing.length) lines.push(`  done in the plan but not in slides.js: ${missing.join(", ")}`);
  if (planned.size && unplanned.length) lines.push(`  in slides.js but not in the plan: ${unplanned.join(", ")}`);
  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const dirArg = args.find(a => !a.startsWith("--"));
  const cwd = dirArg ? path.resolve(dirArg) : process.cwd();
  const styleSpec = loadStyleSpec(cwd);

  const slidesPath = path.join(cwd, "slides.js");
  if (!fs.existsSync(slidesPath)) {
    console.error(`slides.js not found in ${cwd}`);
    process.exit(1);
  }
  // Review edits first, so the deck read below is the folded one.
  const edits = foldEdits(cwd, readDeck(loadFresh(slidesPath)).lanes);
  const deck = readDeck(loadFresh(slidesPath));
  const { slides, sessions, motion, footer } = deck;
  const reveal = revealAssets(__dirname);
  const review = deck.review || flags.has("--review");

  const presenterPath = path.join(__dirname, "presenter.js");
  if (!fs.existsSync(presenterPath)) {
    console.error(`presenter.js not found next to build-deck.js. Copy it from the templates:`);
    console.error("  cp $PLUGIN/skills/slideware/html/assets/templates/presenter.js .");
    process.exit(1);
  }
  const presenterJs = fs.readFileSync(presenterPath, "utf8");
  const reviewPath = path.join(__dirname, "review.js");
  if (review && !fs.existsSync(reviewPath)) {
    console.error(`review.js not found next to build-deck.js (the deck asks for review mode). Copy it from the templates:`);
    console.error("  cp $PLUGIN/skills/slideware/html/assets/templates/review.js .");
    process.exit(1);
  }
  const reviewJs = review ? fs.readFileSync(reviewPath, "utf8") : "";
  const built = new Date().toISOString();

  const fontsUrl = googleFontsUrl(styleSpec.type || {});
  const palette = styleSpec.palette || {};
  // With a footer, every slide keeps its bottom band clear for it: nothing but the footer in the bottom 40px.
  const css = themeCss(styleSpec) + (footer.length ? "\n.reveal .slides section { padding-bottom: max(var(--margin), 40px); }" : "");
  const logo = footer.length ? logoSvg(cwd, deck, palette) : "";
  const baseTitle = styleSpec.name ? `${styleSpec.name} deck` : "deck";

  // The outputs: the base deck, then one per lane. Every output lists all of them in its lane switcher.
  const overlays = deck.lanes.map((file, i) => {
    const abs = path.resolve(cwd, file);
    if (!fs.existsSync(abs)) throw new Error(`lanes: ${file} not found`);
    const overlay = loadFresh(abs), id = laneId(file);
    if (!overlay || typeof overlay.name !== "string" || !overlay.name.trim()) throw new Error(`lane ${id}: the overlay needs a name`);
    if (overlay.color != null && !/^#[0-9a-f]{6}$/i.test(overlay.color)) throw new Error(`lane ${id}: color must be a #rrggbb hex, got "${overlay.color}"`);
    return { id, name: overlay.name.trim(), file: `index-${id}.html`, overlay, color: overlay.color || LANE_COLORS[i % LANE_COLORS.length] };
  });
  const ids = overlays.map(l => l.id);
  const dupLane = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupLane) throw new Error(`two lanes have the id "${dupLane}" (the overlay's file name)`);
  const outputs = [{ id: null, name: deck.lane, slides, color: null, changed: new Set() },
    ...overlays.map(l => { const laneSlides = applyLane(slides, l.overlay, l.id); return { ...l, slides: laneSlides, changed: laneChangedKeys(slides, laneSlides) }; })];
  // Two flavours of every output: the clean deck to share (index.html, index-<lane>.html), and, with
  // review mode, a sibling for the person building it (index.review.html, index-<lane>.review.html)
  // that inlines review.js. Each flavour's lane switcher stays within the flavour.
  const fileFor = (out, suffix) => out.id ? `index-${out.id}${suffix}.html` : `index${suffix}.html`;
  const flavours = [{ suffix: "", reviewJs: "", title: "" }];
  if (review) flavours.push({ suffix: ".review", reviewJs, title: " · review" });
  else for (const out of outputs) {   // a deck that dropped review mode leaves no stale review file behind
    const stale = path.join(cwd, fileFor(out, ".review"));
    if (fs.existsSync(stale)) { fs.unlinkSync(stale); console.log(`Removed ${path.basename(stale)} (review is off)`); }
  }
  for (const flavour of flavours) {
    const outs = outputs.map(o => ({ ...o, file: fileFor(o, flavour.suffix) }));
    const switcher = outs.map(o => ({ name: o.name, file: o.file, color: o.color }));
    for (const out of outs) {
      // Edits that couldn't be folded are layered over the output they were made in.
      if (edits && edits.lane === out.id) out.slides = applyEdits(out.slides, edits.fields, edits.deck, edits.layout);
      const visible = out.slides.filter(s => !s.hidden);
      const slidesHtml = out.slides.map((s, i) => renderSlide(s, motion, footer.length
        ? { footer, logo: logo ? logo.svg : "", n: s.hidden ? 0 : visible.indexOf(s) + 1, total: visible.length } : null, slideKey(s, i), out.changed.has(slideKey(s, i)))).join("\n");
      const title = (out.id ? `${baseTitle} · ${out.name}` : baseTitle) + flavour.title;
      const lanes = switcher.map(l => ({ ...l, current: l.file === out.file }));
      const html = pageHtml({ title, fontsUrl, css, slidesHtml, reveal, presenterJs, sessions, favicon: faviconHref(palette), footer: footer.length > 0, lanes,
        reviewJs: flavour.reviewJs, review: flavour.reviewJs ? { built, lane: out.id, file: out.file } : null, spec: deck.spec });
      const outPath = path.join(cwd, out.file);
      fs.writeFileSync(outPath, html);
      console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${out.slides.length} slides, ${styleSpec.name || "unnamed style"}${out.id ? `, lane ${out.name}` : overlays.length ? `, lane ${out.name} of ${outs.length}` : ""}${flavour.suffix ? ", review mode" : ""})`);
      if (!flavour.suffix && !out.id && footer.length) console.log(`Footer on every slide but the title: ${footer.join(" · ")} · ${logo ? `logo ${logo.file}` : "no logo (no ./assets/logo-*.svg; a brand's style stages one)"} · page n / ${visible.length}`);
    }
  }
  if (review) console.log(`Review mode (${deck.review ? "review: true in slides.js" : "--review"}) is in the .review files only: E edits text, notes and the slide order, Shift+B rebuilds via serve-deck.js. Share: index.html and index-*.html, not the .review files.`);
  const summary = pacingSummary(slides, sessions);
  if (summary) console.log(summary);
  const planNote = deckPlanSummary(cwd, slides);
  if (planNote) console.log(planNote);
  if (deck.spec) {
    const specPath = path.resolve(cwd, deck.spec);
    const taught = slides.filter(s => s.teaches).length;
    console.log(`Spec: ${deck.spec}${fs.existsSync(specPath) ? "" : " (NOT FOUND next to the deck; the librarian can't follow it)"} · ${taught} of ${slides.length} slides name the section they teach`);
  }
}

if (require.main === module) main();
module.exports = { themeCss, googleFontsUrl, renderSlide, pageHtml, loadStyleSpec, readDeck, pacingSummary, logoSvg, faviconHref, applyLane, slideKey, stringLiterals, literal, foldEdits, applyEdits, splitTopLevel, slidesArray, setHiddenIn, setEntryIn, keepArrayItems, readDeckPlan, deckPlanSummary };
