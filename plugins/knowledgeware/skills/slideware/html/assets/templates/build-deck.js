// build-deck.js — Reveal.js deck builder for the slideware/html skill.
//
// Reads:
//   ./style.md      — design styleSpec (YAML frontmatter) — see references/brandbook-spec.md
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
//                     offline they fall back to system fonts. With `review: true` next to
//                     `slides` (or `--review`), ./review.js is inlined too: E in the deck
//                     edits text and notes in place, Shift+B rebuilds through serve-deck.js.
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
  padding: var(--margin);
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
  grid-template-columns: 1fr 1fr;
  gap: 2em;
  margin-top: 1em;
}

/* ── Layout: card-row ──────────────────────────────────────── */
.reveal section.layout-card-row .cards {
  display: grid;
  grid-template-columns: repeat(var(--card-count, 3), 1fr);
  gap: 1.2em;
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
  margin-bottom: 0.6em;
}

/* ── Layout: image-caption ─────────────────────────────────── */
.reveal section.layout-image-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.reveal section.layout-image-caption img {
  max-width: 80%;
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
`.trim();
}

// ── Slide HTML renderers (one per layout) ──────────────────────────
// Every text field carries data-f="<field>" (array items as "cards.1.body"), HTML-bearing fields
// also data-html, and the section data-key: review.js edits by these, and build-deck folds the
// edits back into slides.js by the same names. Cheap, so every deck has them.
// `a(i, kind)` adds entrance motion to a block (data-a, stagger position i) when the slide
// has motion on, and nothing otherwise.
const f = (name, html = false) => ` data-f="${name}"${html ? " data-html=\"\"" : ""}`;
const renderers = {
  title(s, a) {
    return `<section class="layout-title">
  <h1${a(0)}${f("title")}>${esc(s.title)}</h1>
  ${s.subtitle ? `<p class="subtitle"${a(1)}${f("subtitle")}>${esc(s.subtitle)}</p>` : ""}
  ${s.footer ? `<div class="footer"${a(2, "fade")}${f("footer")}>${esc(s.footer)}</div>` : ""}
</section>`;
  },
  section(s, a) {
    return `<section class="layout-section">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h2${a(1)}${f("title")}>${esc(s.title)}</h2>
</section>`;
  },
  "two-column"(s, a) {
    return `<section class="layout-two-column">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <div class="columns">
    <div class="col-left"${a(2)}${f("left", true)}>${s.left || ""}</div>
    <div class="col-right"${a(3)}${f("right", true)}>${s.right || ""}</div>
  </div>
</section>`;
  },
  "card-row"(s, a) {
    const cards = (s.cards || []).map((c, i) =>
      `<div class="card"${a(2 + i)}><h4${f(`cards.${i}.heading`)}>${esc(c.heading)}</h4><p${f(`cards.${i}.body`, true)}>${c.body || ""}</p></div>`
    ).join("\n    ");
    return `<section class="layout-card-row" style="--card-count: ${s.cards.length};">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <div class="cards">
    ${cards}
  </div>
</section>`;
  },
  bigNumber(s, a) {
    return `<section class="layout-bignumber">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <div class="figure-row"${a(1, "pop")}>
    <div class="figure"${f("figure")}>${esc(s.figure)}</div>
    ${s.unit ? `<div class="unit"${f("unit")}>${esc(s.unit)}</div>` : ""}
  </div>
  ${s.label ? `<div class="label"${a(2)}${f("label")}>${esc(s.label)}</div>` : ""}
  ${s.context ? `<div class="context"${a(3)}${f("context")}>${esc(s.context)}</div>` : ""}
</section>`;
  },
  quote(s, a) {
    return `<section class="layout-quote">
  <blockquote${a(0, "fade")}${f("quote")}>${esc(s.quote)}</blockquote>
  ${s.attribution ? `<div class="attribution"${a(1)}${f("attribution")}>${esc(s.attribution)}</div>` : ""}
</section>`;
  },
  bullets(s, a) {
    const items = (s.items || []).map((item, i) => `<li${a(2 + i)}${f(`items.${i}`, true)}>${item}</li>`).join("\n    ");
    return `<section class="layout-bullets">
  ${s.kicker ? `<div class="kicker"${a(0)}${f("kicker")}>${esc(s.kicker)}</div>` : ""}
  <h3${a(1)}${f("title")}>${esc(s.title)}</h3>
  <ul>
    ${items}
  </ul>
</section>`;
  },
  "image-caption"(s, a) {
    return `<section class="layout-image-caption">
  <img src="${s.src}" alt="${esc(s.alt || "")}"${a(0, "fade")}/>
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
function renderSlide(slide, motion = false, chrome = null, key = null) {
  const fn = renderers[slide.layout];
  if (!fn) throw new Error(`Unknown layout: "${slide.layout}". Supported: ${Object.keys(renderers).join(", ")}`);
  const moving = slide.motion != null ? !!slide.motion : motion;
  const a = (i, kind = "up") => (moving ? ` data-a="${kind}" style="--i: ${i}"` : "");
  let html = fn(slide, a);
  if (key) html = html.replace(/^(<section class="[^"]*")/, `$1 data-key="${esc(key)}"`);
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
//   review    true inlines review.js: E edits text and notes in the deck (see §Review edits)
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
  return { slides: deck.slides, sessions, motion: deck.motion !== false, footer: footer.map(t => t.trim()), logo: deck.logo, lanes, lane: deck.lane || "Base", review: deck.review === true };
}

// ── Lanes ──────────────────────────────────────────────────────────
// A lane is the same deck worked for another audience or example: one overlay file per lane,
// listed in `lanes`, applied to a copy of the slides. The overlay exports
//   { name: "Acme Investments",                       // shown in the lane switcher
//     replace: [["Acme Corp", "Acme Investments"]],   // string replacements over every text field
//     slides: { "s1-07": { right: "…", notes: "…" } } }   // fields replaced whole, by the slide's `key`
// The lane's id is the overlay's file name without .js, and its output is index-<id>.html.
// Replacements skip `layout`, `key`, `src`, `cue` and `motion`, so they change words, not structure.
const REPLACE_SKIP = new Set(["layout", "key", "src", "cue", "motion", "hidden"]);
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
function pageHtml({ title, fontsUrl, css, slidesHtml, reveal, presenterJs, sessions = {}, favicon = "", footer = false, lanes = [], reviewJs = "", review = null }) {
  const presenterConfig = { sessions, ...(lanes.length > 1 ? { lanes } : {}) };
  const plugins = ["RevealPresenter", ...(reviewJs ? ["RevealReview"] : [])];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  ${favicon ? `<link rel="icon" href="${favicon.replace(/"/g, "%22")}"/>` : ""}
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
//     slides: { "<key>": { title: { from: "old", to: "new" }, "cards.1.body": { from, to }, notes: { from, to },
//                          comment: "a note for whoever edits the deck next" } } }
// Keys are the slides' own `key`s, else "s<n>" by position in slides.js. Before every build the
// edits are folded into the source: each `from` is looked up as a string literal in slides.js (or
// in the lane's overlay when the edits were made in a lane) and rewritten to `to`, with the same
// quote style and the file's comments and layout untouched. A `from` the file doesn't hold exactly
// once can't be placed, so it stays in edits.json and is layered over this build instead; comments
// stay too, for whoever iterates on the deck (often Claude). edits.json is deleted when nothing is left.
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
    try { delete require.cache[file]; require(file); } catch (e) {
      fs.writeFileSync(file, original);
      throw new Error(`folding ${EDITS_FILE} into ${path.basename(file)} broke it (${e.message}); the file is unchanged. Fold the edits by hand.`);
    }
  }
  return { applied, left };
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
  const entries = [], comments = [];
  for (const [key, fields] of Object.entries(edits.slides)) {
    if (!fields || typeof fields !== "object") continue;
    for (const [field, v] of Object.entries(fields)) {
      if (field === "comment") { if (typeof v === "string" && v.trim()) comments.push({ key, comment: v.trim() }); continue; }
      if (!v || typeof v.from !== "string" || typeof v.to !== "string") throw new Error(`${EDITS_FILE}: ${key}.${field} must be { from, to }`);
      if (v.from !== v.to) entries.push({ key, field, from: v.from, to: v.to });
    }
  }
  const { applied, left } = entries.length ? foldInto(target, entries) : { applied: [], left: [] };
  const rel = path.relative(process.cwd(), target) || path.basename(target);
  if (applied.length) console.log(`Folded ${applied.length} edit${applied.length === 1 ? "" : "s"} from ${EDITS_FILE} into ${rel} (${new Set(applied.map(a => a.key)).size} slide${new Set(applied.map(a => a.key)).size === 1 ? "" : "s"}).`);
  for (const l of left) console.log(`  kept in ${EDITS_FILE}: ${l.key}.${l.field} (${l.reason}); layered over this build. Fold it by hand.`);
  for (const c of comments) console.log(`  comment on ${c.key}: ${c.comment}`);
  if (left.length || comments.length) {
    const slides = {};
    for (const l of left) (slides[l.key] = slides[l.key] || {})[l.field] = { from: l.from, to: l.to };
    for (const c of comments) (slides[c.key] = slides[c.key] || {}).comment = c.comment;
    fs.writeFileSync(file, JSON.stringify({ ...edits, slides }, null, 2) + "\n");
  } else {
    fs.unlinkSync(file);
    console.log(`${EDITS_FILE} folded and removed.`);
  }
  return { lane: edits.lane || null, fields: left.map(l => ({ key: l.key, field: l.field, to: l.to })), comments };
}
// Layer the edits that couldn't be folded over the slides of one output.
function applyEdits(slides, fields) {
  if (!fields.length) return slides;
  const out = structuredClone(slides);
  for (const { key, field, to } of fields) {
    const slide = out.find((s, i) => slideKey(s, i) === key);
    if (!slide) throw new Error(`${EDITS_FILE}: no slide has key "${key}"`);
    if (!setPath(slide, field, to)) throw new Error(`${EDITS_FILE}: slide ${key} has no field "${field}"`);
  }
  return out;
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
  delete require.cache[slidesPath];
  const edits = foldEdits(cwd, readDeck(require(slidesPath)).lanes);
  delete require.cache[slidesPath];
  const deck = readDeck(require(slidesPath));
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
  const overlays = deck.lanes.map(file => {
    const abs = path.resolve(cwd, file);
    if (!fs.existsSync(abs)) throw new Error(`lanes: ${file} not found`);
    delete require.cache[abs];
    const overlay = require(abs), id = laneId(file);
    if (!overlay || typeof overlay.name !== "string" || !overlay.name.trim()) throw new Error(`lane ${id}: the overlay needs a name`);
    return { id, name: overlay.name.trim(), file: `index-${id}.html`, overlay };
  });
  const ids = overlays.map(l => l.id);
  const dupLane = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupLane) throw new Error(`two lanes have the id "${dupLane}" (the overlay's file name)`);
  const outputs = [{ id: null, name: deck.lane, file: "index.html", slides }, ...overlays.map(l => ({ ...l, slides: applyLane(slides, l.overlay, l.id) }))];
  const switcher = outputs.map(o => ({ name: o.name, file: o.file }));

  for (const out of outputs) {
    // Edits that couldn't be folded are layered over the output they were made in.
    if (edits && edits.lane === out.id) out.slides = applyEdits(out.slides, edits.fields);
    const visible = out.slides.filter(s => !s.hidden);
    const slidesHtml = out.slides.map((s, i) => renderSlide(s, motion, footer.length
      ? { footer, logo: logo ? logo.svg : "", n: s.hidden ? 0 : visible.indexOf(s) + 1, total: visible.length } : null, slideKey(s, i))).join("\n");
    const title = out.id ? `${baseTitle} · ${out.name}` : baseTitle;
    const lanes = switcher.map(l => ({ ...l, current: l.file === out.file }));
    const html = pageHtml({ title, fontsUrl, css, slidesHtml, reveal, presenterJs, sessions, favicon: faviconHref(palette), footer: footer.length > 0, lanes,
      reviewJs, review: reviewJs ? { built, lane: out.id, file: out.file } : null });
    const outPath = path.join(cwd, out.file);
    fs.writeFileSync(outPath, html);
    console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${out.slides.length} slides, ${styleSpec.name || "unnamed style"}${out.id ? `, lane ${out.name}` : overlays.length ? `, lane ${out.name} of ${outputs.length}` : ""})`);
    if (reviewJs && !out.id) console.log(`Review mode inlined (${deck.review ? "review: true in slides.js" : "--review"}): E in the deck edits text and notes, Shift+B rebuilds via serve-deck.js.`);
    if (footer.length && !out.id) console.log(`Footer on every slide but the title: ${footer.join(" · ")} · ${logo ? `logo ${logo.file}` : "no logo (no ./assets/logo-*.svg; a brand's style stages one)"} · page n / ${visible.length}`);
  }
  const summary = pacingSummary(slides, sessions);
  if (summary) console.log(summary);
}

if (require.main === module) main();
module.exports = { themeCss, googleFontsUrl, renderSlide, pageHtml, loadStyleSpec, readDeck, pacingSummary, logoSvg, faviconHref, applyLane, slideKey, stringLiterals, literal, foldEdits, applyEdits };
