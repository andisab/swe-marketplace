// Canonical sample deck — Linear brandbook (dark-first, layered backgrounds, indigo accent).
// Demonstrates 6 distinct archetypes using Linear's signature 5-level dark canvas system.
//
// Run:  node $PLUGIN/scripts/load-style.js linear -o style-tokens.json
//       node build-deck.js .
//
// What this sample shows:
//   1. Title hero on deepest dark with bright-purple accent gradient (marketing only)
//   2. Big stat on near-black with bright accent number
//   3. Three-column cards using elevated dark surfaces (no shadows, just lightening)
//   4. Asymmetric editorial mid-deck divider with tight tracking
//   5. Data table on dark with translucent borders
//   6. Closing CTA with brand-bg button and hairline-thin focus ring chrome

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaCheckCircle, FaArrowRight, FaBolt, FaCog,
  FaCloud, FaShieldAlt, FaCode, FaLayerGroup,
} = require("react-icons/fa");

const B = JSON.parse(fs.readFileSync(path.join(__dirname, "style-tokens.json"), "utf8"));
const P = B.palette, T = B.type;

// Cosmetic palette — Linear's 5 dark levels + indigo brand
const C = {
  bgDeep:    "010102",    // marketing canvas (deepest)
  bg:        P.bg,        // 08090A primary
  panel:     "0F1011",    // level-1
  raised:    "141516",    // level-2
  elevated:  "191A1B",    // level-3
  ink:       P.ink,       // F7F8F8
  inkSec:    P.inkMuted,  // D0D6E0
  inkTer:    "8A8F98",
  border:    P.border,    // 23252A
  indigo:    P.accent,    // 5E6AD2 (muted brand)
  accent:    P.accent2 || "7170FF",  // bright accent
};

async function ico(IconComponent, color, size = 256) {
  const cssColor = color.startsWith("#") ? color : "#" + color;
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: cssColor, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "slideware sample · Linear";
  pres.title = "Linear sample deck";

  const I = {
    check: await ico(FaCheckCircle, C.accent),
    arrow: await ico(FaArrowRight,  C.accent),
    bolt:  await ico(FaBolt,        C.accent),
    cog:   await ico(FaCog,         C.inkSec),
    cloud: await ico(FaCloud,       C.inkSec),
    shield:await ico(FaShieldAlt,   C.inkSec),
    code:  await ico(FaCode,        C.indigo),
    layers:await ico(FaLayerGroup,  C.indigo),
  };

  const TOTAL = 6;
  const kicker = (s, text, color = C.inkTer) => s.addText(text, {
    x: 0.5, y: 0.32, w: 5, h: 0.26,
    fontSize: 10, fontFace: T.sans || "Inter", bold: true, charSpacing: 2,
    color, margin: 0,
  });
  const pageNum = (s, n) => s.addText(`${n} / ${TOTAL}`, {
    x: 8.5, y: 5.3, w: 1.0, h: 0.25,
    fontSize: 9, fontFace: T.sans || "Inter",
    color: C.inkTer, align: "right", margin: 0,
  });

  // ── 1: Title hero — deepest dark with accent gradient strip ──────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bgDeep };
    // Bright accent strip — Linear's marketing iridescent vibe
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: C.accent } });
    // Eyebrow anchored near top — gives the upper half visual mass
    s.addText("ENGINEERING REVIEW · Q2", {
      x: 0.5, y: 0.55, w: 9, h: 0.26,
      fontSize: 10, fontFace: T.sans || "Inter", bold: true, charSpacing: 2,
      color: C.accent, margin: 0,
    });
    // Tight tracking, weight 510 simulated with non-bold (variable font weight is approximated)
    s.addText("Built faster.\nShipped safer.", {
      x: 0.5, y: 1.55, w: 9, h: 2.0,
      fontSize: 48, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, lineSpacingMultiple: 1.05, charSpacing: -1,
    });
    s.addText("How the platform team cut deploy time in half and incidents by a third in twelve weeks.", {
      x: 0.5, y: 4.05, w: 8.5, h: 0.8,
      fontSize: 15, fontFace: T.sans || "Inter",
      color: C.inkSec, margin: 0, charSpacing: -0.5,
    });
    s.addText("Platform · 2026", {
      x: 0.5, y: 5.05, w: 5, h: 0.3,
      fontSize: 10, fontFace: T.sans || "Inter", color: C.inkTer, margin: 0,
    });
  }

  // ── 2: Big stat — bright accent number on primary dark ───────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "DEPLOYMENT VELOCITY", C.accent);
    pageNum(s, 2);
    s.addText("47%", {
      x: 0.5, y: 1.3, w: 9, h: 2.6,
      fontSize: 200, fontFace: T.sans || "Inter", bold: true,
      color: C.accent, align: "center", margin: 0, charSpacing: -2,
    });
    s.addText("reduction in mean time to deploy.", {
      x: 0.5, y: 4.05, w: 9, h: 0.4,
      fontSize: 18, fontFace: T.sans || "Inter",
      color: C.ink, align: "center", margin: 0, charSpacing: -0.5,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 4.5, y: 4.6, w: 1, h: 0.014, fill: { color: C.indigo }, line: { type: "none" } });
    s.addText("From 38 min (Q1) to 20 min (Q2). Per-PR median.", {
      x: 0.5, y: 4.8, w: 9, h: 0.3,
      fontSize: 10, fontFace: T.sans || "Inter",
      color: C.inkTer, align: "center", margin: 0,
    });
  }

  // ── 3: Three-column cards — elevated dark surfaces, no shadows ──────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "WHAT GOT BUILT");
    pageNum(s, 3);
    s.addText("Three changes that mattered.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 30, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, charSpacing: -0.8,
    });

    const cards = [
      { icon: I.code,  title: "Inline CI", body: "Tests run in the PR's own branch. No remote queue.", stat: "12× faster", color: C.indigo },
      { icon: I.layers,title: "Per-route p99", body: "Latency alerts per route, not per service.",      stat: "47% fewer pages", color: C.accent },
      { icon: I.shield,title: "Canary by default", body: "All deploys go 1% → 10% → 50% → 100%.",         stat: "0 user incidents", color: C.indigo },
    ];
    const cardW = 2.85, cardH = 3.0, cardY = 1.7;
    cards.forEach((c, i) => {
      const x = 0.5 + i * (cardW + 0.2);
      // Elevated dark — level-3 surface (lighter than bg, no shadow needed)
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: C.elevated }, line: { color: C.border, width: 0.5 },
      });
      s.addImage({ data: c.icon, x: x + 0.25, y: cardY + 0.3, w: 0.4, h: 0.4 });
      s.addText(c.title, {
        x: x + 0.25, y: cardY + 0.85, w: cardW - 0.5, h: 0.4,
        fontSize: 16, fontFace: T.sans || "Inter", bold: true,
        color: C.ink, margin: 0, charSpacing: -0.3,
      });
      s.addText(c.body, {
        x: x + 0.25, y: cardY + 1.3, w: cardW - 0.5, h: 0.9,
        fontSize: 12, fontFace: T.sans || "Inter",
        color: C.inkSec, margin: 0, valign: "top",
      });
      // Stat highlight at bottom — colored
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.25, y: cardY + cardH - 0.65, w: 0.6, h: 0.014, fill: { color: c.color }, line: { type: "none" } });
      s.addText(c.stat, {
        x: x + 0.25, y: cardY + cardH - 0.5, w: cardW - 0.5, h: 0.35,
        fontSize: 13, fontFace: T.sans || "Inter", bold: true,
        color: c.color, margin: 0, charSpacing: -0.3,
      });
    });
  }

  // ── 4: Asymmetric editorial mid-deck divider ─────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bgDeep };
    kicker(s, "PART TWO", C.accent);
    pageNum(s, 4);
    s.addText("The boring infrastructure\nis the interesting part.", {
      x: 0.5, y: 1.6, w: 9, h: 2.4,
      fontSize: 42, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, charSpacing: -1.2, lineSpacingMultiple: 1.1,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.2, w: 0.8, h: 0.028, fill: { color: C.accent }, line: { type: "none" } });
    s.addText("How we measured impact, not just velocity.", {
      x: 0.5, y: 4.35, w: 8, h: 0.4,
      fontSize: 15, fontFace: T.sans || "Inter",
      color: C.inkSec, margin: 0, charSpacing: -0.3, italic: true,
    });
  }

  // ── 5: Data table — dark with translucent rows ───────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "MEASUREMENT");
    pageNum(s, 5);
    s.addText("What we tracked, week by week.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, charSpacing: -0.7,
    });

    const ho = { fill: { color: C.panel }, color: C.inkSec, bold: true, fontSize: 11, fontFace: T.sans || "Inter", align: "left", valign: "middle" };
    const co = { fontSize: 11, fontFace: T.sans || "Inter", color: C.ink, valign: "middle", align: "left" };
    const ao = { ...co, fill: { color: C.elevated } };
    const rows = [
      [
        { text: "Metric",           options: ho },
        { text: "Baseline (Q1)",    options: ho },
        { text: "Target",           options: ho },
        { text: "Actual (Q2)",      options: ho },
      ],
      [
        { text: "Deploy time (median)",   options: { ...co, bold: true, color: C.inkSec } },
        { text: "38 min", options: co },
        { text: "≤ 25 min", options: { ...co, color: C.inkTer } },
        { text: "20 min ✓", options: { ...co, color: C.accent, bold: true } },
      ],
      [
        { text: "P99 latency, /search", options: { ...ao, bold: true, color: C.inkSec } },
        { text: "820 ms", options: ao },
        { text: "≤ 500 ms", options: { ...ao, color: C.inkTer } },
        { text: "440 ms ✓", options: { ...ao, color: C.accent, bold: true } },
      ],
      [
        { text: "Incidents (per week)", options: { ...co, bold: true, color: C.inkSec } },
        { text: "4.2", options: co },
        { text: "≤ 3.0", options: { ...co, color: C.inkTer } },
        { text: "2.7 ✓", options: { ...co, color: C.accent, bold: true } },
      ],
      [
        { text: "PR review time (median)", options: { ...ao, bold: true, color: C.inkSec } },
        { text: "7.5 hr", options: ao },
        { text: "≤ 4.0 hr", options: { ...ao, color: C.inkTer } },
        { text: "5.1 hr ✗", options: { ...ao, color: "EB5757", bold: true } },
      ],
      [
        { text: "Eval-suite coverage", options: { ...co, bold: true, color: C.inkSec } },
        { text: "62%", options: co },
        { text: "≥ 85%", options: { ...co, color: C.inkTer } },
        { text: "91% ✓", options: { ...co, color: C.accent, bold: true } },
      ],
    ];
    s.addTable(rows, {
      x: 0.5, y: 1.5, w: 9, colW: [3.0, 2.0, 2.0, 2.0],
      border: { pt: 0.5, color: C.border },
      rowH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    });
    s.addText("4 of 5 targets met. Reviewer time still trending; new flow lands next sprint.", {
      x: 0.5, y: 4.5, w: 9, h: 0.3,
      fontSize: 11, fontFace: T.sans || "Inter", italic: true,
      color: C.inkTer, margin: 0,
    });
  }

  // ── 6: Closing CTA — brand-bg button, hairline chrome ───────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "CARRY-FORWARD");
    pageNum(s, 6);
    s.addText("Three things\nwe're keeping.", {
      x: 0.5, y: 0.9, w: 5.5, h: 2.0,
      fontSize: 40, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, charSpacing: -1, lineSpacingMultiple: 1.05,
    });
    s.addText([
      { text: "✓ ", options: { color: C.accent, bold: true } },
      { text: "Inline CI as the default for every team.", options: { color: C.ink } },
    ], { x: 0.5, y: 3.15, w: 5.5, h: 0.4, fontSize: 13, fontFace: T.sans || "Inter", margin: 0, charSpacing: -0.3 });
    s.addText([
      { text: "✓ ", options: { color: C.accent, bold: true } },
      { text: "Per-route p99 alerts wired before launch.", options: { color: C.ink } },
    ], { x: 0.5, y: 3.65, w: 5.5, h: 0.4, fontSize: 13, fontFace: T.sans || "Inter", margin: 0, charSpacing: -0.3 });
    s.addText([
      { text: "✓ ", options: { color: C.accent, bold: true } },
      { text: "Canary-by-default for all deploys.", options: { color: C.ink } },
    ], { x: 0.5, y: 4.15, w: 5.5, h: 0.4, fontSize: 13, fontFace: T.sans || "Inter", margin: 0, charSpacing: -0.3 });

    // Right column — CTA card on raised surface
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.5, y: 1.0, w: 3.0, h: 3.5,
      fill: { color: C.raised }, line: { color: C.border, width: 0.5 },
    });
    s.addText("NEXT", {
      x: 6.75, y: 1.25, w: 2.5, h: 0.25,
      fontSize: 9, fontFace: T.sans || "Inter", bold: true, charSpacing: 2,
      color: C.accent, margin: 0,
    });
    s.addText("Q3 plan review.", {
      x: 6.75, y: 1.6, w: 2.5, h: 0.5,
      fontSize: 20, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, margin: 0, charSpacing: -0.5,
    });
    s.addText("Thursday, 14:00 UTC.\nPlatform-wide attendance.", {
      x: 6.75, y: 2.25, w: 2.5, h: 0.8,
      fontSize: 12, fontFace: T.sans || "Inter",
      color: C.inkSec, margin: 0, lineSpacingMultiple: 1.4,
    });
    // CTA button — brand indigo
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 3.6, w: 2.0, h: 0.5,
      fill: { color: C.indigo }, line: { color: C.indigo, width: 0 },
    });
    s.addText("RSVP →", {
      x: 6.75, y: 3.6, w: 2.0, h: 0.5,
      fontSize: 12, fontFace: T.sans || "Inter", bold: true,
      color: C.ink, align: "center", valign: "middle", margin: 0, charSpacing: 1,
    });
  }

  const outDir = process.argv[2] || ".";
  const outFile = path.resolve(outDir, "deck.pptx");
  await pres.writeFile({ fileName: outFile });
  console.log("✓ Linear sample written to " + outFile);
}

build().catch(e => { console.error(e); process.exit(1); });
