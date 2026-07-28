// Canonical sample deck — Anthropic brandbook (cream canvas, clay accent, serif body).
// Demonstrates 6 distinct archetypes with restrained editorial chrome.
//
// Run:  node $PLUGIN/scripts/load-style.js anthropic -o style-tokens.json
//       node build-deck.js .
//
// What this sample shows:
//   1. Title hero with cream bg + clay top bar (single brand color)
//   2. Pull quote (serif italic dominates, small attribution)
//   3. Big stat with serif numeral and minimal chrome
//   4. Two-column tradeoff (cream cards on cream bg — separation via hairline only)
//   5. Vertical timeline with clay dots and dates
//   6. Icon-row takeaways with clay accent strip on left

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaCheckCircle, FaArrowRight, FaQuoteLeft, FaCircle,
  FaSeedling, FaLeaf, FaBookOpen, FaFeather,
} = require("react-icons/fa");

const B = JSON.parse(fs.readFileSync(path.join(__dirname, "style-tokens.json"), "utf8"));
const P = B.palette, T = B.type;

// Cosmetic palette
const C = {
  bg:        P.bg,         // FAF9F5 cream
  surfaceAlt:P.surfaceAlt || "F0EEE6",
  surface:   "FFFFFF",
  ink:       P.ink,        // 141413
  muted:     P.inkMuted,   // 5E5D59
  cloud:     "B0AEA5",
  border:    "E0DCD5",
  clay:      P.accent,     // D97757 — THE brand color
  clayDeep:  P.accent2 || "C6613F",
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
  pres.author = "slideware sample · Anthropic";
  pres.title = "Anthropic sample deck";

  const I = {
    check:  await ico(FaCheckCircle, C.clay),
    arrow:  await ico(FaArrowRight,  C.clay),
    quote:  await ico(FaQuoteLeft,   C.cloud, 256),
    dot:    await ico(FaCircle,      C.clay,  256),
    seed:   await ico(FaSeedling,    C.clay),
    leaf:   await ico(FaLeaf,        C.clay),
    book:   await ico(FaBookOpen,    C.clay),
    feather:await ico(FaFeather,     C.clay),
  };

  const TOTAL = 6;
  const kicker = (s, text) => s.addText(text, {
    x: 0.5, y: 0.32, w: 4, h: 0.26,
    fontSize: 9, fontFace: T.sans || "Inter", bold: true, charSpacing: 3,
    color: C.clay, margin: 0,
  });
  const pageNum = (s, n) => s.addText(`${n} / ${TOTAL}`, {
    x: 8.5, y: 5.3, w: 1.0, h: 0.25,
    fontSize: 9, fontFace: T.sans || "Inter",
    color: C.muted, align: "right", margin: 0,
  });

  // ── 1: Title hero ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    // Single clay accent bar — top edge
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.clay } });
    // Eyebrow anchored near top — gives the upper half visual mass
    s.addText("FIELD NOTES · 03", {
      x: 0.5, y: 0.55, w: 9, h: 0.26,
      fontSize: 10, fontFace: T.sans || "Inter", bold: true, charSpacing: 3,
      color: C.clay, margin: 0,
    });
    // Serif display — Anthropic's signature
    s.addText("On the slow work\nof making AI useful.", {
      x: 0.5, y: 1.5, w: 9, h: 2.0,
      fontSize: 42, fontFace: T.serif || "Source Serif 4",
      color: C.ink, margin: 0, lineSpacingMultiple: 1.15,
    });
    s.addText("Notes from twelve months building tools alongside engineering teams.", {
      x: 0.5, y: 4.0, w: 8, h: 0.5,
      fontSize: 15, fontFace: T.serif || "Source Serif 4", italic: true,
      color: C.muted, margin: 0,
    });
    s.addText("Field Notes · Spring 2026", {
      x: 0.5, y: 5.05, w: 6, h: 0.3,
      fontSize: 10, fontFace: T.sans || "Inter", color: C.muted, margin: 0,
    });
  }

  // ── 2: Pull quote (serif italic, the editorial Anthropic move) ───────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "OPENING · OBSERVATION");
    pageNum(s, 2);

    // Soft quote mark (decorative, low-contrast)
    s.addImage({ data: I.quote, x: 0.7, y: 1.2, w: 0.7, h: 0.7 });

    s.addText("The hardest problems aren't about\nmaking models smarter. They're about\nbuilding the rails to use them safely.", {
      x: 1.6, y: 1.4, w: 8, h: 2.5,
      fontSize: 28, fontFace: T.serif || "Source Serif 4", italic: true,
      color: C.ink, margin: 0, lineSpacingMultiple: 1.25,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 1.6, y: 4.15, w: 0.6, h: 0.021,
      fill: { color: C.clay }, line: { type: "none" },
    });
    s.addText("Jasmine R., Platform Architect\nField interview · March 2026", {
      x: 1.6, y: 4.3, w: 6, h: 0.7,
      fontSize: 11, fontFace: T.sans || "Inter",
      color: C.muted, margin: 0, lineSpacingMultiple: 1.4,
    });
  }

  // ── 3: Big stat with editorial framing ───────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "FIELD DATA · ADOPTION");
    pageNum(s, 3);
    s.addText("By the numbers.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif || "Source Serif 4",
      color: C.ink, margin: 0,
    });
    s.addText("From twelve teams over twelve months.", {
      x: 0.5, y: 1.2, w: 9, h: 0.3,
      fontSize: 13, fontFace: T.serif || "Source Serif 4", italic: true,
      color: C.muted, margin: 0,
    });

    // Three stat blocks in a row — serif numerals, no card chrome
    const stats = [
      { num: "12", label: "teams using\nthe SDK", color: C.clay },
      { num: "3.4×", label: "average time\nsaved per task", color: C.ink },
      { num: "94%", label: "would recommend\nto a colleague", color: C.ink },
    ];
    stats.forEach((stat, i) => {
      const x = 0.7 + i * 3.0;
      s.addText(stat.num, {
        x, y: 2.0, w: 2.8, h: 1.8,
        fontSize: 90, fontFace: T.serif || "Source Serif 4",
        color: stat.color, align: "center", margin: 0,
      });
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.9, y: 3.95, w: 1.0, h: 0.007, fill: { color: C.border }, line: { type: "none" } });
      s.addText(stat.label, {
        x, y: 4.05, w: 2.8, h: 0.7,
        fontSize: 13, fontFace: T.sans || "Inter",
        color: C.muted, align: "center", margin: 0, lineSpacingMultiple: 1.3,
      });
    });
  }

  // ── 4: Two-column tradeoff (cream cards on cream bg, hairline-only) ──────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "FIELD NOTES · TRADEOFFS");
    pageNum(s, 4);
    s.addText("What worked, what didn't.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif || "Source Serif 4",
      color: C.ink, margin: 0,
    });

    const cardY = 1.5, cardW = 4.3, cardH = 3.4;
    // Left — what worked
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: cardY, w: cardW, h: cardH,
      fill: { color: C.surface }, line: { color: C.border, width: 0.75 },
    });
    s.addText("What worked", {
      x: 0.75, y: cardY + 0.3, w: cardW - 0.5, h: 0.4,
      fontSize: 18, fontFace: T.serif || "Source Serif 4", bold: true,
      color: C.ink, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.75, y: cardY + 0.75, w: 0.6, h: 0.014, fill: { color: C.clay }, line: { type: "none" } });
    s.addText([
      { text: "Treat the model as an apprentice, not an oracle", options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Make evals the spec, not an afterthought",         options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Onboard one team well before scaling out",         options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Keep prompts in version control, alongside code",  options: { bullet: true, fontSize: 12 }},
    ], { x: 0.75, y: cardY + 1.0, w: cardW - 0.5, h: cardH - 1.2, fontFace: T.serif || "Source Serif 4", color: C.ink, paraSpaceAfter: 8, valign: "top" });

    // Right — what didn't
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: cardY, w: cardW, h: cardH,
      fill: { color: C.surfaceAlt }, line: { color: C.border, width: 0.75 },
    });
    s.addText("What didn't", {
      x: 5.45, y: cardY + 0.3, w: cardW - 0.5, h: 0.4,
      fontSize: 18, fontFace: T.serif || "Source Serif 4", bold: true,
      color: C.ink, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.45, y: cardY + 0.75, w: 0.6, h: 0.014, fill: { color: C.muted }, line: { type: "none" } });
    s.addText([
      { text: "Building from scratch instead of using the SDK",   options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Optimizing for benchmarks instead of real tasks",  options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Rolling out without observability in place",       options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Skipping the boring eval suite to ship faster",    options: { bullet: true, fontSize: 12 }},
    ], { x: 5.45, y: cardY + 1.0, w: cardW - 0.5, h: cardH - 1.2, fontFace: T.serif || "Source Serif 4", color: C.muted, paraSpaceAfter: 8, valign: "top" });
  }

  // ── 5: Vertical timeline ─────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "FIELD NOTES · TIMELINE");
    pageNum(s, 5);
    s.addText("Twelve months in five moments.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif || "Source Serif 4",
      color: C.ink, margin: 0,
    });

    const events = [
      { date: "Apr 2025", title: "First team adopts the SDK", body: "A four-person platform group ships their first agent in production." },
      { date: "Jul 2025", title: "Eval suite reaches 100 cases", body: "Coverage hits an inflection — the team trusts the regression bar." },
      { date: "Oct 2025", title: "Scaled to seven teams",       body: "Onboarding playbook gets formal. First non-platform team joins." },
      { date: "Jan 2026", title: "First model upgrade rollout", body: "Evals catch a behavior regression before customers do. Patched in 36 hours." },
      { date: "Apr 2026", title: "Twelve teams across product", body: "Field notes (this deck) compiled from interviews with each." },
    ];
    const startY = 1.7, rowH = 0.66;
    events.forEach((e, i) => {
      const y = startY + i * rowH;
      // Clay dot
      s.addImage({ data: I.dot, x: 0.55, y: y + 0.12, w: 0.18, h: 0.18 });
      // Connector line (skip last)
      if (i < events.length - 1) {
        s.addShape(pres.shapes.RECTANGLE, {
          x: 0.64, y: y + 0.3, w: 0.010, h: rowH - 0.12,
          fill: { color: C.border }, line: { type: "none" },
        });
      }
      // Date
      s.addText(e.date, {
        x: 0.95, y, w: 1.4, h: 0.35,
        fontSize: 11, fontFace: T.sans || "Inter", bold: true,
        color: C.muted, margin: 0,
      });
      // Title
      s.addText(e.title, {
        x: 2.5, y, w: 7, h: 0.35,
        fontSize: 14, fontFace: T.serif || "Source Serif 4", bold: true,
        color: C.ink, margin: 0,
      });
      // Body
      s.addText(e.body, {
        x: 2.5, y: y + 0.32, w: 7, h: 0.3,
        fontSize: 11, fontFace: T.serif || "Source Serif 4",
        color: C.muted, margin: 0,
      });
    });
  }

  // ── 6: Icon-row takeaways with left accent strip ─────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "FIELD NOTES · CARRY-FORWARD");
    pageNum(s, 6);
    // Left clay accent strip — restrained, full-height
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 5.625, fill: { color: C.clay } });

    s.addText("Five things to carry forward.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif || "Source Serif 4",
      color: C.ink, margin: 0,
    });

    const takeaways = [
      { icon: I.feather,text: "Treat evals as the product spec, not an audit." },
      { icon: I.seed,   text: "Onboard one team well before scaling out." },
      { icon: I.book,   text: "Version your prompts in the same repo as your code." },
      { icon: I.leaf,   text: "Build observability before you need it." },
      { icon: I.arrow,  text: "Field notes from real teams are worth more than benchmarks." },
    ];
    takeaways.forEach((t, i) => {
      const y = 1.7 + i * 0.6;
      s.addImage({ data: t.icon, x: 0.7, y: y + 0.08, w: 0.3, h: 0.3 });
      s.addText(t.text, {
        x: 1.2, y, w: 8.3, h: 0.45,
        fontSize: 15, fontFace: T.serif || "Source Serif 4",
        color: C.ink, valign: "middle", margin: 0,
      });
    });
  }

  const outDir = process.argv[2] || ".";
  const outFile = path.resolve(outDir, "deck.pptx");
  await pres.writeFile({ fileName: outFile });
  console.log("✓ Anthropic sample written to " + outFile);
}

build().catch(e => { console.error(e); process.exit(1); });
