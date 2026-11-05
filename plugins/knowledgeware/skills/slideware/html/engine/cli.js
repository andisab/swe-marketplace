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
//   node cli.js migrate <old-deck-dir> [--out dir] [--brand name | --kit dir] [--no-rebuild] [--no-compare] [--threshold 0.02]
//   node cli.js import <file.pptx> [--out dir] [--mode redesign|faithful] [--brand name]
//   node cli.js serve <index.html> [--port N] [--open]      local server: edit and save in any browser (first free port from 47100)
//   node cli.js catalog [--json]                            the slide pattern catalogue: name, title, the idea each expresses
//   node cli.js pattern <name>                              print a pattern's file (metadata, CSS, example slides)
//   node cli.js gallery <out.html> [--brand <name>]         a deck of every pattern's examples, for browsing
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

  async migrate({ pos, opt }) {
    const { migrate, compare } = require("./migrate");
    const oldDir = path.resolve(pos[0] || ".");
    const r = await migrate(oldDir, { out: opt.out, brand: opt.brand, kitDir: opt.kit, rebuild: !opt["no-rebuild"] });
    const file = path.join(r.out, "index.html");
    console.log(`Wrote ${rel(file)}: ${r.slides} slides, ${r.figures} figures. ${r.brand ? `Brand: ${r.brand}` : `Brand kit: ${rel(r.kit)} (move it into the brands directory, then refresh --brand <name>)`}`);
    r.notes.forEach((n) => console.log(`  ${n}`));
    await commands.lanes({ pos: [file], opt: {} });
    if (!opt["no-compare"]) {
      const reportDir = path.join(r.out, "migrate-report");
      fs.mkdirSync(reportDir, { recursive: true });
      const pairs = [["index.html", "index.html"]].concat(fs.readdirSync(r.out).filter((f) => /^index-.+\.html$/.test(f)).map((f) => [f, f]));
      let worst = 0, over = 0, total = 0;
      for (const [o, n] of pairs) {
        if (!fs.existsSync(path.join(oldDir, o))) continue;
        const rows = await compare(path.join(oldDir, o), path.join(r.out, n), { threshold: Number(opt.threshold) || 0.02 });
        for (const row of rows) {
          total++;
          if (row.diff === null) { console.log(`  ${o} ${row.key}: ${row.note}`); continue; }
          worst = Math.max(worst, row.diff);
          if (!row.ok) {
            over++;
            const stem = `${o.replace(/\.html$/, "")}-${row.key}`.replace(/[^\w.-]/g, "_");
            fs.writeFileSync(path.join(reportDir, `${stem}-old.png`), Buffer.from(row.a, "base64"));
            fs.writeFileSync(path.join(reportDir, `${stem}-new.png`), Buffer.from(row.b, "base64"));
          }
          console.log(`  ${o.padEnd(28)} ${row.key.padEnd(14)} ${(row.diff * 100).toFixed(2).padStart(6)}% ${row.ok ? "" : " over"}`);
        }
      }
      console.log(`Compared ${total} slides: ${over} over the threshold, worst ${(worst * 100).toFixed(2)}%. Images of those: ${rel(reportDir)}`);
    }
    console.log("Once reviewed, these old files are replaced by the new folder:\n  " + r.replaces.join("\n  "));
  },

  async import({ pos, opt }) {
    const { importPptx } = require("./import");
    if (!pos[0] || !/\.pptx$/i.test(pos[0])) throw new Error("name a .pptx file to import");
    const r = await importPptx(pos[0], { out: opt.out, mode: opt.mode || "redesign", brand: opt.brand });
    console.log(`Imported ${r.slides} slides (${r.mode}) into ${rel(r.out)}; see import-ledger.md there.`);
  },

  async catalog({ opt }) {
    const all = require("./catalog").list();
    if (opt.json) { console.log(JSON.stringify(all.map(({ css, examples, ...p }) => ({ ...p, examples: examples.length })), null, 2)); return; }
    for (const p of all) console.log(`${p.name.padEnd(16)} ${p.title}${p.origin === "home" ? "  (yours)" : ""}\n${"".padEnd(17)}${p.idea}`);
    console.log(`\n${all.length} patterns. Plugin: ${rel(require("../../../../scripts/home.js").catalogDirs("slideware")[0])} · yours: ${rel(require("../../../../scripts/home.js").catalogDirs("slideware")[1])}`);
  },
  async pattern({ pos }) {
    const p = require("./catalog").get(pos[0]);
    if (!p) throw new Error(`no pattern "${pos[0]}"; run catalog for the list`);
    console.log(`${rel(p.file)}\n\n${fs.readFileSync(p.file, "utf8")}`);
  },
  async gallery({ pos, opt }) {
    if (!pos[0]) throw new Error("gallery <out.html> [--brand <name>]");
    const all = require("./catalog").list();
    let n = 0;
    const slides = all.flatMap((p) => p.examples.map((ex) => {
      n++;
      const key = `g${String(n).padStart(2, "0")}-${p.name}`;
      return `<!-- ${key} · ${p.title} -->\n` + ex.replace(/data-key="[^"]*"/, `data-key="${key}"`).replace(/(<section\b[^>]*?)(\s*>)/, (m, a, b) => /data-footer=/.test(a) ? m : `${a} data-footer="${p.name}"${b}`);
    }));
    const out = path.resolve(pos[0]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, build.newDeck({ brand: opt.brand || "style-1", title: "Slide pattern catalogue", footer: ["Slide pattern catalogue"], slides: slides.join("\n\n") }));
    console.log(`Wrote ${rel(out)}: ${n} example slides from ${all.length} patterns${opt.brand ? ` in ${opt.brand}` : ""}.`);
  },
  async serve({ pos, opt }) {
    const file = deckPath(pos[0]);
    const { serve } = require("./serve");
    build.installEditor();
    // A named port is used as is; otherwise the first free one from 47100, so several decks can be served at once.
    let server = null;
    for (let port = Number(opt.port) || 47100, tries = opt.port ? 1 : 20; tries > 0 && !server; port++, tries--) {
      try { server = await serve(path.dirname(file), { port }); } catch (e) { if (e.code !== "EADDRINUSE" || tries === 1) throw e; }
    }
    const url = `http://127.0.0.1:${server.address().port}/${path.basename(file)}`;
    console.log(`Serving ${rel(path.dirname(file))} at ${url} (Ctrl+C stops it). Press E in the deck to edit; saving needs no folder permission here.`);
    if (opt.open) require("child_process").spawn(process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open", [url], { stdio: "ignore", detached: true }).unref();
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
    console.log("usage: node cli.js <new|refresh|check|outline|slide|lanes|export|import|migrate|serve|install-editor> …  (see the top of cli.js)");
    process.exitCode = cmd ? 1 : 0;
    return;
  }
  try { await commands[cmd](parseArgs(rest)); }
  catch (e) { console.error(`slideware: ${e.message}`); process.exitCode = 1; }
})();

module.exports = { parseArgs };
