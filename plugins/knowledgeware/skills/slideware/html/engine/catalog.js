// catalog.js — slideware's pattern catalogue: slide ideas that decks build from.
//
// A pattern is one file, <catalog>/<name>.html:
//   <!-- pattern                         metadata, one "key: value" per line
//   name: steps                          the pattern's class is layout-<name>
//   title: Numbered steps with a side panel
//   idea: what the slide expresses        use: when it fits      avoid: when it doesn't
//   builds: how its clicks usually go    from: where it was proven (optional)
//   -->
//   <style> … </style>                   its CSS, scoped under .layout-<name>, written against the
//                                         brand's tokens (core names, other names with a fallback)
//   <section data-key="…" class="layout-<name>"> … </section>   one or more examples
//
// core.html holds the base typography and the parts every pattern uses (kicker, lede, lesson strip,
// figure notes, sources line, breadcrumb chip); it is always included. The catalogue ships with the
// plugin (html/catalog/) and the user's own sits in the knowledgeware home (slideware/catalog/); a
// home pattern shadows a plugin pattern of the same name. Patterns are ideas, not a closed set: a
// deck may adapt one, combine them, or invent its own in the deck's CSS.
//
// In a deck, the CSS of core and of every pattern the slides use (by their layout-<name> class) is
// copied into <style id="sw-kit">, inside @layer sw-kit, by `new` and `refresh`. A deck whose brand and
// own CSS already style every slide (a converted deck) sets "kit": false and gets none. The brand's
// slideware.css sits in @layer sw-brand above it, so the brand wins where they differ; the deck's own
// CSS and a slide's <style> are unlayered and win over both.
"use strict";
const fs = require("fs");
const path = require("path");
const home = require(path.join(__dirname, "..", "..", "..", "..", "scripts", "home.js"));

const LAYERS = "@layer sw-defaults, sw-kit, sw-brand;";

function parse(file, origin) {
  const text = fs.readFileSync(file, "utf8");
  const meta = {};
  const m = /^\s*<!--\s*pattern\b([\s\S]*?)-->/.exec(text);
  if (m) for (const line of m[1].split("\n")) { const kv = /^\s*([a-z]+)\s*:\s*(.*\S)\s*$/i.exec(line); if (kv) meta[kv[1].toLowerCase()] = kv[2]; }
  const name = meta.name || path.basename(file, ".html");
  const css = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((s) => s[1].trim()).join("\n");
  const examples = [...text.matchAll(/<section\b[\s\S]*?<\/section>/gi)].map((s) => s[0]);
  return { name, title: meta.title || name, idea: meta.idea || "", use: meta.use || "", avoid: meta.avoid || "", builds: meta.builds || "", from: meta.from || "", file, origin, css, examples };
}

// Every pattern, plugin first, home shadowing by name; core first.
function list() {
  const found = new Map();
  home.catalogDirs("slideware").forEach((dir, i) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith(".html")) { const p = parse(path.join(dir, f), i === 0 ? "plugin" : "home"); found.set(p.name, p); }
  });
  return [...found.values()].sort((a, b) => (a.name === "core" ? -1 : b.name === "core" ? 1 : a.name.localeCompare(b.name)));
}
function get(name) { return list().find((p) => p.name === name) || null; }

// The patterns a deck's slides use: their layout-<name> classes that name a catalogue pattern.
function used(slidesHtml, all = list()) {
  const names = new Set(all.map((p) => p.name));
  const out = new Set();
  for (const m of String(slidesHtml).matchAll(/class\s*=\s*["']([^"']*)["']/gi)) for (const c of m[1].split(/\s+/)) { const k = /^layout-([\w-]+)$/.exec(c); if (k && names.has(k[1])) out.add(k[1]); }
  return [...out].sort();
}

// The deck's kit: core plus the named patterns, in @layer sw-kit. Returns { css, patterns }.
function kitFor(names, all = list(), { off = false } = {}) {
  if (off) return { patterns: [], css: "\n/* Catalogue CSS off (\"kit\": false in the settings): the brand and the deck's own CSS style every slide. */\n" };
  const byName = new Map(all.map((p) => [p.name, p]));
  const chosen = ["core", ...names.filter((n) => n !== "core")].filter((n) => byName.has(n));
  const body = chosen.map((n) => `/* pattern: ${n} (${byName.get(n).origin}) */\n${byName.get(n).css}`).join("\n\n");
  return { patterns: chosen, css: `\n/* slideware catalogue: core and the patterns this deck uses. Copied by new and refresh; edit the deck's CSS instead. */\n@layer sw-kit {\n${body}\n}\n` };
}

module.exports = { LAYERS, list, get, used, kitFor, parse };
