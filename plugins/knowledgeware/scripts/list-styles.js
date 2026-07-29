#!/usr/bin/env node
// list-styles.js — discover bundled styles + custom brandbooks from the filesystem.
//
// Usage:
//   node list-styles.js              # human-readable list with one-line descriptions
//   node list-styles.js --json       # JSON array of {name, kind, description, hasTokens, hasSample}
//   node list-styles.js --names      # bare names, one per line
//   node list-styles.js --default    # only the 5 default styles
//   node list-styles.js --brands     # only brandbooks
//
// Adding a style:     drop styles/<name>.md          (becomes a "default" style — generic, marketplace-safe)
// Adding a brandbook: drop styles/brands/<name>.md   (brand-specific / proprietary — kept out of the plugin repo)
//                     or <$KNOWLEDGEWARE_BRANDS_DIR>/<name>.md — a user-owned directory anywhere
//                     on disk that survives plugin updates (same layout; shadows plugin entries)
//
// Tokens caches live next to the source:
//   styles/tokens/<name>.json
//   styles/brands/tokens/<name>.json
//   <$KNOWLEDGEWARE_BRANDS_DIR>/tokens/<name>.json

const fs = require("fs");
const os = require("os");
const path = require("path");

const STYLES_DIR = path.join(__dirname, "..", "styles");
const BRANDS_DIR = path.join(STYLES_DIR, "brands");
const SAMPLES_DIR = path.join(__dirname, "..", "skills", "slideware", "pptx", "assets", "samples");

// User-owned registry from $KNOWLEDGEWARE_BRANDS_DIR (with ~ expansion), or null.
function resolveUserBrandsDir() {
  let d = process.env.KNOWLEDGEWARE_BRANDS_DIR;
  if (!d || !d.trim()) return null;
  d = d.trim();
  if (d === "~") d = os.homedir();
  else if (d.startsWith("~/")) d = path.join(os.homedir(), d.slice(2));
  return path.resolve(d);
}
const USER_BRANDS_DIR = resolveUserBrandsDir();

// DEFAULT — optional one-line marker naming the identity consumers use when the
// user names no style. The user directory's marker wins over the plugin's.
function defaultBrand() {
  const markers = [];
  if (USER_BRANDS_DIR) markers.push(path.join(USER_BRANDS_DIR, "DEFAULT"));
  markers.push(path.join(BRANDS_DIR, "DEFAULT"));
  for (const m of markers) {
    try { const v = fs.readFileSync(m, "utf8").trim(); if (v) return v; } catch {}
  }
  return null;
}

function listBundled() {
  const found = new Map();  // name → entry; later dirs shadow earlier on collision
  const dirs = [[STYLES_DIR, "default"], [BRANDS_DIR, "brand"]];
  if (USER_BRANDS_DIR) dirs.push([USER_BRANDS_DIR, "brand"]);
  for (const [dir, kind] of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".md") || /^readme\.md$/i.test(f)) continue;
      found.set(f.replace(/\.md$/, ""), { name: f.replace(/\.md$/, ""), source: path.join(dir, f), kind });
    }
  }
  return [...found.values()];
}

function describe(srcPath) {
  const md = fs.readFileSync(srcPath, "utf8");
  let inFrontmatter = false, sawH1 = false;
  for (const line of md.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "---") { inFrontmatter = !inFrontmatter; continue; }
    if (inFrontmatter) continue;
    if (trimmed.startsWith("# ")) { sawH1 = true; continue; }
    if (!sawH1) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) return "";
    return trimmed.replace(/^>\s*/, "").replace(/[*_`]/g, "").slice(0, 120);
  }
  return "";
}

function inventory() {
  const def = defaultBrand();
  return listBundled().map(b => {
    const tokensDir = path.join(path.dirname(b.source), "tokens");
    return {
      name: b.name,
      kind: b.kind,
      description: describe(b.source),
      hasTokens: fs.existsSync(path.join(tokensDir, `${b.name}.json`)),
      hasSample: fs.existsSync(path.join(SAMPLES_DIR, b.name)),
      isDefault: b.name === def,
    };
  });
}

function main() {
  const flags = new Set(process.argv.slice(2));
  let inv = inventory();
  if (flags.has("--default")) inv = inv.filter(b => b.kind === "default");
  if (flags.has("--brands") || flags.has("--custom")) inv = inv.filter(b => b.kind !== "default");

  if (flags.has("--json")) {
    process.stdout.write(JSON.stringify(inv, null, 2) + "\n");
    return;
  }
  if (flags.has("--names")) {
    inv.forEach(b => process.stdout.write(b.name + "\n"));
    return;
  }

  if (inv.length === 0) {
    console.log("No styles or brandbooks found under", STYLES_DIR);
    return;
  }
  const nameW = Math.max(...inv.map(b => b.name.length));
  const defaults = inv.filter(b => b.kind === "default");
  const brands   = inv.filter(b => b.kind === "brand");

  function printGroup(label, items) {
    if (items.length === 0) return;
    console.log(`── ${label} ──`);
    items.forEach(b => {
      const tags = [b.isDefault ? "DEFAULT" : "", b.hasTokens ? "cached" : "", b.hasSample ? "sample" : ""].filter(Boolean).join(", ");
      const tagStr = tags ? ` [${tags}]` : "";
      const desc = b.description ? "  " + b.description : "";
      console.log(`  ${b.name.padEnd(nameW)}${tagStr}${desc}`);
    });
    console.log("");
  }
  printGroup("default styles (styles/)", defaults);
  const brandsLabel = USER_BRANDS_DIR
    ? `brandbooks (styles/brands/ + ${USER_BRANDS_DIR})`
    : "brandbooks (styles/brands/ — brand registry)";
  printGroup(brandsLabel, brands);
  const def = defaultBrand();
  if (def && !inv.some(b => b.name === def)) {
    console.log(`WARNING: the DEFAULT marker names "${def}", which is not in the registry.\n`);
  }
  const brandsHome = USER_BRANDS_DIR || "styles/brands";
  console.log(`${inv.length} total. Add a default style → styles/<name>.md. Add a brandbook → ${brandsHome}/<name>.md (see the brandware skill). Set a default brand → echo <name> > ${brandsHome}/DEFAULT.`);
}

if (require.main === module) main();
module.exports = { listBundled, inventory };
