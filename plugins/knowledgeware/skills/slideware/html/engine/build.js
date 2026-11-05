// build.js — assemble and refresh slideware deck files.
//
//   newDeck({ brand, title, … })      → the text of a new index.html
//   refreshDeck(text, { brand })       → the deck with its runtime, loader and brand brought up to date
//   installEditor()                    → copies the editor into the plugin's persistent data folder
// The runtime, the loader and the brand are copies inside each deck, so a shared file is
// self-contained; these functions keep those copies current. Nothing else in the file changes.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const D = require("./deckfile");
const theme = require("./theme");
const catalog = require("./catalog");

const HTML_DIR = path.resolve(__dirname, "..");
const PLUGIN_ROOT = path.resolve(HTML_DIR, "..", "..", "..");
const RUNTIME_VERSION = "2.0.0";

function read(rel) { return fs.readFileSync(path.join(HTML_DIR, rel), "utf8"); }
function runtimeJs() { return D.safeScript(read("runtime/deck.js") + "\n" + read("runtime/presenter.js")); }
function loaderJs() { return D.safeScript(read("runtime/loader.js")); }

// The plugin's persistent data folder (survives plugin updates): CLAUDE_PLUGIN_DATA when Claude
// Code sets it, else ~/.claude/plugins/data/<plugin>-<marketplace> worked out from where the plugin
// is installed, or <plugin>-inline for a checkout run with --plugin-dir.
function pluginDataDir() {
  if (process.env.CLAUDE_PLUGIN_DATA) return process.env.CLAUDE_PLUGIN_DATA;
  const m = /[\\/]plugins[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]/.exec(PLUGIN_ROOT + path.sep);
  const name = m ? `${m[2]}-${m[1]}` : `${path.basename(PLUGIN_ROOT)}-inline`;
  return path.join(os.homedir(), ".claude", "plugins", "data", name);
}
function editorTarget() { return path.join(pluginDataDir(), "slideware", "editor.js"); }
function editorUrl() { return pathToFileURL(editorTarget()).href; }
// Copy the editor bundle into the data folder. Returns the path, or null when there's no editor yet.
// The editor as one script: the lane builder, the serializer and the editor itself.
function editorBundle() {
  const src = path.join(HTML_DIR, "editor", "editor.js");
  if (!fs.existsSync(src)) return null;
  const parts = ["runtime/lanes.js", "editor/serialize.js", "editor/editor.js"].map((p) => path.join(HTML_DIR, p));
  return `/* slideware editor ${RUNTIME_VERSION}, copied from the knowledgeware plugin. Replaced on every refresh. */\n` + parts.map((p) => fs.readFileSync(p, "utf8")).join("\n");
}
function installEditor() {
  const bundle = editorBundle();
  if (!bundle) return null;
  const dest = editorTarget();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bundle);
  return dest;
}

const esc = D.escText, escA = D.escAttr;
function headBrandTags(t) {
  return `<link rel="icon" href="${escA(t.favicon)}" data-brand="${escA(t.brand)}">\n` +
    (t.fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com" data-brand="${escA(t.brand)}">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin data-brand="${escA(t.brand)}">\n<link rel="stylesheet" href="${escA(t.fontsUrl)}" data-brand="${escA(t.brand)}">\n` : "");
}
function logoAssets(t) {
  return Object.entries(t.logos).map(([name, svg]) => theme.svgAsset(name, svg)).join("\n");
}

function newDeck({ brand, title = "Untitled deck", subtitle = "", footer = [], sessions = {}, minutes, slides, kit = true } = {}) {
  const t = theme.themeFor(brand);
  const config = { title, footer: [].concat(footer || []), sessions: minutes ? { "": Number(minutes) } : sessions, lanes: [], ...(kit ? {} : { kit: false }) };
  const firstSlides = slides || `<!-- title · ${esc(title)} -->
<section data-key="title" data-chrome="none" class="center">
  <h1>${esc(title)}</h1>${subtitle ? `\n  <p class="lede">${esc(subtitle)}</p>` : ""}
  <aside class="notes">What this deck is for, in one sentence.</aside>
</section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="knowledgeware slideware ${RUNTIME_VERSION}">
<title>${esc(title)}</title>
${headBrandTags(t)}<script type="application/json" id="sw-deck">
${JSON.stringify(config, null, 2)}
</script>
<style id="sw-theme" data-brand="${escA(t.brand)}" data-brand-hash="${t.hash}" data-color-names="${escA(JSON.stringify(t.colorNames || {}))}">
${t.css}</style>
${kitTag(firstSlides, !kit)}
<style id="sw-deck-css">
/* This deck's own CSS, for anything beyond the brand's classes. */
</style>
<script id="sw-runtime" data-version="${RUNTIME_VERSION}">
${runtimeJs()}
</script>
<script id="sw-loader" data-editor="${escA(editorUrl())}">
${loaderJs()}
</script>
</head>
<body>
<main id="sw-slides">
${firstSlides}
</main>
<template id="sw-assets">
${logoAssets(t) ? logoAssets(t) + "\n" : ""}</template>
</body>
</html>
`;
}

// The deck's kit region: core and the catalogue patterns its slides use.
function kitTag(slidesHtml, off) {
  const k = catalog.kitFor(catalog.used(slidesHtml), undefined, { off });
  return `<style id="sw-kit" data-patterns="${escA(k.patterns.join(" "))}">${k.css}</style>`;
}

// Bring a deck's runtime, loader and brand up to date. Returns { text, changes: [...], notes: [...] }.
function refreshDeck(text, { brand, runtime = true, theme: doTheme = true } = {}) {
  const changes = [], notes = [];
  const deck = D.readDeck(text);
  for (const id of ["sw-deck", "sw-theme", "sw-slides", "sw-assets"]) if (!deck.regions[id]) throw new Error(`the deck has no ${id} region; is it a slideware deck?`);
  if (runtime) {
    const rt = runtimeJs();
    if (!deck.regions["sw-runtime"]) throw new Error("the deck has no sw-runtime region");
    if (deck.regions["sw-runtime"].content.trim() !== rt.trim()) { text = D.spliceRegion(text, "sw-runtime", `\n${rt}\n`, { "data-version": RUNTIME_VERSION }); changes.push(`runtime ${RUNTIME_VERSION}`); }
    const ld = loaderJs(), url = editorUrl(), lr = D.region(text, "sw-loader");
    if (!lr) throw new Error("the deck has no sw-loader region");
    if (lr.content.trim() !== ld.trim() || lr.attrs["data-editor"] !== url) { text = D.spliceRegion(text, "sw-loader", `\n${ld}\n`, { "data-editor": url }); changes.push("loader"); }
  }
  // The kit: core and the patterns the slides use now (added after the theme in a deck that predates it).
  if (doTheme) {
    const slides = D.region(text, "sw-slides").content;
    const off = (D.readDeck(text).config || {}).kit === false;
    const k = catalog.kitFor(catalog.used(slides), undefined, { off });
    const kr = D.region(text, "sw-kit");
    if (!kr) { const th = D.region(text, "sw-theme"); text = text.slice(0, th.end) + "\n" + kitTag(slides, off) + text.slice(th.end); changes.push(off ? "kit (off)" : `kit (${k.patterns.join(", ")})`); }
    else if (kr.content !== k.css || kr.attrs["data-patterns"] !== k.patterns.join(" ")) { text = D.spliceRegion(text, "sw-kit", k.css, { "data-patterns": k.patterns.join(" ") }); changes.push(off ? "kit (off)" : `kit (${k.patterns.join(", ")})`); }
  }
  if (doTheme) {
    const current = D.region(text, "sw-theme");
    const name = brand || current.attrs["data-brand"];
    let t = null;
    try { t = theme.themeFor(name); } catch (e) { notes.push(`brand "${name}" isn't on this machine; the deck keeps its copy`); }
    if (t && (brand || t.hash !== current.attrs["data-brand-hash"])) {
      text = D.spliceRegion(text, "sw-theme", `\n${t.css}`, { "data-brand": t.brand, "data-brand-hash": t.hash, "data-color-names": JSON.stringify(t.colorNames || {}) });
      // favicon and fonts links tagged with the brand
      text = text.replace(/<link\b[^>]*\bdata-brand=["'][^"']*["'][^>]*>\n?/gi, "");
      text = text.replace(/(<script type="application\/json" id="sw-deck">)/i, headBrandTags(t) + "$1");
      // logo assets
      const ar = D.region(text, "sw-assets");
      let assetsHtml = ar.content;
      for (const name of ["logo", "logo-light", "logo-dark"]) {
        const m = new RegExp(`<svg\\b[^>]*\\bdata-asset=["']${name}["']`, "i").exec(assetsHtml);
        if (m) { const el = require("../runtime/lanes").elementAt(assetsHtml, m.index); if (el) assetsHtml = assetsHtml.slice(0, el.start) + assetsHtml.slice(el.end).replace(/^\n/, ""); }
      }
      assetsHtml = assetsHtml.replace(/^\n*/, "\n" + (logoAssets(t) ? logoAssets(t) + "\n" : ""));
      text = D.spliceRegion(text, "sw-assets", assetsHtml);
      changes.push(`brand ${t.brand} (${t.hash})`);
    }
  }
  return { text, changes, notes };
}

module.exports = { RUNTIME_VERSION, HTML_DIR, PLUGIN_ROOT, newDeck, refreshDeck, installEditor, editorBundle, pluginDataDir, editorTarget, editorUrl, runtimeJs, loaderJs };
