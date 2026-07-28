// starter-deck.js — SKELETAL pptxgenjs scaffold. Compose the deck yourself.
// No opinionated layouts here. Pick layouts from references/layout-patterns.md and adapt per slide.
//
// Setup (one-time per deck dir):
//   npm install pptxgenjs react react-dom react-icons sharp
//   node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json
//   # Or for bundled brandbooks, copy the pre-built tokens (no parse needed):
//   cp $PLUGIN/styles/brands/tokens/<name>.json style-tokens.json
//
// ── PRE-RENDER ALIGNMENT CHECKLIST (run mentally per slide before building) ──
// 1. Title at y=0.5, h=0.6. Content starts at y≥1.4 (gives the title room to wrap).
// 2. Footer / page number at y≥5.1 on 16:9. Never collides with content above.
// 3. Items in a row share the SAME y and h. Compute once, reuse. Don't eyeball.
// 4. Centered element: x = cx(w). Use the helper — don't math by hand.
// 5. Cards/shapes containing text: shape gets 0.15-0.2" internal padding by offsetting
//    text x/y by 0.15-0.2 from the shape's edges AND setting text margin: 0.05+.
// 6. Set margin: 0 on text that aligns with adjacent shapes/icons (pptxgenjs adds
//    default internal padding otherwise).
// 7. Gap between sibling blocks: pick ONE value (0.2" or 0.3") for the whole deck.
//    Mixed gaps read as accidental.
// 8. Long string in a card narrower than 3"? Run through scripts/text-fit.js.
// 9. Vertical centering of text in a box: prefer valign: "middle" + box h close
//    to actual text height. Oversized boxes get thrown off by internal padding.
//
// ── PITFALLS (these will silently break the build or the visual) ──
// - Colors are 6-char hex WITHOUT `#` → "FAF9F5", not "#FAF9F5".
// - Don't reuse option objects across addShape/addText calls — pptxgenjs mutates them.
// - rectRadius only works on ROUNDED_RECTANGLE, not RECTANGLE.
// - Shadow offset must be ≥ 0. For upward shadows, use angle: 270 with positive offset.
// - NEVER use addShape(LINE, { h: 0 }) or { w: 0 } for hairlines. Serializes to
//   <a:ext cy="0"/> — LibreOffice tolerates it but PowerPoint rejects on open
//   ("needs repair" dialog, content removed). Use a thin RECTANGLE instead:
//     s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.012, fill: { color: P.border }, line: { type: "none" } })
//   polish-deck.py now flags this as invalid_dimensions [high].
// - Validate w and h are positive before addShape — math like h: endY-startY can go negative.
// - charSpacing is pt-scale, NOT em/percent. Sane range 1-5. Values ≥10 explode text.
// - Multi-line text needs breakLine: true on each segment.
// - Unicode bullets in plain strings create DOUBLE bullets — use { bullet: true } instead.

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
// Import the icon sets you actually need (don't bake a fixed palette here — pick per deck).
// const { FaCheckCircle, FaArrowRight } = require("react-icons/fa");

// ── Brandbook tokens ──────────────────────────────────────────────────────
const tokensPath = path.join(__dirname, "style-tokens.json");
if (!fs.existsSync(tokensPath)) {
  console.error("style-tokens.json missing. Either:");
  console.error("  node $PLUGIN/scripts/load-style.js <name|path> -o style-tokens.json");
  console.error("  # or copy a pre-built bundled one:");
  console.error("  cp $PLUGIN/styles/brands/tokens/<name>.json style-tokens.json");
  process.exit(1);
}
const B = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
const P = B.palette, T = B.type, L = B.layout;

// ── Helpers ───────────────────────────────────────────────────────────────
// color may arrive with or without "#"; the SVG `color` attribute needs the "#" form.
async function iconPng(IconComponent, color, size = 256) {
  const cssColor = (typeof color === "string" && !color.startsWith("#") && /^[0-9a-fA-F]{6}$/.test(color))
    ? "#" + color
    : color;
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: cssColor, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// Center an element of width w on a 10" slide
const cx = (w) => +(((10 - w) / 2)).toFixed(3);

// Center column of width w in a parent column starting at parentX with parentW
const cxIn = (parentX, parentW, w) => +(parentX + (parentW - w) / 2).toFixed(3);

// ── Build deck ────────────────────────────────────────────────────────────
async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";  // 10 × 5.625 inches
  pres.author = "slideware";
  pres.title = "Deck";

  const TOTAL = 1;  // update as you author

  // ── SLIDE 1: title (replace with whatever opening you author) ────────────
  {
    const s = pres.addSlide();
    s.background = { color: P.bg };
    s.addText("Slide 1 — replace me", {
      x: 0.5, y: 2.4, w: 9, h: 0.8,
      fontSize: T.heroPt, fontFace: T.serif || T.sans, bold: true,
      color: P.ink, margin: 0,
    });
    s.addText("Subtitle", {
      x: 0.5, y: 3.3, w: 9, h: 0.4,
      fontSize: 14, fontFace: T.sans, color: P.inkMuted, margin: 0, italic: true,
    });
  }

  // Add more slides. Each should pick a distinct layout archetype.
  // See: $PLUGIN/skills/slideware/pptx/references/layout-patterns.md
  // ANTI-MONOTONY: no archetype appears more than once per deck.

  // ── Write ────────────────────────────────────────────────────────────────
  const outDir = process.argv[2] || ".";
  const outFile = path.resolve(outDir, "deck.pptx");
  await pres.writeFile({ fileName: outFile });
  console.log("✓ Wrote " + outFile);
  console.log("  Brandbook: " + B.name);
  console.log("  Total slides: " + TOTAL);
  console.log("  Polish:  python3 $PLUGIN/skills/slideware/pptx/scripts/polish-deck.py '" + outFile + "'");
  console.log("  Render:  bash $PLUGIN/skills/slideware/pptx/scripts/render-slides.sh '" + outFile + "' ./preview");
}

buildDeck().catch((err) => { console.error(err); process.exit(1); });
