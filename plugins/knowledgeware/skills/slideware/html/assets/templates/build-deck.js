// build-deck.js — Reveal.js deck builder for the slideware/html skill.
//
// Reads:
//   ./style.md      — design tokens (YAML frontmatter) — see references/brandbook-spec.md
//   ./slides.js     — array of slide descriptors — see slides.js for the schema
//
// Writes:
//   ./index.html    — single self-contained HTML file (Reveal core via CDN, fonts
//                     via Google Fonts <link>, theme CSS and the presenter plugin
//                     (./presenter.js) INLINED, no other external refs)
//
// Setup (one-time per deck dir):
//   npm install js-yaml
//   cp $PLUGIN/shared/styles/<name>.md ./style.md
//   cp $PLUGIN/skills/slideware/html/assets/templates/{build-deck.js,presenter.js,slides.js,package.json} .
//   node build-deck.js .
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

const REVEAL_VERSION = "5.0.5"; // pinned, see https://github.com/hakimel/reveal.js/releases
const REVEAL_CDN_BASE = `https://cdn.jsdelivr.net/npm/reveal.js@${REVEAL_VERSION}/dist`;

const SLIDE_W_PX = 1280;
const SLIDE_H_PX = 720;

// Speaker-notes cue fields read by presenter.js (see references/reveal.md §Speaker notes).
const CUE_KEYS = ["session", "module", "run"];
const CUE_RUNS = ["default", "cut-first", "add-back", "backup"];

// ── Brandbook tokens (from YAML frontmatter of ./style.md) ───────────
function loadTokens(cwd) {
  const stylePath = path.join(cwd, "style.md");
  if (!fs.existsSync(stylePath)) {
    console.error("style.md missing. Either:");
    console.error("  cp $PLUGIN/shared/styles/<name>.md ./style.md");
    console.error("  # or for custom brandbooks:");
    console.error("  cp $PLUGIN/shared/styles/custom/<name>.md ./style.md");
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
  const tokens = yaml.load(fmMatch[1]);
  // Keep `#` in palette hex — CSS expects it. (Unlike pptxgenjs, which needs it stripped.)
  return tokens;
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
.reveal .slides section {
  padding: var(--margin);
  box-sizing: border-box;
  height: 100%;
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

/* Grid items default to min-width: auto, so a single long unbreakable token (a URL,
   a code identifier, an uppercase heading with letter-spacing) can blow out the column
   and push the row past the slide's right edge. Two safeguards: min-width:0 lets
   columns shrink to their track, and overflow-wrap lets long strings break mid-token. */
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
`.trim();
}

// ── Slide HTML renderers (one per layout) ──────────────────────────
const renderers = {
  title(s) {
    return `<section class="layout-title">
  <h1>${esc(s.title)}</h1>
  ${s.subtitle ? `<p class="subtitle">${esc(s.subtitle)}</p>` : ""}
  ${s.footer ? `<div class="footer">${esc(s.footer)}</div>` : ""}
</section>`;
  },
  section(s) {
    return `<section class="layout-section">
  ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}
  <h2>${esc(s.title)}</h2>
</section>`;
  },
  "two-column"(s) {
    return `<section class="layout-two-column">
  ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}
  <h3>${esc(s.title)}</h3>
  <div class="columns">
    <div class="col-left">${s.left || ""}</div>
    <div class="col-right">${s.right || ""}</div>
  </div>
</section>`;
  },
  "card-row"(s) {
    const cards = (s.cards || []).map(c =>
      `<div class="card"><h4>${esc(c.heading)}</h4><p>${c.body || ""}</p></div>`
    ).join("\n    ");
    return `<section class="layout-card-row" style="--card-count: ${s.cards.length};">
  ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}
  <h3>${esc(s.title)}</h3>
  <div class="cards">
    ${cards}
  </div>
</section>`;
  },
  bigNumber(s) {
    return `<section class="layout-bignumber">
  ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}
  <div class="figure-row">
    <div class="figure">${esc(s.figure)}</div>
    ${s.unit ? `<div class="unit">${esc(s.unit)}</div>` : ""}
  </div>
  ${s.label ? `<div class="label">${esc(s.label)}</div>` : ""}
  ${s.context ? `<div class="context">${esc(s.context)}</div>` : ""}
</section>`;
  },
  quote(s) {
    return `<section class="layout-quote">
  <blockquote>${esc(s.quote)}</blockquote>
  ${s.attribution ? `<div class="attribution">${esc(s.attribution)}</div>` : ""}
</section>`;
  },
  bullets(s) {
    const items = (s.items || []).map(i => `<li>${i}</li>`).join("\n    ");
    return `<section class="layout-bullets">
  ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}
  <h3>${esc(s.title)}</h3>
  <ul>
    ${items}
  </ul>
</section>`;
  },
  "image-caption"(s) {
    return `<section class="layout-image-caption">
  <img src="${s.src}" alt="${esc(s.alt || "")}"/>
  ${s.caption ? `<div class="caption">${esc(s.caption)}</div>` : ""}
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
  const unknown = Object.keys(cue).filter(k => !CUE_KEYS.includes(k));
  if (unknown.length) throw new Error(`Unknown cue field(s): ${unknown.join(", ")}. Supported: ${CUE_KEYS.join(", ")}`);
  if (cue.run != null && !CUE_RUNS.includes(cue.run)) throw new Error(`Unknown cue.run: "${cue.run}". Supported: ${CUE_RUNS.join(", ")}. To take a slide out of the deck, set hidden: true.`);
  const attrs = CUE_KEYS.filter(k => cue[k] != null && cue[k] !== "").map(k => ` data-${k}="${esc(cue[k])}"`).join("");
  return `<aside class="notes"${attrs}>${esc(slide.notes || "").replace(/\r?\n/g, "&#10;")}</aside>`;
}

function renderSlide(slide) {
  const fn = renderers[slide.layout];
  if (!fn) throw new Error(`Unknown layout: "${slide.layout}". Supported: ${Object.keys(renderers).join(", ")}`);
  let html = fn(slide);
  // Reveal removes hidden slides when the deck loads, so the presenter doesn't count them either.
  if (slide.hidden) html = html.replace(/^(<section class="[^"]*")/, '$1 data-visibility="hidden"');
  const notes = notesHtml(slide);
  return notes ? html.replace(/<\/section>$/, `  ${notes}\n</section>`) : html;
}

// ── Deck spec and pacing ───────────────────────────────────────────
// slides.js exports either an array of slides or { slides, sessions, minutes }:
//   sessions  session label (cue.session) → length in minutes
//   minutes   length of the slides that have no cue.session (a deck without sessions)
// The presenter gives every in-run slide of a session an equal share of its length.
function readDeck(spec) {
  const deck = Array.isArray(spec) ? { slides: spec } : (spec || {});
  if (!Array.isArray(deck.slides)) throw new Error("slides.js must export an array of slides, or { slides: [...], sessions: {...} }.");
  const labels = new Set(deck.slides.map(s => (s.cue && s.cue.session) || ""));
  const sessions = Object.assign(deck.minutes != null ? { "": deck.minutes } : {}, deck.sessions);
  for (const [label, minutes] of Object.entries(sessions)) {
    const name = label ? `sessions["${label}"]` : "minutes";
    if (!labels.has(label)) throw new Error(label ? `${name}: no slide has cue.session "${label}"` : "minutes: every slide has a cue.session, so set sessions instead");
    if (!(Number(minutes) > 0)) throw new Error(`${name} must be a number of minutes, got "${minutes}"`);
    sessions[label] = Number(minutes);
  }
  return { slides: deck.slides, sessions };
}

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
function pageHtml({ title, fontsUrl, css, slidesHtml, presenterJs, sessions = {} }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  ${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontsUrl}" rel="stylesheet"/>` : ""}
  <link rel="stylesheet" href="${REVEAL_CDN_BASE}/reveal.css"/>
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
  <script src="${REVEAL_CDN_BASE}/reveal.js"></script>
  ${presenterJs ? `<script>\n${presenterJs.replace(/<\/script/gi, "<\\/script")}\n  </script>` : ""}
  <script>
    Reveal.initialize({
      width: ${SLIDE_W_PX},
      height: ${SLIDE_H_PX},
      hash: true,
      controls: true,
      progress: true,
      slideNumber: 'c/t',
      transition: 'fade',${presenterJs ? `
      plugins: [RevealPresenter],
      presenter: { sessions: ${JSON.stringify(sessions).replace(/</g, "\\u003c")} },` : ""}
    });
  </script>
</body>
</html>
`;
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  const cwd = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const tokens = loadTokens(cwd);

  const slidesPath = path.join(cwd, "slides.js");
  if (!fs.existsSync(slidesPath)) {
    console.error(`slides.js not found in ${cwd}`);
    process.exit(1);
  }
  delete require.cache[slidesPath];
  const { slides, sessions } = readDeck(require(slidesPath));

  const presenterPath = path.join(__dirname, "presenter.js");
  if (!fs.existsSync(presenterPath)) {
    console.error(`presenter.js not found next to build-deck.js. Copy it from the templates:`);
    console.error("  cp $PLUGIN/skills/slideware/html/assets/templates/presenter.js .");
    process.exit(1);
  }
  const presenterJs = fs.readFileSync(presenterPath, "utf8");

  const fontsUrl = googleFontsUrl(tokens.type || {});
  const css = themeCss(tokens);
  const slidesHtml = slides.map(renderSlide).join("\n");
  const title = tokens.name ? `${tokens.name} deck` : "deck";

  const html = pageHtml({ title, fontsUrl, css, slidesHtml, presenterJs, sessions });
  const outPath = path.join(cwd, "index.html");
  fs.writeFileSync(outPath, html);

  console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${slides.length} slides, ${tokens.name || "unnamed style"})`);
  const summary = pacingSummary(slides, sessions);
  if (summary) console.log(summary);
}

if (require.main === module) main();
module.exports = { themeCss, googleFontsUrl, renderSlide, pageHtml, loadTokens, readDeck, pacingSummary };
