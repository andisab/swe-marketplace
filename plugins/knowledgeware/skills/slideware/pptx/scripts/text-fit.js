#!/usr/bin/env node
// text-fit.js — estimate whether text will fit in a given pptxgenjs box without overflow.
// Rough but useful — pptxgenjs doesn't auto-shrink, so you have to size by estimation.
//
// Usage (CLI):
//   node text-fit.js --text "Some sentence" --w 3.0 --h 1.2 --fontSize 14 [--font Inter] [--lineHeight 1.3]
//   echo "Some sentence" | node text-fit.js --w 3 --h 1.2 --fontSize 14
//
// Programmatic:
//   const { estimate } = require("./text-fit");
//   const { fits, lines, recommendedFontPt } = estimate({ text, wIn: 3, hIn: 1.2, fontPt: 14 });

// Average character advance in EM units per font family at 1em. These are eyeball averages
// for proportional fonts at body sizes. For display sizes (>24pt) advances are slightly tighter.
const AVG_ADVANCE = {
  Inter:        0.52,
  "Inter Variable": 0.52,
  "SF Pro":     0.50,
  "SF Pro Text": 0.50,
  "SF Pro Display": 0.50,
  Helvetica:    0.52,
  Arial:        0.52,
  Calibri:      0.50,
  "Source Serif 4": 0.55,
  "Source Serif": 0.55,
  Georgia:      0.54,
  Lora:         0.55,
  Bitter:       0.56,
  "Trebuchet MS": 0.52,
  "Times New Roman": 0.51,
  default:      0.53,
};

// pt → inches: 1 pt = 1/72 in.
const PT_PER_INCH = 72;

function avgCharWidthIn(fontPt, fontFace) {
  const em = AVG_ADVANCE[fontFace] || AVG_ADVANCE.default;
  return (em * fontPt) / PT_PER_INCH;
}

/**
 * Estimate fit. Returns:
 *   { fits, lineCount, capacityLines, recommendedFontPt }
 *
 * Inputs:
 *   text             — the string (use \n for explicit breaks)
 *   wIn, hIn         — inches
 *   fontPt           — font size in points
 *   font             — font family
 *   lineHeight       — multiplier (default 1.3)
 *   padIn            — internal text-box padding to deduct (default 0.05" each side)
 *
 * Notes:
 *   - For bullet lists, split on \n and run per line (then sum lineCount).
 *   - For rich text with mixed sizes, this won't be exact; estimate at the largest size.
 */
function estimate({ text, wIn, hIn, fontPt, font = "Inter", lineHeight = 1.3, padIn = 0.05 }) {
  if (!text) return { fits: true, lineCount: 0, capacityLines: 0, recommendedFontPt: fontPt };
  const usableW = Math.max(0.1, wIn - 2 * padIn);
  const usableH = Math.max(0.1, hIn - 2 * padIn);
  const charW = avgCharWidthIn(fontPt, font);
  const charsPerLine = Math.max(1, Math.floor(usableW / charW));

  // Count wrapped lines per explicit paragraph
  const paragraphs = String(text).split(/\r?\n/);
  let lineCount = 0;
  for (const p of paragraphs) {
    if (!p) { lineCount += 1; continue; }   // empty line still consumes vertical space
    lineCount += Math.max(1, Math.ceil(p.length / charsPerLine));
  }

  const lineHeightIn = (fontPt * lineHeight) / PT_PER_INCH;
  const capacityLines = Math.max(1, Math.floor(usableH / lineHeightIn));

  const fits = lineCount <= capacityLines;

  // If it doesn't fit, suggest a smaller font that would.
  let recommendedFontPt = fontPt;
  if (!fits) {
    // Try shrinking in 1pt steps down to 8pt.
    for (let trial = fontPt - 1; trial >= 8; trial--) {
      const cw = avgCharWidthIn(trial, font);
      const cpl = Math.max(1, Math.floor(usableW / cw));
      const lc = paragraphs.reduce((sum, p) => sum + (p ? Math.ceil(p.length / cpl) : 1), 0);
      const lhi = (trial * lineHeight) / PT_PER_INCH;
      const cap = Math.max(1, Math.floor(usableH / lhi));
      if (lc <= cap) { recommendedFontPt = trial; break; }
    }
    if (recommendedFontPt === fontPt) recommendedFontPt = 8; // floor
  }

  return { fits, lineCount, capacityLines, charsPerLine, recommendedFontPt };
}

function cli() {
  const args = require("process").argv.slice(2);
  const opts = { fontSize: 14, lineHeight: 1.3, font: "Inter" };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i].replace(/^--/, "");
    opts[k] = args[i + 1];
  }
  let text = opts.text;
  if (!text && !process.stdin.isTTY) {
    text = require("fs").readFileSync(0, "utf8").trim();
  }
  if (!text || !opts.w || !opts.h) {
    console.error("Usage: node text-fit.js --text \"...\" --w 3 --h 1.2 --fontSize 14 [--font Inter]");
    process.exit(1);
  }
  const r = estimate({
    text,
    wIn: parseFloat(opts.w),
    hIn: parseFloat(opts.h),
    fontPt: parseFloat(opts.fontSize),
    font: opts.font,
    lineHeight: parseFloat(opts.lineHeight),
  });
  console.log(JSON.stringify(r, null, 2));
}

if (require.main === module) cli();
module.exports = { estimate, avgCharWidthIn };
