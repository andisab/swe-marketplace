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
//
// Tokens caches live next to the source:
//   styles/tokens/<name>.json
//   styles/brands/tokens/<name>.json

const fs = require("fs");
const path = require("path");

const STYLES_DIR = path.join(__dirname, "..", "styles");
const BRANDS_DIR = path.join(STYLES_DIR, "brands");
const SAMPLES_DIR = path.join(__dirname, "..", "skills", "slideware", "pptx", "assets", "samples");

function listBundled() {
  const found = [];
  for (const [dir, kind] of [[STYLES_DIR, "default"], [BRANDS_DIR, "brand"]]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".md") || /^readme\.md$/i.test(f)) continue;
      found.push({ name: f.replace(/\.md$/, ""), source: path.join(dir, f), kind });
    }
  }
  return found;
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
  return listBundled().map(b => {
    const tokensDir = b.kind === "brand"
      ? path.join(BRANDS_DIR, "tokens")
      : path.join(STYLES_DIR, "tokens");
    return {
      name: b.name,
      kind: b.kind,
      description: describe(b.source),
      hasTokens: fs.existsSync(path.join(tokensDir, `${b.name}.json`)),
      hasSample: fs.existsSync(path.join(SAMPLES_DIR, b.name)),
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
      const tags = [b.hasTokens ? "cached" : "", b.hasSample ? "sample" : ""].filter(Boolean).join(", ");
      const tagStr = tags ? ` [${tags}]` : "";
      const desc = b.description ? "  " + b.description : "";
      console.log(`  ${b.name.padEnd(nameW)}${tagStr}${desc}`);
    });
    console.log("");
  }
  printGroup("default styles (styles/)", defaults);
  printGroup("brandbooks (styles/brands/ — brand registry)", brands);
  console.log(`${inv.length} total. Add a default style → styles/<name>.md. Add a brandbook → styles/brands/<name>.md (see the brandware skill).`);
}

if (require.main === module) main();
module.exports = { listBundled, inventory };
