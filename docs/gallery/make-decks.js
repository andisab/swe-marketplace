#!/usr/bin/env node
// make-decks.js — the README's deck images, built with slideware's own engine.
//
//   NODE_OPTIONS= node docs/gallery/make-decks.js <scratch-dir> [--images]
//
// Builds three decks from decks/style-{1,3,5}.html (slide markup written with the catalogue's
// patterns; the first line's comment names the style, title, footer and minutes), with the chart
// figures from charts/ (or chartware's templates) in each deck's asset block. Then it exports every
// slide as a picture, photographs the presenter view on style-1's big-number slide, lays out
// decks-sheet.html and presenter-sheet.html, and with --images writes docs/images/decks.jpg and
// presenter.jpg. Needs Node 22+ and Chrome; nothing is installed.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const HTML = path.join(ROOT, "plugins", "knowledgeware", "skills", "slideware", "html");
const build = require(path.join(HTML, "engine", "build.js"));
const D = require(path.join(HTML, "engine", "deckfile.js"));
const { launch } = require(path.join(HTML, "engine", "cdp.js"));
const CLI = path.join(HTML, "engine", "cli.js");

const out = path.resolve(process.argv[2] || "");
if (!process.argv[2]) { console.error("usage: node docs/gallery/make-decks.js <scratch-dir> [--images]"); process.exit(1); }
const images = process.argv.includes("--images");
fs.mkdirSync(path.join(out, "shots"), { recursive: true });

function figureSvg(name) {
  for (const dir of [path.join(__dirname, "charts"), path.join(ROOT, "plugins", "knowledgeware", "skills", "chartware", "templates", "svg")]) {
    const f = path.join(dir, `${name}.svg`);
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").replace(/<\?xml[^>]*>\s*/, "").replace(/^<svg\b/, `<svg data-figure="${name}"`).trim();
  }
  throw new Error(`no chart ${name}.svg`);
}

const decks = [];
for (const n of [1, 3, 5]) {
  const src = fs.readFileSync(path.join(__dirname, "decks", `style-${n}.html`), "utf8");
  const head = /<!--\s*deck:\s*(\S+)\s*·\s*title:\s*(.*?)\s*·\s*footer:\s*(.*?)\s*·\s*minutes:\s*(\d+)\s*-->/.exec(src);
  const slides = src.slice(head.index + head[0].length).trim();
  let text = build.newDeck({ brand: head[1], title: head[2], footer: [head[3]], minutes: Number(head[4]), slides });
  const figs = [...new Set([...slides.matchAll(/data-figure-ref="([^"]+)"/g)].map((m) => m[1]))];
  if (figs.length) text = D.spliceRegion(text, "sw-assets", D.region(text, "sw-assets").content + figs.map(figureSvg).join("\n") + "\n");
  const file = path.join(out, `deck-style-${n}`, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const env = { ...process.env, NODE_OPTIONS: "" };
  const check = execFileSync(process.execPath, [CLI, "check", file, "--render"], { env, encoding: "utf8" }).trim().split("\n").pop();
  execFileSync(process.execPath, [CLI, "export", file, "--png", path.join(out, "shots", `s${n}`)], { env });
  console.log(`style-${n}: ${check}`);
  decks.push({ n, file });
}

// The sheets: six slides from the three decks, and the big-number slide beside its presenter view.
const pick = [["s1", "02-speed"], ["s3", "02-part-1"], ["s5", "05-roadmap"], ["s1", "05-engineer"], ["s3", "03-load"], ["s5", "03-levers"]];
for (const [dir, f] of pick) fs.copyFileSync(path.join(out, "shots", dir, `${f}.png`), path.join(out, "shots", `${dir}-${f}.png`));
fs.copyFileSync(path.join(__dirname, "decks-sheet.html"), path.join(out, "decks-sheet.html"));
fs.copyFileSync(path.join(__dirname, "presenter-sheet.html"), path.join(out, "presenter-sheet.html"));

(async () => {
  const b = await launch();
  const main = await b.newPage({ width: 1280, height: 720, scale: 2 });
  await main.goto(require("url").pathToFileURL(decks[0].file).href + "?capture#/speed");
  await main.evaluate("new Promise((r) => SW.ready(r))");
  fs.writeFileSync(path.join(out, "shots", "pres-main.png"), await main.screenshot());
  const pres = await b.newPage({ width: 1280, height: 800, scale: 2 });
  await pres.goto(require("url").pathToFileURL(decks[0].file).href + "?presenter#/speed");
  await new Promise((r) => setTimeout(r, 1500));
  fs.writeFileSync(path.join(out, "shots", "pres-view.png"), await pres.screenshot());
  for (const sheet of ["decks", "presenter"]) {
    const p = await b.newPage({ width: 1600, height: 900 });
    await p.goto(require("url").pathToFileURL(path.join(out, `${sheet}-sheet.html`)).href);
    await new Promise((r) => setTimeout(r, 500));
    const h = await p.evaluate("Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)");
    const jpg = await p.screenshot({ format: "jpeg", quality: 82, clip: { x: 0, y: 0, width: 1600, height: h } });
    fs.writeFileSync(path.join(out, `${sheet}.jpg`), jpg);
    if (images) fs.writeFileSync(path.join(ROOT, "docs", "images", `${sheet}.jpg`), jpg);
    console.log(`${sheet}.jpg ${Math.round(jpg.length / 1024)} KB${images ? " → docs/images/" : ""}`);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
