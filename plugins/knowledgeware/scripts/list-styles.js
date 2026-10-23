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
// Adding a style:     create styles/<name>/brand.md          (a "default" style — generic, marketplace-safe)
// Adding a brandbook: create styles/brands/<name>/brand.md   (brand-specific / proprietary — kept out of the plugin repo)
//                     or <$KNOWLEDGEWARE_BRANDS_DIR>/<name>/brand.md — a user-owned directory anywhere
//                     on disk that survives plugin updates (same layout; shadows plugin entries)
// The older flat layout (<dir>/<name>.md + <dir>/tokens/<name>.json) is still read. See registry.js.

const fs = require("fs");
const os = require("os");
const path = require("path");

const registry = require("./registry");
const { STYLES_DIR, USER_BRANDS_DIR, listBundled, tokensCachePath, defaultBrand, projectMarker } = registry;
const SAMPLES_DIR = path.join(__dirname, "..", "skills", "slideware", "pptx", "assets", "samples");

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
    return {
      name: b.name,
      kind: b.kind,
      layout: b.layout,
      source: b.source,
      description: describe(b.source),
      hasTokens: fs.existsSync(tokensCachePath(b)),
      hasAssets: fs.existsSync(b.assetsDir),
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
      const tags = [b.isDefault ? "DEFAULT" : "", b.layout === "flat" ? "flat layout" : "", b.hasTokens ? "cached" : "", b.hasAssets ? "assets" : "", b.hasSample ? "sample" : ""].filter(Boolean).join(", ");
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
  const pm = projectMarker();
  if (pm) console.log(`project marker ${pm.file} names "${pm.name}"\n`);
  if (def && !inv.some(b => b.name === def)) {
    console.log(`WARNING: the ${pm ? ".knowledgeware" : "DEFAULT"} marker names "${def}", which is not in the registry.\n`);
  }
  const brandsHome = USER_BRANDS_DIR || "styles/brands";
  console.log(`${inv.length} total. Add a default style → styles/<name>/brand.md. Add a brandbook → ${brandsHome}/<name>/brand.md (see the brandware skill). Set a default brand → echo <name> > ${brandsHome}/DEFAULT.`);
}

if (require.main === module) main();
module.exports = { listBundled, inventory };
