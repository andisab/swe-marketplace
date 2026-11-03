// export.js — PNG, PDF and PowerPoint out of a deck, through headless Chrome (cdp.js).
//
//   png(file, dir, { scale, all })   one image per slide, fully built (hidden slides with all)
//   pdf(file, out)                   one 1280×720 page per visible slide, fully built
//   pptx(file, out, { level })       see pptx.js
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { launch } = require("./cdp");

async function openDeck(browser, file, { scale = 1, query = "capture" } = {}) {
  const page = await browser.newPage({ width: 1280, height: 720, scale });
  await page.goto(pathToFileURL(path.resolve(file)).href + "?" + query);
  await page.evaluate("new Promise(r => SW.ready(() => r(true)))");
  return page;
}
const settle = "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))";

async function png(file, dir, { scale = 2, all = false, browser } = {}) {
  const own = !browser;
  browser = browser || await launch();
  const out = [];
  try {
    const page = await openDeck(browser, file, { scale });
    fs.mkdirSync(dir, { recursive: true });
    const slides = await page.evaluate(`(${all} ? SW.allSlides() : SW.slides()).map(s => ({ key: s.getAttribute("data-key"), hidden: s.hidden }))`);
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      await page.evaluate(`(() => { const all = SW.allSlides(), el = all.find(x => x.getAttribute("data-key") === ${JSON.stringify(s.key)});
        if (el.hidden) { el.hidden = false; SW.refresh(); el.dataset.swWasHidden = ""; }
        SW.go(SW.slides().indexOf(el), "end"); })()`);
      await page.evaluate(settle);
      const name = `${String(i + 1).padStart(2, "0")}-${s.key}.png`.replace(/[^\w.-]/g, "_");
      fs.writeFileSync(path.join(dir, name), await page.screenshot());
      out.push(path.join(dir, name));
      if (s.hidden) await page.evaluate(`(() => { const el = SW.allSlides().find(x => x.getAttribute("data-key") === ${JSON.stringify(s.key)}); el.hidden = true; delete el.dataset.swWasHidden; SW.refresh(); })()`);
    }
    await page.close();
  } finally { if (own) await browser.close(); }
  return out;
}

async function pdf(file, out, { browser } = {}) {
  const own = !browser;
  browser = browser || await launch();
  try {
    const page = await openDeck(browser, file, { query: "print" });
    await page.evaluate(settle);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await page.pdf({ preferCSSPageSize: true }));
    await page.close();
  } finally { if (own) await browser.close(); }
  return out;
}

async function pptx(file, out, opts = {}) {
  return require("./pptx").exportPptx(file, out, opts);
}

module.exports = { png, pdf, pptx, openDeck };
