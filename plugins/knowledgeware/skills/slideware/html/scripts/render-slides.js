#!/usr/bin/env node
// render-slides.js — per-slide PNGs from a Reveal.js deck through puppeteer.
// render-slides.sh runs it with the deck directory's node_modules on NODE_PATH.
//
// Usage: node render-slides.js <absolute index.html> <absolute out-dir> [slide-count]
const puppeteer = require("puppeteer");
const path = require("path");

const [htmlPath, outDir, countArg] = process.argv.slice(2);
if (!htmlPath || !outDir) {
  console.error("usage: render-slides.js <index.html> <out-dir> [slide-count]");
  process.exit(2);
}
const slideCount = parseInt(countArg || "1", 10);

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

  for (let i = 0; i < slideCount; i++) {
    await page.goto("file://" + htmlPath + "#/" + i, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 200)); // settle fonts
    const fname = path.join(outDir, "slide-" + String(i + 1).padStart(3, "0") + ".png");
    await page.screenshot({ path: fname, omitBackground: false });
    process.stdout.write("  wrote " + path.relative(process.cwd(), fname) + "\n");
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
