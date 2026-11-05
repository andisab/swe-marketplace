// theme.js — turn a brand from the brandware registry into a deck's theme block.
//
// The theme block (<style id="sw-theme">) is the deck's one copy of its brand. It holds:
//   - the cascade layer order: the runtime's defaults, the catalogue's kit (#sw-kit), the brand
//   - in @layer sw-brand, the brand's tokens as CSS custom properties (--color-*, --font-*, --size-*,
//     --radius, --margin), then the brand's own css/slideware.css when it ships one: refinements over
//     the catalogue's patterns, which win where they differ
// It is tagged with the brand's name and a hash of the brand's files, so `refresh` and `check` can
// tell when brandware has moved on. The editor never writes this block.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const registry = require(path.join(PLUGIN_ROOT, "scripts", "registry.js"));
const loadStyle = require(path.join(PLUGIN_ROOT, "scripts", "load-style.js"));

const THEME_VERSION = "3.0.0";   // bump when the generated CSS changes, so decks see a stale tag
const SYSTEM_FONTS = new Set(["georgia", "arial", "helvetica", "helvetica neue", "times", "times new roman", "menlo", "monaco", "courier", "courier new",
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "sans-serif", "serif", "monospace", "verdana", "tahoma", "consolas", "sf pro", "sf mono", "inter var"]);

// The brand's registry entry and its files.
function resolveBrand(name) {
  const entry = registry.findBundled(name);
  if (!entry) {
    if (fs.existsSync(name)) {   // a brandbook path
      const src = path.resolve(name);
      return { name: path.basename(src).replace(/\.md$/, "").replace(/^brand$/, path.basename(path.dirname(src))), source: src, dir: path.dirname(src), assetsDir: path.join(path.dirname(src), "assets") };
    }
    const names = registry.listBundled().map((b) => b.name).join(", ");
    throw new Error(`brand "${name}" isn't in the registry (${names})`);
  }
  const dir = entry.layout === "folder" ? entry.dir : path.dirname(entry.assetsDir);
  return { name: entry.name, source: entry.source, dir, assetsDir: entry.assetsDir };
}
function brandFiles(b) {
  const css = path.join(b.dir, "css", "slideware.css");
  const logo = (f) => { const p = path.join(b.assetsDir, f); return fs.existsSync(p) ? p : null; };
  return { css: fs.existsSync(css) ? css : null, logoLight: logo("logo-light.svg"), logoDark: logo("logo-dark.svg") };
}
function brandHash(b) {
  const f = brandFiles(b);
  const h = crypto.createHash("sha256").update(THEME_VERSION);
  for (const p of [b.source, f.css, f.logoLight, f.logoDark]) h.update(p ? fs.readFileSync(p) : "-");
  return h.digest("hex").slice(0, 16);
}

const hex = (v, fallback) => (v == null || v === "" ? fallback : String(v).startsWith("#") ? String(v) : `#${v}`);
function luminance(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
  if (!m) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function fontsUrl(type) {
  const fam = [];
  const add = (f, w) => { if (f && !SYSTEM_FONTS.has(f.toLowerCase())) fam.push(`family=${f.trim().replace(/ /g, "+")}:wght@${w}`); };
  add(type.sans, "400;500;600;700");
  if (type.serif !== type.sans) add(type.serif, "400;600;700");
  add(type.mono, "400;500");
  return fam.length ? `https://fonts.googleapis.com/css2?${[...new Set(fam)].join("&")}&display=swap` : null;
}
function favicon(palette) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${hex(palette.ink, "#1A1A18")}"/>` +
    `<rect x="6" y="10" width="20" height="12" rx="1.5" fill="${hex(palette.bg, "#FFFFFF")}"/><rect x="6" y="20" width="20" height="2" fill="${hex(palette.accent, "#3B5249")}"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function tokensCss(t) {
  const P = t.palette || {}, T = t.type || {}, L = t.layout || {};
  const font = (f, fb) => (f ? `'${f}', ${fb}` : fb);
  return `:root {
  --color-bg: ${hex(P.bg, "#FFFFFF")};
  --color-bg-dark: ${hex(P.bgDark, hex(P.ink, "#1A1A18"))};
  --color-surface: ${hex(P.surface, hex(P.bg, "#FFFFFF"))};
  --color-surface-alt: ${hex(P.surfaceAlt, hex(P.surface, "#F4F4F2"))};
  --color-ink: ${hex(P.ink, "#1A1A18")};
  --color-ink-body: ${hex(P.inkBody, hex(P.ink, "#1A1A18"))};
  --color-ink-muted: ${hex(P.inkMuted, "#6B6B63")};
  --color-ink-faint: ${hex(P.inkFaint, hex(P.inkMuted, "#9E9E97"))};
  --color-border: ${hex(P.border, "#E3E3DF")};
  --color-accent: ${hex(P.accent, "#3B5249")};
  --color-accent2: ${hex(P.accent2, hex(P.accent, "#3B5249"))};
  --color-success: ${hex(P.success, "#3F8A4F")};
  --color-warning: ${hex(P.warning, "#B7791F")};
  --color-error: ${hex(P.error, "#B4372F")};
  --font-sans: ${font(T.sans, "system-ui, sans-serif")};
  --font-serif: ${font(T.serif, "Georgia, serif")};
  --font-mono: ${font(T.mono, "ui-monospace, Menlo, monospace")};
  --size-hero: ${T.heroPt || 44}pt;
  --size-section: ${T.sectionPt || 32}pt;
  --size-title: ${T.titlePt || 28}pt;
  --size-body: ${T.bodyPt || 14}pt;
  --size-subbody: ${T.subBodyPt || 12}pt;
  --size-caption: ${T.captionPt || 10}pt;
  --size-code: ${T.codePt || 12}pt;
  --radius: ${L.radiusPx ?? 6}px;
  --shadow-opacity: ${L.shadowOpacity ?? 0.12};
  --margin: ${L.marginIn ?? 0.5}in;
}`;
}


// Everything a deck needs from its brand: the theme block, its tag, the fonts link, favicon, logos.
// The brandbook's names for its colours, by hex: the palette tables' first column names a role and
// the second holds its hex codes, each optionally followed (or preceded) by a word that qualifies it
// ("`#6B7E6B` graphics · `#424F42` text" gives "Sage graphics", "Sage text"). The first name wins.
const STOP = new Set(["to", "at", "on", "in", "is", "or", "and", "the", "from", "of", "a", "an", "never", "with"]);
function colorNames(md) {
  const names = {};
  for (const line of String(md).split("\n")) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.length < 2 || !/#[0-9a-f]{6}\b/i.test(cells[1])) continue;
    const role = cells[0].replace(/[*`_]/g, "").replace(/\s+/g, " ").trim();
    if (!role || /^-+$/.test(role)) continue;
    const re = /`?(#[0-9a-f]{6})\b`?/gi;
    let m;
    while ((m = re.exec(cells[1]))) {
      const hex = m[1].toUpperCase();
      if (names[hex]) continue;
      const after = (/^\s*([a-z][a-z-]*)\b/.exec(cells[1].slice(m.index + m[0].length)) || [])[1];
      const before = (/\b([a-z][a-z-]*)\s*$/i.exec(cells[1].slice(0, m.index).replace(/[(`·]/g, " ")) || [])[1];
      const q = after && !STOP.has(after) ? after : before && !STOP.has(before.toLowerCase()) && /^[a-z]/.test(before) ? before : "";
      names[hex] = q ? `${role} ${q}` : role;
    }
  }
  return names;
}

function themeFor(brandName) {
  const b = resolveBrand(brandName);
  const tokens = loadStyle.build(b.source);
  const files = brandFiles(b);
  const brandCss = files.css ? fs.readFileSync(files.css, "utf8").trim() : "";
  // The layer order (runtime defaults, the catalogue's kit, the brand) and the brand's layer: its
  // tokens, then its own slideware.css when it ships one, which may refine the tokens and the kit.
  const css = `/* ${b.name} brand, from brandware. Generated by slideware (theme ${THEME_VERSION}); refresh replaces this block whole. */\n` +
    `${require("./catalog").LAYERS}\n@layer sw-brand {\n${tokensCss(tokens)}\n` + (brandCss ? `/* ${b.name} slideware.css */\n${brandCss}\n` : "") + "}\n";
  const svg = (p) => p ? fs.readFileSync(p, "utf8").replace(/<\?xml[^>]*>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[^>]*>/i, "").trim() : null;
  const dark = luminance(tokens.palette && tokens.palette.bg) < 0.5;
  const logos = {};
  if (files.logoLight) logos["logo-light"] = svg(files.logoLight);
  if (files.logoDark) logos["logo-dark"] = svg(files.logoDark);
  const main = dark ? (logos["logo-dark"] || logos["logo-light"]) : (logos["logo-light"] || logos["logo-dark"]);
  if (main) logos.logo = main;
  return {
    brand: b.name, hash: brandHash(b), version: THEME_VERSION, css, tokens, colorNames: colorNames(fs.readFileSync(b.source, "utf8")),
    fontsUrl: fontsUrl(tokens.type || {}), favicon: favicon(tokens.palette || {}), logos,
  };
}

// An inline SVG tagged as a named asset.
function svgAsset(name, svgText) {
  return svgText.replace(/^<svg\b/i, `<svg data-asset="${name}"`);
}

module.exports = { THEME_VERSION, resolveBrand, brandHash, themeFor, colorNames, svgAsset, luminance, fontsUrl };
