# pptxgenjs reference

Condensed guide for building decks with pptxgenjs + react-icons + sharp. Full docs: https://gitbrent.github.io/PptxGenJS/. The pitfalls list lives in SKILL.md — don't repeat it; check it first when something looks wrong.

## Setup & layout

```javascript
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";     // 10" × 5.625" — default for this skill
// other layouts: LAYOUT_16x10 (10×6.25), LAYOUT_4x3 (10×7.5), LAYOUT_WIDE (13.3×7.5)
```

All coordinates are in **inches**.

| Region | Coords (16:9) |
|---|---|
| Slide-edge safe margin | 0.5" on all sides |
| Title bar | x:0.5, y:0.5, w:9, h:0.6 |
| Two-column body | left x:0.5 w:4.3 ｜ right x:5.2 w:4.3 |
| Three-column body | x:0.5 w:2.85 ｜ x:3.6 w:2.85 ｜ x:6.7 w:2.85 |
| Footer | y:5.1, h:0.3 |

## Text (the patterns that bite)

```javascript
slide.addText("Title", {
  x: 0.5, y: 0.5, w: 9, h: 0.6,
  fontSize: 36, fontFace: "Inter", bold: true,
  color: "141413",                 // 6-char hex, NO `#`
  margin: 0,                       // CRITICAL when aligning with shapes
  charSpacing: -2,                 // pt-scale, sane range 1-5. NOT em/percent.
});

// Rich text (multiple runs in one box). Each segment except the last needs breakLine for multi-line.
slide.addText([
  { text: "Line 1", options: { bullet: true, breakLine: true, fontSize: 14 } },
  { text: "Line 2", options: { bullet: true, breakLine: true } },
  { text: "Line 3", options: { bullet: true } },
], { x: 0.5, y: 1, w: 8, h: 3 });

// Sub-bullet:  { text: "Sub",  options: { bullet: true, indentLevel: 1 } }
// Numbered:    { text: "Step", options: { bullet: { type: "number" }, breakLine: true } }
// DON'T:       slide.addText("• Item", ...)   // creates double bullets
```

## Shapes

```javascript
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 0.5, w: 4, h: 2,
  fill: { color: "FFFFFF" },
  line: { color: "5EEAD4", width: 1 },   // pt, not px
  rectRadius: 0.1,                       // ONLY on ROUNDED_RECTANGLE
});

// Transparency is 0-100 (opposite of CSS opacity)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "0091B2", transparency: 50 },
});

// Shadow — offset must be ≥ 0. For upward shadow, angle: 270 with positive offset.
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" },
  shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.12 },
});
```

Common shape constants: `RECTANGLE`, `ROUNDED_RECTANGLE`, `OVAL`, `LINE`, `ISOCELES_TRIANGLE`, `RIGHT_ARROW`, `CHEVRON`.

**Don't reuse option objects across calls** — pptxgenjs mutates in-place (shadows → EMU). Inline each call or use factories: `const makeShadow = () => ({ ... })`.

## Icons (the high-leverage move)

react-icons → SVG → PNG (via sharp) → base64 → addImage. Universal compatibility.

```javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheckCircle, FaChartBar } = require("react-icons/fa");

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// Pre-bake at top of buildDeck — once, not per-slide
const icons = {
  check:  await iconToBase64Png(FaCheckCircle, "#16A34A"),
  chart:  await iconToBase64Png(FaChartBar, "#0891B2"),
  checkW: await iconToBase64Png(FaCheckCircle, "#FFFFFF"),  // white variants for dark slides
};

slide.addImage({ data: icons.check, x: 0.5, y: 1.0, w: 0.32, h: 0.32 });
```

Use `size: 256+` when rasterizing — that's resolution, not display size. Display is set by `w`/`h` on `addImage`.

Icon sets: `fa` (Font Awesome — default), `md` (Material), `hi` (Heroicons), `bi` (Bootstrap), `fi`/`tb` (Feather/Tabler — minimal line).

## Images, tables, charts (standard API — only the non-obvious bits)

```javascript
// Preserve aspect ratio when only one dim is fixed
const origW = 1978, origH = 923, maxH = 3.0;
const w = maxH * (origW / origH);
slide.addImage({ path: "img.png", x: (10 - w)/2, y: 1, w, h: maxH });

// Base64 for icons; path or URL for photos. Options: sizing {type:"cover"|"contain"|"crop"},
// rotate, rounding, transparency, flipH, altText.

// Tables — use addTable with cell-level options for headers
slide.addTable([
  [
    { text: "Header", options: { fill: { color: "0C2340" }, color: "FFFFFF", bold: true } },
    { text: "Header", options: { fill: { color: "0C2340" }, color: "FFFFFF", bold: true } },
  ],
  ["Cell A", "Cell B"],
  ["Cell C", { text: "Merged", options: { colspan: 2 } }],
], { x: 0.5, y: 1, w: 9, colW: [3, 6], border: { pt: 0.5, color: "CBD5E1" }, fontSize: 11 });

// Charts — always include a one-sentence takeaway above
slide.addChart(pres.charts.BAR, [{
  name: "Sales", labels: ["Q1","Q2","Q3","Q4"], values: [45, 55, 62, 71],
}], { x: 0.5, y: 1, w: 6, h: 3, barDir: "col", chartColors: ["5E6AD2"] });

// Other charts: pres.charts.LINE | PIE | DOUGHNUT | AREA | SCATTER | RADAR
```

## Write & exit

```javascript
async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  // ... bake icons, add slides ...
  const outDir = process.argv[2] || ".";
  await pres.writeFile({ fileName: `${outDir}/deck.pptx` });
}
buildDeck().catch(console.error);
```
