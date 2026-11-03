#!/usr/bin/env node
// cli.js — the slideware engine. One command line for everything a deck needs from the plugin.
//
//   node cli.js new <dir> --brand <name> [--title T] [--subtitle S] [--footer "A|B"] [--minutes N] [--force]
//   node cli.js refresh <index.html> [--brand <name>]      runtime, loader and brand up to date
//   node cli.js check <index.html> [--render]               settings, slides, assets, pacing, brand, lanes…
//   node cli.js outline <index.html>                        slide keys, titles and line ranges
//   node cli.js slide <index.html> <key>                    print one slide's HTML
//   node cli.js lanes <index.html>                          rebuild index-<lane>.html from lanes/*.json
//   node cli.js export <index.html> --png [dir] [--scale 2] [--all] | --pdf [file] | --pptx [file] [--level 0|1]
//   node cli.js install-editor                              copy the editor into the plugin's data folder
// Exit code 1 when check finds errors.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const D = require("./deckfile");
const build = require("./build");

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) opt[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}
function deckPath(p) {
  if (!p) throw new Error("name the deck file (index.html) or its folder");
  const full = path.resolve(p);
  const file = fs.existsSync(full) && fs.statSync(full).isDirectory() ? path.join(full, "index.html") : full;
  if (!fs.existsSync(file)) throw new Error(`${file} doesn't exist`);
  return file;
}
function rel(p) { return path.relative(process.cwd(), p) || p; }
function printReport(r) {
  r.errors.forEach((l) => console.log(`error   ${l}`));
  r.warnings.forEach((l) => console.log(`warning ${l}`));
  r.info.forEach((l) => console.log(l.startsWith("  ") ? `        ${l.trim()}` : `info    ${l}`));
}

const commands = {
  async new({ pos, opt }) {
    const dir = path.resolve(pos[0] || ".");
    const file = dir.endsWith(".html") ? dir : path.join(dir, "index.html");
    if (fs.existsSync(file) && !opt.force) throw new Error(`${rel(file)} already exists (--force to replace it)`);
    if (!opt.brand) {
      const registry = require(path.join(build.PLUGIN_ROOT, "scripts", "registry.js"));
      opt.brand = registry.defaultBrand(path.dirname(file)) || "style-1";
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const footer = typeof opt.footer === "string" ? opt.footer.split("|").map((s) => s.trim()).filter(Boolean) : [];
    fs.writeFileSync(file, build.newDeck({ brand: opt.brand, title: opt.title || "Untitled deck", subtitle: opt.subtitle || "", footer, minutes: opt.minutes }));
    const ed = build.installEditor();
    console.log(`Wrote ${rel(file)} (brand ${opt.brand}).${ed ? "" : " No editor installed yet."}`);
  },

  async refresh({ pos, opt }) {
    const file = deckPath(pos[0]);
    const r = build.refreshDeck(fs.readFileSync(file, "utf8"), { brand: opt.brand });
    const ed = build.installEditor();
    if (r.changes.length) fs.writeFileSync(file, r.text);
    console.log(r.changes.length ? `Refreshed ${rel(file)}: ${r.changes.join(", ")}.` : `${rel(file)} is up to date.`);
    r.notes.forEach((n) => console.log(`note: ${n}`));
    if (ed) console.log(`Editor: ${ed}`);
    if (fs.existsSync(path.join(path.dirname(file), "lanes"))) await commands.lanes({ pos: [file], opt: {} });
  },

  async check({ pos, opt }) {
    const file = deckPath(pos[0]);
    const { check, render } = require("./check");
    const r = check(file);
    if (opt.render) {
      const b = await render(file);
      r.errors.push(...b.errors); r.warnings.push(...b.warnings); r.info.push(...b.info);
    }
    printReport(r);
    console.log(`${r.errors.length} error${r.errors.length === 1 ? "" : "s"}, ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}`);
    if (r.errors.length) process.exitCode = 1;
  },

  async outline({ pos }) {
    const file = deckPath(pos[0]);
    const deck = D.readDeck(fs.readFileSync(file, "utf8"));
    const w = String(deck.slides.length).length;
    deck.slides.forEach((s, i) => console.log(`${String(i + 1).padStart(w)}  ${(s.key || "(no key)").padEnd(14)} lines ${s.lines[0]}-${s.lines[1]}${s.hidden ? "  [hidden]" : ""}  ${s.title}`));
    for (const id of ["sw-deck", "sw-theme", "sw-deck-css", "sw-assets"]) {
      const r = deck.regions[id];
      if (r) console.log(`${id.padEnd(12)} lines ${lineOf(deck.text, r.start)}-${lineOf(deck.text, r.end)}`);
    }
  },

  async slide({ pos }) {
    const file = deckPath(pos[0]);
    const deck = D.readDeck(fs.readFileSync(file, "utf8"));
    const s = deck.slides.find((x) => x.key === pos[1]);
    if (!s) throw new Error(`no slide with the key "${pos[1]}". Keys: ${deck.slides.map((x) => x.key).join(", ")}`);
    console.log(`<!-- lines ${s.lines[0]}-${s.lines[1]} -->`);
    console.log(s.text);
  },

  async lanes({ pos }) {
    const file = deckPath(pos[0]);
    const { lanesOf } = require("./check");
    const Lanes = require("../runtime/lanes");
    let text = fs.readFileSync(file, "utf8");
    const lanes = lanesOf(file);
    if (!lanes.length) { console.log("No lanes (lanes/*.json beside the deck)."); return; }
    const deck = D.readDeck(text);
    const cfg = deck.config || {};
    const list = [{ id: "", name: cfg.laneName || "Base", file: "index.html" }].concat(lanes.filter((l) => l.overlay).map((l) => ({ id: l.id, name: l.overlay.name || l.id, color: l.overlay.color || null, file: `index-${l.id}.html` })));
    if (JSON.stringify(cfg.lanes || []) !== JSON.stringify(list)) {   // the base's switcher list follows the lanes folder
      text = D.spliceRegion(text, "sw-deck", "\n" + JSON.stringify({ ...cfg, lanes: list }, null, 2) + "\n");
      fs.writeFileSync(file, text);
    }
    for (const l of lanes) {
      if (l.error) { console.log(`lanes/${l.id}.json isn't valid JSON: ${l.error}`); process.exitCode = 1; continue; }
      const r = Lanes.applyLane(text, l.overlay, l.id, list, Lanes.sourceStamp(text, l.text));
      fs.writeFileSync(l.out, r.text);
      console.log(`Wrote ${rel(l.out)}: ${r.changed.length} slide${r.changed.length === 1 ? "" : "s"} differ from the base` +
        (r.missing.length ? `; ${r.missing.length} override${r.missing.length === 1 ? "" : "s"} match nothing` : ""));
    }
  },

  async export({ pos, opt }) {
    const file = deckPath(pos[0]);
    const exp = require("./export");
    if (opt.png) {
      const dir = typeof opt.png === "string" ? path.resolve(opt.png) : path.join(path.dirname(file), "export", "png");
      const files = await exp.png(file, dir, { scale: Number(opt.scale) || 2, all: !!opt.all });
      console.log(`Wrote ${files.length} PNGs to ${rel(dir)}`);
    }
    if (opt.pdf) {
      const out = typeof opt.pdf === "string" ? path.resolve(opt.pdf) : file.replace(/\.html$/, ".pdf");
      await exp.pdf(file, out);
      console.log(`Wrote ${rel(out)}`);
    }
    if (opt.pptx) {
      const out = typeof opt.pptx === "string" ? path.resolve(opt.pptx) : file.replace(/\.html$/, ".pptx");
      const r = await exp.pptx(file, out, { level: opt.level === undefined ? 1 : Number(opt.level) });
      console.log(`Wrote ${rel(out)} (${r.slides} slides, level ${r.level}); fidelity ledger ${rel(r.ledger)}`);
    }
    if (!opt.png && !opt.pdf && !opt.pptx) throw new Error("say what to export: --png, --pdf or --pptx");
  },

  async "install-editor"() {
    const p = build.installEditor();
    console.log(p ? `Editor: ${p}` : "No editor in this plugin version.");
  },
};
function lineOf(text, pos) { let n = 1; for (let i = 0; i < pos; i++) if (text.charCodeAt(i) === 10) n++; return n; }

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) {
    console.log("usage: node cli.js <new|refresh|check|outline|slide|lanes|export|install-editor> …  (see the top of cli.js)");
    process.exitCode = cmd ? 1 : 0;
    return;
  }
  try { await commands[cmd](parseArgs(rest)); }
  catch (e) { console.error(`slideware: ${e.message}`); process.exitCode = 1; }
})();

module.exports = { parseArgs };
