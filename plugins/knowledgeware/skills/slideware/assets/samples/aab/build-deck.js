// Canonical sample deck — AAB brandbook (warm-gray editorial, diagrammatic, outlined containers).
// Demonstrates 6 distinct layout archetypes from references/layout-patterns.md.
//
// Run:  node $HOME/.claude/skills/slideware/scripts/load-style.js aab -o style-tokens.json
//       node build-deck.js .
//
// What this sample shows:
//   1. Title hero with restrained AAB chrome (light-blue accent bar, near-black ink)
//   2. Big stat (one number anchors the slide; AAB's signature outlined-not-filled motif)
//   3. Two-column tradeoff (red vs sage-green hairline-bordered cards)
//   4. Horizontal process flow (light-blue connectors, the AAB diagrammatic signature)
//   5. Data table (native pptx table with sage-green data row tint)
//   6. Icon-row takeaways with hairline divider and resources strip

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaCheckCircle, FaTimesCircle, FaArrowRight, FaChartLine,
  FaDatabase, FaShieldAlt, FaBookOpen, FaUsers, FaCog,
} = require("react-icons/fa");

const B = JSON.parse(fs.readFileSync(path.join(__dirname, "style-tokens.json"), "utf8"));
const P = B.palette, T = B.type;

// Cosmetic palette — AAB diagrammatic strokes (light-blue, sky-blue, pale-red, sage-green)
const C = {
  bg:      P.bg,        // F1F1F1
  surface: "FFFFFF",
  ink:     P.ink,       // 121212
  body:    P.inkBody || "4D4D4D",
  muted:   P.inkMuted,  // 808080
  rule:    P.border,    // E0E0E0
  // AAB categorical palette
  app:     "A9C4EB",    // light-blue (primary accent / connectors)
  ops:     "99CCFF",    // sky-blue
  security:"EA6B66",    // pale-red
  data:    "7FB069",    // sage-green
  bandFill:"F5F5F5",
};

async function ico(IconComponent, color, size = 256) {
  const cssColor = color.startsWith("#") ? color : "#" + color;
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: cssColor, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

const cx = (w) => +(((10 - w) / 2)).toFixed(3);

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "slideware sample · AAB";
  pres.title = "AAB sample deck";

  const I = {
    check: await ico(FaCheckCircle, C.data),
    x:     await ico(FaTimesCircle, C.security),
    arrow: await ico(FaArrowRight,  C.app),
    chart: await ico(FaChartLine,   C.app),
    db:    await ico(FaDatabase,    C.data),
    shield:await ico(FaShieldAlt,   C.security),
    book:  await ico(FaBookOpen,    C.ops),
    users: await ico(FaUsers,       C.muted),
    cog:   await ico(FaCog,         C.muted),
  };

  const TOTAL = 6;
  const kicker = (s, text, y = 0.32) => s.addText(text, {
    x: 0.5, y, w: 3, h: 0.26,
    fontSize: 9, fontFace: T.sans, bold: true, charSpacing: 3,
    color: C.muted, margin: 0,
  });
  const pageNum = (s, n) => s.addText(`${n} / ${TOTAL}`, {
    x: 8.5, y: 5.3, w: 1.0, h: 0.25,
    fontSize: 9, fontFace: T.sans, color: C.muted, align: "right", margin: 0,
  });

  // ── 1: Title hero ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    // Restrained accent bar — top edge only
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.app } });
    // Eyebrow anchored near top (y=0.55) to give visual mass to the upper half
    s.addText("CANONICAL · SAMPLE 01", {
      x: 0.5, y: 0.55, w: 9, h: 0.26,
      fontSize: 10, fontFace: T.sans, bold: true, charSpacing: 3,
      color: C.muted, margin: 0,
    });
    s.addText("Architecture review,\nQ2 results.", {
      x: 0.5, y: 1.5, w: 9, h: 1.9,
      fontSize: 44, fontFace: T.serif, bold: true,
      color: C.ink, margin: 0, lineSpacingMultiple: 1.1,
    });
    s.addText("How the platform team delivered on this quarter's plan, and what we learned.", {
      x: 0.5, y: 3.95, w: 8.5, h: 0.7,
      fontSize: 14, fontFace: T.sans, italic: true, color: C.muted, margin: 0,
    });
    s.addText("Platform · 2026", {
      x: 0.5, y: 5.05, w: 5, h: 0.3,
      fontSize: 10, fontFace: T.sans, color: C.muted, margin: 0,
    });
  }

  // ── 2: Big stat (one number anchors the slide) ───────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "Q2 · IMPACT");
    pageNum(s, 2);
    s.addText("In one number.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif, bold: true, color: C.ink, margin: 0,
    });

    // Outlined card, full canvas width — diagrammatic AAB signature
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 1.65, w: 9, h: 3.0,
      fill: { color: C.surface }, line: { color: C.rule, width: 0.75 },
    });
    s.addText("42%", {
      x: 0.5, y: 1.85, w: 9, h: 1.8,
      fontSize: 130, fontFace: T.serif, bold: true,
      color: C.ink, align: "center", margin: 0,
    });
    s.addText("reduction in p99 latency across the agent service mesh", {
      x: 0.5, y: 3.7, w: 9, h: 0.4,
      fontSize: 16, fontFace: T.sans, color: C.body, align: "center", margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 4, y: 4.15, w: 2, h: 0.021,
      fill: { color: C.app }, line: { type: "none" },
    });
    s.addText("Source: platform observability dashboard, May 2026.", {
      x: 0.5, y: 4.85, w: 9, h: 0.3,
      fontSize: 9, fontFace: T.sans, italic: true,
      color: C.muted, align: "center", margin: 0,
    });
  }

  // ── 3: Two-column tradeoff (before/after) ────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "Q2 · BEFORE / AFTER");
    pageNum(s, 3);
    s.addText("What changed, in two columns.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif, bold: true, color: C.ink, margin: 0,
    });

    const cardY = 1.7, cardW = 4.3, cardH = 3.2;
    // Left — before (pale-red border)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: cardY, w: cardW, h: cardH,
      fill: { color: C.surface }, line: { color: C.security, width: 1 },
    });
    s.addImage({ data: I.x, x: 0.7, y: cardY + 0.2, w: 0.32, h: 0.32 });
    s.addText("Before", {
      x: 1.15, y: cardY + 0.2, w: cardW - 0.5, h: 0.35,
      fontSize: 16, fontFace: T.sans, bold: true, color: C.security, margin: 0,
    });
    s.addText([
      { text: "Cold start above 2s on 1% of requests", options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Inconsistent retries across team services",  options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Eyeballed dashboards, no per-route p99",      options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Each team owned a private alerting stack",   options: { bullet: true, fontSize: 12 }},
    ], { x: 0.85, y: cardY + 0.75, w: cardW - 0.5, h: cardH - 0.9, fontFace: T.sans, color: C.body, paraSpaceAfter: 6, valign: "top" });

    // Right — after (sage-green border)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: cardY, w: cardW, h: cardH,
      fill: { color: C.surface }, line: { color: C.data, width: 1 },
    });
    s.addImage({ data: I.check, x: 5.4, y: cardY + 0.2, w: 0.32, h: 0.32 });
    s.addText("After", {
      x: 5.85, y: cardY + 0.2, w: cardW - 0.5, h: 0.35,
      fontSize: 16, fontFace: T.sans, bold: true, color: C.data, margin: 0,
    });
    s.addText([
      { text: "Shared cold-start cache — p99 down 42%",     options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Standard retry / backoff in the platform SDK", options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "Per-route p99 alerts wired to PagerDuty",    options: { bullet: true, breakLine: true, fontSize: 12 }},
      { text: "One golden-path dashboard everyone uses",    options: { bullet: true, fontSize: 12 }},
    ], { x: 5.55, y: cardY + 0.75, w: cardW - 0.5, h: cardH - 0.9, fontFace: T.sans, color: C.body, paraSpaceAfter: 6, valign: "top" });
  }

  // ── 4: Horizontal process flow (5 steps, AAB signature light-blue connectors) ─
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "Q2 · DELIVERY PROCESS");
    pageNum(s, 4);
    s.addText("How a change reaches production today.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif, bold: true, color: C.ink, margin: 0,
    });

    const steps = [
      { label: "Plan",   sub: "RFC + design",       icon: I.book },
      { label: "Build",  sub: "PR + reviews",       icon: I.cog },
      { label: "Test",   sub: "CI + eval suite",    icon: I.shield },
      { label: "Ship",   sub: "Canary + rollback",  icon: I.arrow },
      { label: "Watch",  sub: "SLOs + on-call",     icon: I.chart },
    ];
    const boxW = 1.5, boxH = 1.3, startX = 0.5, fY = 1.85, gap = 0.30;
    const totalW = steps.length * boxW + (steps.length - 1) * gap;
    const offsetX = (10 - totalW) / 2;
    steps.forEach((step, i) => {
      const x = offsetX + i * (boxW + gap);
      // Outlined box (the AAB signature)
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: fY, w: boxW, h: boxH,
        fill: { color: C.surface }, line: { color: C.app, width: 1 },
      });
      s.addImage({ data: step.icon, x: x + (boxW - 0.4)/2, y: fY + 0.18, w: 0.4, h: 0.4 });
      s.addText(step.label, {
        x, y: fY + 0.7, w: boxW, h: 0.3,
        fontSize: 14, fontFace: T.sans, bold: true,
        color: C.ink, align: "center", margin: 0,
      });
      s.addText(step.sub, {
        x, y: fY + 1.0, w: boxW, h: 0.25,
        fontSize: 10, fontFace: T.sans, color: C.muted, align: "center", margin: 0,
      });
      if (i < steps.length - 1) {
        // Light-blue connector — AAB signature 2px line
        // Arrow connector — use RIGHT_ARROW so PowerPoint gets a real arrowhead
        // (LINE with h:0 + endArrowType serializes to cy=0 which PowerPoint rejects)
        s.addShape(pres.shapes.RIGHT_ARROW, {
          x: x + boxW, y: fY + boxH/2 - 0.07, w: gap, h: 0.14,
          fill: { color: C.app }, line: { type: "none" },
        });
      }
    });
    // Callout strip below
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 3.55, w: 9, h: 0.7,
      fill: { color: C.bandFill }, line: { color: C.rule, width: 0.5 },
    });
    s.addText([
      { text: "New in Q2: ", options: { bold: true, fontSize: 11, color: C.app }},
      { text: "every step now publishes a structured event to the platform timeline — see slide 6 for rollout.",
        options: { fontSize: 11, color: C.body }},
    ], { x: 0.75, y: 3.6, w: 8.5, h: 0.6, fontFace: T.sans, valign: "middle" });
  }

  // ── 5: Data table — incidents by category ────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "Q2 · INCIDENT REVIEW");
    pageNum(s, 5);
    s.addText("Incidents by category, Q2.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif, bold: true, color: C.ink, margin: 0,
    });

    const ho = { fill: { color: C.ink }, color: "FFFFFF", bold: true, fontSize: 11, fontFace: T.sans, align: "left", valign: "middle" };
    const co = { fontSize: 11, fontFace: T.sans, color: C.body, valign: "middle", align: "left" };
    const ao = { ...co, fill: { color: "FAFAFA" } };
    const dataRow = { ...co, fill: { color: "F0F7E8" } };  // pale sage tint
    const rows = [
      [
        { text: "Category",  options: ho }, { text: "Count", options: ho },
        { text: "Mean MTTR", options: ho }, { text: "Top contributing factor", options: ho },
      ],
      [
        { text: "Compute & infra",     options: { ...co, bold: true } },
        { text: "12", options: co }, { text: "28 min", options: co },
        { text: "Capacity not pre-warmed before traffic peaks", options: co },
      ],
      [
        { text: "Data & storage",      options: { ...ao, bold: true } },
        { text: "8",  options: ao }, { text: "41 min", options: ao },
        { text: "Replication lag during failover", options: ao },
      ],
      [
        { text: "Network & ingress",   options: { ...co, bold: true } },
        { text: "5",  options: co }, { text: "17 min", options: co },
        { text: "TLS rotation timing", options: co },
      ],
      [
        { text: "Application bugs",    options: { ...dataRow, bold: true } },
        { text: "23", options: dataRow }, { text: "12 min", options: dataRow },
        { text: "Mismatched API versions during canary", options: dataRow },
      ],
      [
        { text: "Identity & access",   options: { ...co, bold: true } },
        { text: "3",  options: co }, { text: "9 min",  options: co },
        { text: "Expired service-account credentials", options: co },
      ],
    ];
    s.addTable(rows, {
      x: 0.5, y: 1.6, w: 9, colW: [2.1, 1.0, 1.4, 4.5],
      border: { pt: 0.5, color: C.rule },
      rowH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    });
    s.addText("Total incidents: 51 · Mean MTTR: 22 min · No customer-visible outages.", {
      x: 0.5, y: 4.4, w: 9, h: 0.3,
      fontSize: 11, fontFace: T.sans, italic: true, color: C.muted, margin: 0,
    });
  }

  // ── 6: Icon-row takeaways + resources strip ──────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "Q2 · TAKEAWAYS");
    pageNum(s, 6);
    s.addText("Six things to carry into Q3.", {
      x: 0.5, y: 0.65, w: 9, h: 0.55,
      fontSize: 28, fontFace: T.serif, bold: true, color: C.ink, margin: 0,
    });

    const items = [
      { icon: I.check, text: "Capacity pre-warming pays for itself — keep it on by default" },
      { icon: I.arrow, text: "Standardize retries in the SDK, not in each service" },
      { icon: I.shield,text: "Per-route p99 alerts catch what dashboards miss" },
      { icon: I.db,    text: "Platform timeline events are the new on-call signal source" },
      { icon: I.book,  text: "Postmortems with structured root-cause tags improve search a lot" },
      { icon: I.users, text: "One golden-path dashboard beats five team-specific ones" },
    ];
    items.forEach((item, i) => {
      const y = 1.55 + i * 0.45;
      s.addImage({ data: item.icon, x: 0.6, y: y + 0.05, w: 0.28, h: 0.28 });
      s.addText(item.text, {
        x: 1.05, y, w: 8.5, h: 0.4,
        fontSize: 13, fontFace: T.sans, color: C.body, valign: "middle", margin: 0,
      });
    });
    // Hairline divider
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.5, w: 9, h: 0.007, fill: { color: C.rule }, line: { type: "none" } });
    s.addText("Resources", {
      x: 0.5, y: 4.6, w: 1.5, h: 0.25,
      fontSize: 10, fontFace: T.sans, bold: true, color: C.muted, margin: 0,
    });
    s.addText("platform.intra · go/incidents-q2 · #platform-postmortems", {
      x: 0.5, y: 4.85, w: 9, h: 0.3,
      fontSize: 10, fontFace: T.sans, color: C.muted, margin: 0,
    });
  }

  const outDir = process.argv[2] || ".";
  const outFile = path.resolve(outDir, "deck.pptx");
  await pres.writeFile({ fileName: outFile });
  console.log("✓ AAB sample written to " + outFile);
}

build().catch(e => { console.error(e); process.exit(1); });
