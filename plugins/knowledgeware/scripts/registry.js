#!/usr/bin/env node
// registry.js — one place that knows where styles and brandbooks live.
// Used by load-style.js, list-styles.js and the slideware html converter.
//
// Three registries, searched in this order; a later one shadows an earlier one on a name collision:
//   styles/                      the default styles shipped with the plugin
//   styles/brands/               brandbooks installed into the plugin (wiped on update)
//   $KNOWLEDGEWARE_BRANDS_DIR/   the user's own brands directory (survives updates)
//
// Each registry holds entries in either layout:
//   folder  <dir>/<name>/brand.md      with tokens.json, assets/, css/, README.md beside it
//   flat    <dir>/<name>.md            with tokens/<name>.json and <name>/assets/ (older layout)
// A folder entry wins over a flat entry of the same name in the same registry.
//
// Which identity to use when none is named, first match wins:
//   .knowledgeware   a one-line file in the working directory or any parent (per project)
//   DEFAULT          a one-line file in $KNOWLEDGEWARE_BRANDS_DIR, then in styles/brands/

const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_ROOT = path.join(__dirname, "..");
const STYLES_DIR = path.join(PLUGIN_ROOT, "styles");
const BRANDS_DIR = path.join(STYLES_DIR, "brands");

function resolveUserBrandsDir() {
  let d = process.env.KNOWLEDGEWARE_BRANDS_DIR;
  if (!d || !d.trim()) return null;
  d = d.trim();
  if (d === "~") d = os.homedir();
  else if (d.startsWith("~/")) d = path.join(os.homedir(), d.slice(2));
  return path.resolve(d);
}
const USER_BRANDS_DIR = resolveUserBrandsDir();

function registries() {
  const dirs = [[STYLES_DIR, "default"], [BRANDS_DIR, "brand"]];
  if (USER_BRANDS_DIR) dirs.push([USER_BRANDS_DIR, "brand"]);
  return dirs;
}

// Entries of one registry directory: { name, source, kind, layout, dir, assetsDir }.
function scanDir(dir, kind) {
  const found = new Map();
  if (!fs.existsSync(dir)) return found;
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.startsWith(".") || f === "tokens" || f === "brands") continue;
    const full = path.join(dir, f);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isFile() && f.endsWith(".md") && !/^readme\.md$/i.test(f)) {
      const name = f.replace(/\.md$/, "");
      if (!found.has(name)) {
        found.set(name, { name, source: full, kind, layout: "flat", dir: null, assetsDir: path.join(dir, name, "assets") });
      }
    } else if (st.isDirectory() && fs.existsSync(path.join(full, "brand.md"))) {
      // folder layout wins over a flat file of the same name
      found.set(f, { name: f, source: path.join(full, "brand.md"), kind, layout: "folder", dir: full, assetsDir: path.join(full, "assets") });
    }
  }
  return found;
}

// Every entry across the registries, sorted by name; later registries shadow earlier ones.
function listBundled() {
  const found = new Map();
  for (const [dir, kind] of registries()) {
    for (const [name, entry] of scanDir(dir, kind)) found.set(name, entry);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function findBundled(name) {
  return listBundled().find(b => b.name === name) || null;
}

// Where an entry's derived token cache lives (regenerable; never hand-edited).
function tokensCachePath(entry) {
  return entry.layout === "folder"
    ? path.join(entry.dir, "tokens.json")
    : path.join(path.dirname(entry.source), "tokens", `${entry.name}.json`);
}

function readMarker(file) {
  try {
    const v = fs.readFileSync(file, "utf8").split("\n")[0].trim();
    return v || null;
  } catch { return null; }
}

// The per-project marker: .knowledgeware in cwd or any parent.
function projectMarker(cwd = process.cwd()) {
  let d = path.resolve(cwd);
  for (;;) {
    const v = readMarker(path.join(d, ".knowledgeware"));
    if (v) return { name: v, file: path.join(d, ".knowledgeware") };
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

// The identity to use when the user names none, or null.
function defaultBrand(cwd = process.cwd()) {
  const pm = projectMarker(cwd);
  if (pm) return pm.name;
  const markers = [];
  if (USER_BRANDS_DIR) markers.push(path.join(USER_BRANDS_DIR, "DEFAULT"));
  markers.push(path.join(BRANDS_DIR, "DEFAULT"));
  for (const m of markers) {
    const v = readMarker(m);
    if (v) return v;
  }
  return null;
}

module.exports = {
  PLUGIN_ROOT, STYLES_DIR, BRANDS_DIR, USER_BRANDS_DIR,
  registries, listBundled, findBundled, tokensCachePath, defaultBrand, projectMarker,
};
