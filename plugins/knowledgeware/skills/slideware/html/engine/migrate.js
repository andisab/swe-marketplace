// migrate.js — convert an old slideware deck (slides.js plus its own build-deck.js, Reveal.js
// output) into the single-file format. Never in place: it writes a new folder.
//
//   migrate(oldDeckDir, { out, brand, kitDir, rebuild })
//
// 1. Rebuild the old deck with its own builder, so its output is current (rebuild: false skips it).
// 2. Open each output (base and lanes) in headless Chrome with hidden slides un-hidden, let its
//    load-time balance pass run, and read every slide from the live page: Reveal and review-mode
//    state stripped, serialized canonically. The balance pass's results are kept, so they're
//    applied once and saved instead of re-run at every load.
// 3. Lift large SVGs into the asset block, one copy per distinct drawing; slides keep a placeholder
//    with the slide's own size, position and fitted viewBox.
// 4. Cues move onto the section, notes become plain text, the old running footer becomes the
//    deck's footer settings (plus a slide's own part in data-footer).
// 5. Lanes become overlays: the old persona's text replacements, figure swaps, and a whole-slide
//    override wherever the lane still differs.
// 6. The deck takes its brand from brandware when `brand` names one. Otherwise the old theme CSS,
//    converted, becomes a brand kit (kitDir, default <out>/brand-kit: css/slideware.css, the deck's
//    style.md as brand.md, its logos) to move into the brands directory. Raw-slide CSS and the
//    balance CSS go to the deck either way.
// Returns a report with every old file the new folder replaces, for deletion after review.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const D = require("./deckfile");
const build = require("./build");
const L = require("../runtime/lanes");

const SERIALIZE_JS = fs.readFileSync(path.join(__dirname, "..", "editor", "serialize.js"), "utf8");

// Old theme CSS → selectors for the new structure.
function convertCss(css) {
  return css
    .replace(/\.reveal\s+\.slides\s+section/g, "section[data-key]")
    .replace(/\.reveal\s+\.slides\s*>\s*section/g, "section[data-key]")
    .replace(/\.reveal\s+section/g, "section[data-key]")
    .replace(/\.reveal\s+\.slides\b/g, "section[data-key]")
    .replace(/\.reveal\s+(?=[.#\w[:*])/g, "section[data-key] ")
    .replace(/\.reveal\b/g, "section[data-key]")
    .replace(/\.chrome-bot/g, ".sw-chrome").replace(/\.ch-l\b/g, ".sw-chrome-l").replace(/\.ch-r\b/g, ".sw-chrome-r")
    .replace(/\.ch-pg\b/g, ".sw-chrome-pg").replace(/\.ch-logo\b/g, ".sw-chrome-logo")
    .replace(/\.fragment\.visible/g, ".fragment.sw-visible").replace(/\.current-fragment/g, ".sw-current")
    .replace(/\.present\b/g, ".sw-present")
    .replace(/html\.rp-builds/g, "html.sw-builds")
    .replace(/section\[data-key\] section\[data-key\]/g, "section[data-key]");
}

const EXTRACT = `(async () => {
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  await new Promise(r => setTimeout(r, 400));
  if (window.deckBalance) Reveal.getSlides().forEach(s => { try { window.deckBalance.balance(s); } catch (e) {} });
  await new Promise(r => setTimeout(r, 200));
  const S = window.SWSerialize;
  const styles = [...document.querySelectorAll("head style")].map(s => s.textContent);
  const defs = [...document.body.children].filter(e => e.localName === "svg").map(e => S.serializeNode(e));
  const fonts = (document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis"]') || {}).href || null;
  const STRIP = ["data-f", "data-html", "data-b", "data-bk", "data-w", "data-key-auto", "data-lane-changed", "data-balanced", "data-bal", "data-fitted", "data-vb", "data-fragment", "data-index-h", "data-index-v", "data-previous-indexh", "data-previous-indexv"];
  const sections = [...document.querySelectorAll(".reveal .slides > section")].map(sec => {
    const c = sec.cloneNode(true);
    ["present", "past", "future", "stack"].forEach(k => c.classList.remove(k));
    ["hidden", "aria-hidden", "inert", "data-visibility"].forEach(a => c.removeAttribute(a));
    ["display", "top", "left", "visibility", "transform", "opacity", "pointer-events"].forEach(p => c.style.removeProperty(p));
    if (!c.getAttribute("style")) c.removeAttribute("style");
    c.querySelectorAll(".fragment").forEach(f => f.classList.remove("visible", "current-fragment"));
    [c, ...c.querySelectorAll("*")].forEach(e => STRIP.forEach(a => e.removeAttribute(a)));
    let footerParts = null;
    const foot = c.querySelector(":scope > .chrome-bot");
    if (foot) { footerParts = [...foot.querySelectorAll(".ch-l > span")].map(s => s.textContent.trim()); foot.remove(); }
    const aside = c.querySelector(":scope > aside.notes");
    const cue = aside ? { session: aside.dataset.session || "", module: aside.dataset.module || "", run: aside.dataset.run || "" } : {};
    const notes = aside ? aside.textContent : "";
    if (aside) aside.remove();
    // Large drawings become figures; small icons (sprite <use>) stay inline.
    const figures = [];
    [...c.querySelectorAll("svg")].filter(s => !s.parentElement.closest("svg")).forEach(svg => {
      const inner = S.serializeChildren(svg);
      if (inner.length < 1500 || /^\\s*<use\\b[^>]*\\/?>\\s*$/.test(inner)) return;
      const asset = {}, place = {};
      for (const a of [...svg.attributes]) {
        if (/^(viewbox|xmlns|xmlns:xlink|version|preserveaspectratio)$/i.test(a.name)) asset[a.name] = a.value;
        if (!/^(xmlns|xmlns:xlink|version|id)$/i.test(a.name)) place[a.name] = a.value;
      }
      const orig = sec.querySelector("svg[data-vb]");
      figures.push({ asset, place, inner, token: "__SWFIG_" + figures.length + "__" });
      const ph = document.createElement("i");
      ph.textContent = figures[figures.length - 1].token;
      svg.replaceWith(ph);
    });
    return { key: sec.dataset.key, html: S.serializeNode(c), footerParts, cue, notes, figures, divider: c.classList.contains("layout-section") };
  });
  return { styles, defs, fonts, sections, title: document.title };
})()`;

function hash(s) { return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12); }
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

async function extract(browser, file, hiddenKeys) {
  // A temporary copy with hidden slides kept (Reveal drops data-visibility="hidden" at start-up).
  const text = fs.readFileSync(file, "utf8").replace(/\sdata-visibility="hidden"/g, "");
  const tmp = file.replace(/\.html$/, `.migrate-tmp-${process.pid}.html`);
  fs.writeFileSync(tmp, text);
  try {
    const page = await browser.newPage({ width: 1280, height: 720 });
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(SERIALIZE_JS);
    const r = await page.evaluate(EXTRACT);
    await page.close();
    return r;
  } finally { fs.rmSync(tmp, { force: true }); }
  void hiddenKeys;
}

function sectionWith(sec, { figureNames, hidden, footerExtra, teaches }) {
  let html = sec.html;
  sec.figures.forEach((f, i) => {
    const name = figureNames[i];
    const attrs = Object.entries(f.place).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join("");
    html = html.replace(`<i>${f.token}</i>`, `<svg data-figure-ref="${escAttr(name)}"${attrs}></svg>`);
  });
  let open = /^<section\b[^>]*>/i.exec(html)[0];
  const add = {};
  if (sec.cue.session !== undefined && sec.cue.session !== "") add["data-session"] = sec.cue.session;
  if (sec.cue.module) add["data-module"] = sec.cue.module;
  if (sec.cue.run && sec.cue.run !== "default") add["data-run"] = sec.cue.run;
  if (!sec.footerParts) add["data-chrome"] = "none";
  if (footerExtra) add["data-footer"] = footerExtra;
  if (sec.divider) add["data-divider"] = true;
  if (teaches) add["data-teaches"] = teaches;
  if (hidden) add.hidden = true;
  open = L.setAttrs(open, add);
  html = open + html.slice(/^<section\b[^>]*>/i.exec(html)[0].length);
  const notes = sec.notes.replace(/\r\n/g, "\n").trim();
  return html.replace(/<\/section>\s*$/, (notes ? `  <aside class="notes">${escText(notes)}</aside>\n` : "") + "</section>");
}

async function migrate(oldDir, { out, brand, kitDir, rebuild = true, browser: given } = {}) {
  oldDir = path.resolve(oldDir);
  const slidesFile = path.join(oldDir, "slides.js");
  if (!fs.existsSync(slidesFile) || !fs.existsSync(path.join(oldDir, "build-deck.js"))) throw new Error(`${oldDir} isn't an old-format deck (no slides.js and build-deck.js)`);
  out = path.resolve(out || oldDir + "-v2");
  if (path.resolve(out) === oldDir) throw new Error("migrate never writes in place; give --out a new folder");
  const report = { out, notes: [], replaces: [] };
  if (rebuild) {
    execFileSync(process.execPath, ["build-deck.js", "."], { cwd: oldDir, stdio: "pipe", env: { ...process.env, NODE_OPTIONS: "" } });
    report.notes.push("rebuilt the old deck with its own builder");
  }
  delete require.cache[require.resolve(slidesFile)];
  const spec = require(slidesFile);
  const deckSpec = Array.isArray(spec) ? { slides: spec } : spec;
  const hidden = new Set(deckSpec.slides.filter((s) => s.hidden).map((s) => s.key));
  const srcOf = new Map(deckSpec.slides.filter((s) => s.src && /\.svg$/i.test(s.src)).map((s) => [s.key, path.basename(s.src, ".svg")]));
  const teachesOf = new Map(deckSpec.slides.filter((s) => s.teaches).map((s) => [s.key, s.teaches]));   // slides.js-only; the librarian reads data-teaches
  const laneFiles = (deckSpec.lanes || []).map((p) => ({ id: path.basename(p, ".js"), overlayPath: path.resolve(oldDir, p), file: path.join(oldDir, `index-${path.basename(p, ".js")}.html`) }));

  const { launch } = require("./cdp");
  const browser = given || await launch();
  let base;
  const laneData = [];
  try {
    base = await extract(browser, path.join(oldDir, "index.html"), hidden);
    for (const l of laneFiles) if (fs.existsSync(l.file)) laneData.push({ ...l, data: await extract(browser, l.file, hidden) });
  } finally { if (!given) await browser.close(); }

  // Figures: one asset per distinct drawing.
  const assets = new Map();   // hash → { name, svg }
  const nameFor = (key, i, f, laneId) => {
    const h = hash(JSON.stringify(f.asset) + f.inner);
    if (assets.has(h)) return assets.get(h).name;
    let name = srcOf.get(key) && i === 0 ? srcOf.get(key) : `${key}-fig${i + 1}`;
    if (laneId) name += `@${laneId}`;
    while ([...assets.values()].some((a) => a.name === name)) name += "-b";
    const attrs = Object.entries(f.asset).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join("");
    assets.set(h, { name, svg: `<svg data-figure="${escAttr(name)}"${attrs}>${f.inner}</svg>` });
    return name;
  };
  const cfgFooter = [].concat(deckSpec.footer || []).filter(Boolean);
  const footerExtraOf = (sec) => sec.footerParts && sec.footerParts.length > cfgFooter.length ? sec.footerParts.slice(cfgFooter.length).join(" · ") : null;
  const baseSections = base.sections.map((sec) => {
    const figureNames = sec.figures.map((f, i) => nameFor(sec.key, i, f, null));
    return { key: sec.key, figureNames, html: sectionWith(sec, { figureNames, hidden: hidden.has(sec.key), footerExtra: footerExtraOf(sec), teaches: teachesOf.get(sec.key) }), title: D.titleOf(sec.html) };
  });

  // CSS from the old output file's <head> (not the live page, where the old plugins add their own):
  // Reveal's stylesheet (dropped), the theme, the raw-slide stylesheet and the balance rules, told
  // apart by what they contain.
  const headText = fs.readFileSync(path.join(oldDir, "index.html"), "utf8").split(/<\/head>/i)[0];
  const blocks = [...headText.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const isReveal = (c) => /^\/\*!?\s*\*?\s*reveal\.js\b/.test(c.trim());   // Reveal's stylesheet opens with its licence banner
  const balanceCss = blocks.find((c) => /Balance \(set at load/.test(c)) || "";
  const rawCss = blocks.find((c) => !isReveal(c) && c !== balanceCss && /\.raw-slide/.test(c) && !/:root\s*\{/.test(c)) || "";
  const themeCss = blocks.find((c) => !isReveal(c) && c !== balanceCss && c !== rawCss && /:root\s*\{/.test(c)) || "";
  if (!themeCss) report.notes.push("no theme CSS found in the old output's <head>");
  let brandRef = brand;
  if (brand) {
    const t = require("./theme").themeFor(brand);   // throws when brandware doesn't have it
    if (themeCss && !/slideware\.css \*\//.test(t.css)) report.notes.push(`brand ${t.brand} has no css/slideware.css, so the old theme's look isn't carried over; the comparison shows how far off it is`);
    report.brand = t.brand;
  } else {
    kitDir = path.resolve(kitDir || path.join(out, "brand-kit"));
    fs.mkdirSync(path.join(kitDir, "css"), { recursive: true });
    fs.mkdirSync(path.join(kitDir, "assets"), { recursive: true });
    fs.copyFileSync(path.join(oldDir, "style.md"), path.join(kitDir, "brand.md"));
    for (const f of ["logo-light.svg", "logo-dark.svg"]) if (fs.existsSync(path.join(oldDir, "assets", f))) fs.copyFileSync(path.join(oldDir, "assets", f), path.join(kitDir, "assets", f));
    // The old CSS was written on top of Reveal, which set the page's line-height to 1, its text to
    // black and every shown slide to display: flex (Reveal's display option). That baseline comes
    // first, so the old rules override it exactly as they did.
    const baseline = "/* What Reveal set under the old deck's rules. */\nsection[data-key] { display: flex; line-height: 1; color: #000; }\n";
    fs.writeFileSync(path.join(kitDir, "css", "slideware.css"), `/* Brand kit for slideware decks: ${path.basename(path.dirname(oldDir))}'s theme, converted by migrate.js. */\n${baseline}\n${convertCss(themeCss).trim()}\n`);
    report.kit = kitDir;
    brandRef = path.join(kitDir, "brand.md");
  }

  // The new deck.
  const config = {
    title: deckSpec.title || base.title, footer: cfgFooter, sessions: deckSpec.sessions || (deckSpec.minutes ? { "": deckSpec.minutes } : {}),
    lanes: [], ...(deckSpec.spec ? { spec: path.relative(out, path.resolve(oldDir, deckSpec.spec)) } : {}),
    ...(deckSpec.lane ? { laneName: deckSpec.lane } : {}),
  };
  const slidesHtml = "\n" + baseSections.map((s) => `<!-- ${s.key}${s.title ? " · " + s.title.replace(/--/g, "—") : ""} -->\n${s.html}`).join("\n\n") + "\n";
  let text = build.newDeck({ brand: brandRef, title: config.title, slides: slidesHtml.trim() });
  text = D.spliceRegion(text, "sw-deck", "\n" + JSON.stringify(config, null, 2) + "\n");
  const deckCss = [rawCss && `/* Raw slides (the old deck's stylesheet), converted. */\n${convertCss(rawCss).trim()}`, balanceCss && `/* Balance, as the old load-time pass left it. */\n${convertCss(balanceCss).trim()}`].filter(Boolean).join("\n\n");
  text = D.spliceRegion(text, "sw-deck-css", `\n${deckCss}\n`);
  const ar = D.region(text, "sw-assets");
  const sprites = base.defs.map((d) => d.replace(/^<svg\b/, '<svg data-asset="icons" data-inline'));
  text = D.spliceRegion(text, "sw-assets", ar.content + [...sprites, ...[...assets.values()].map((a) => a.svg)].join("\n") + "\n");
  fs.mkdirSync(out, { recursive: true });
  const outFile = path.join(out, "index.html");
  fs.writeFileSync(outFile, text);

  // Lanes.
  const baseByKey = new Map(baseSections.map((s) => [s.key, s]));
  for (const l of laneData) {
    let old = {};
    try { delete require.cache[require.resolve(l.overlayPath)]; old = require(l.overlayPath); } catch (e) { report.notes.push(`lane ${l.id}: couldn't read ${l.overlayPath}`); }
    const overlay = { name: old.name || l.id, ...(old.color ? { color: old.color } : {}), replace: old.replace || [], figures: {}, overrides: [] };
    const laneSecs = l.data.sections.map((sec) => {
      const figureNames = sec.figures.map((f, i) => nameFor(sec.key, i, f, l.id));
      return { key: sec.key, figureNames, html: sectionWith(sec, { figureNames, hidden: hidden.has(sec.key), footerExtra: footerExtraOf(sec), teaches: teachesOf.get(sec.key) }) };
    });
    for (const ls of laneSecs) {
      const b = baseByKey.get(ls.key);
      if (!b) { overlay.overrides.push({ key: ls.key, slide: ls.html, note: "slide only in this lane" }); continue; }
      ls.figureNames.forEach((n, i) => { if (b.figureNames[i] && b.figureNames[i] !== n) overlay.figures[b.figureNames[i]] = n; });
      let expect = L.replaceText(b.html, overlay.replace);
      for (const [from, to] of Object.entries(overlay.figures)) expect = expect.split(`data-figure-ref="${from}"`).join(`data-figure-ref="${to}"`);
      if (expect !== ls.html) overlay.overrides.push({ key: ls.key, slide: ls.html });
    }
    if (!Object.keys(overlay.figures).length) delete overlay.figures;
    fs.mkdirSync(path.join(out, "lanes"), { recursive: true });
    fs.writeFileSync(path.join(out, "lanes", `${l.id}.json`), JSON.stringify(overlay, null, 2) + "\n");
    report.notes.push(`lane ${l.id}: ${overlay.replace.length} replacement${overlay.replace.length === 1 ? "" : "s"}, ${Object.keys(overlay.figures || {}).length} figure swap(s), ${overlay.overrides.length} whole-slide override(s)`);
  }
  // Add the lane-only figures to the asset block (they were named while reading the lanes).
  text = fs.readFileSync(outFile, "utf8");
  const have = new Set(D.assets(text).map((a) => a.name));
  const missing = [...assets.values()].filter((a) => !have.has(a.name));
  if (missing.length) {
    const r = D.region(text, "sw-assets");
    text = D.spliceRegion(text, "sw-assets", r.content + missing.map((a) => a.svg).join("\n") + "\n");
    fs.writeFileSync(outFile, text);
  }
  report.figures = assets.size;
  report.slides = baseSections.length;
  report.replaces = ["slides.js", "build-deck.js", "presenter.js", "review.js", "package.json", "package-lock.json", "node_modules", "style.md", "raw", "personas", "index.html", "index.review.html", ...laneFiles.flatMap((l) => [`index-${l.id}.html`, `index-${l.id}.review.html`])]
    .filter((f) => fs.existsSync(path.join(oldDir, f)));
  return report;
}

// Per-slide pixel difference between the old output and the new deck, in a browser canvas.
async function compare(oldFile, newFile, { browser: given, threshold = 0.02 } = {}) {
  const { launch } = require("./cdp");
  const browser = given || await launch();
  const rows = [];
  try {
    const shots = async (file, mode) => {
      const page = await browser.newPage({ width: 1280, height: 720 });
      const map = new Map();
      if (mode === "old") {
        const tmp = file.replace(/\.html$/, `.cmp-tmp-${process.pid}.html`);
        fs.writeFileSync(tmp, fs.readFileSync(file, "utf8"));
        try {
          await page.goto(pathToFileURL(tmp).href);
          await page.evaluate(`(async () => { await (document.fonts ? document.fonts.ready : 0); const s = document.createElement("style");
            s.textContent = "[data-a]{animation:none!important} .rp-hud,.progress,.rv-bar{display:none!important} .reveal .slides section{transition:none!important}";
            document.head.appendChild(s); Reveal.configure({ transition: "none", progress: false, margin: 0 }); Reveal.layout(); await new Promise(r => setTimeout(r, 600)); })()`);
          const keys = await page.evaluate(`Reveal.getSlides().map(s => s.dataset.key)`);
          for (let i = 0; i < keys.length; i++) {
            await page.evaluate(`(async () => { Reveal.slide(${i}); const f = Reveal.getCurrentSlide().querySelectorAll(".fragment"); f.forEach(x => x.classList.add("visible")); await new Promise(r => setTimeout(r, 120)); })()`);
            map.set(keys[i], (await page.screenshot()).toString("base64"));
          }
        } finally { fs.rmSync(tmp, { force: true }); }
      } else {
        await page.goto(pathToFileURL(file).href + "?capture");
        await page.evaluate("new Promise(r => SW.ready(() => setTimeout(r, 300)))");
        const keys = await page.evaluate(`SW.slides().map(s => s.dataset.key)`);
        for (let i = 0; i < keys.length; i++) {
          await page.evaluate(`(async () => { SW.go(${i}, "end"); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
          map.set(keys[i], (await page.screenshot()).toString("base64"));
        }
      }
      await page.close();
      return map;
    };
    const a = await shots(oldFile, "old"), b = await shots(newFile, "new");
    const cmp = await browser.newPage({ width: 200, height: 200 });
    await cmp.goto("about:blank");
    for (const [key, imgA] of a) {
      const imgB = b.get(key);
      if (!imgB) { rows.push({ key, diff: null, note: "not in the new deck" }); continue; }
      const diff = await cmp.evaluate(`(async () => {
        const load = (src) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + src; });
        const [x, y] = await Promise.all([load(${JSON.stringify(imgA)}), load(${JSON.stringify(imgB)})]);
        const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(x, 0, 0); const da = g.getImageData(0, 0, 1280, 720).data;
        g.clearRect(0, 0, 1280, 720); g.drawImage(y, 0, 0); const db = g.getImageData(0, 0, 1280, 720).data;
        let n = 0; for (let i = 0; i < da.length; i += 4) { if (Math.abs(da[i] - db[i]) + Math.abs(da[i+1] - db[i+1]) + Math.abs(da[i+2] - db[i+2]) > 48) n++; }
        return n / (1280 * 720);
      })()`);
      rows.push({ key, diff, ok: diff <= threshold, a: imgA, b: imgB });
    }
    await cmp.close();
  } finally { if (!given) await browser.close(); }
  return rows;
}

module.exports = { migrate, compare, convertCss };
