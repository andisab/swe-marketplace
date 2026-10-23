#!/usr/bin/env node
// Tests scripts/registry.js and the loaders against a temporary brands directory:
// folder and flat layouts, shadowing, cache paths, entry names, the .knowledgeware
// project marker and the DEFAULT marker. Needs only node.
//
// Usage: node plugins/knowledgeware/tests/registry-test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PLUGIN = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-registry-"));
const brands = path.join(tmp, "brands");
const project = path.join(tmp, "project", "sub");
fs.mkdirSync(project, { recursive: true });

const BOOK = (name, accent) => `---
name: ${name}
description: test brand
palette:
  bg: '#FFFFFF'
  surface: '#FFFFFF'
  ink: '#111111'
  inkMuted: '#666666'
  border: '#DDDDDD'
  accent: '${accent}'
paletteDark:
  bg: '#101010'
  ink: '#EEEEEE'
type:
  sans: 'Inter'
  heroPt: 44
  sectionPt: 32
  titlePt: 28
  bodyPt: 14
  captionPt: 10
layout:
  radiusPx: 4
  shadowOpacity: 0
  marginIn: 0.5
---
# ${name}

## Palette
| Role | Hex |
|---|---|
| Background | \`#FFFFFF\` |
`;

// A folder brand, a flat brand, and a name that exists in both layouts (folder must win).
fs.mkdirSync(path.join(brands, "folderco", "assets"), { recursive: true });
fs.writeFileSync(path.join(brands, "folderco", "brand.md"), BOOK("folderco", "#AA0000"));
fs.writeFileSync(path.join(brands, "flatco.md"), BOOK("flatco", "#00AA00"));
fs.mkdirSync(path.join(brands, "both"), { recursive: true });
fs.writeFileSync(path.join(brands, "both", "brand.md"), BOOK("both", "#0000AA"));
fs.writeFileSync(path.join(brands, "both.md"), BOOK("both", "#FFFFFF"));
// A brand that shadows a default style by name
fs.mkdirSync(path.join(brands, "style-1"), { recursive: true });
fs.writeFileSync(path.join(brands, "style-1", "brand.md"), BOOK("style-1", "#123456"));
fs.writeFileSync(path.join(brands, "DEFAULT"), "flatco\n");

const env = { ...process.env, KNOWLEDGEWARE_BRANDS_DIR: brands };
delete env.KNOWLEDGEWARE_BRANDS_DIR_UNUSED;

function node(args, cwd = tmp) {
  return execFileSync("node", args, { env, cwd, encoding: "utf8" });
}

let n = 0;
function ok(label) { n++; console.log("ok   " + label); }

// Load the registry in this process with the test env
process.env.KNOWLEDGEWARE_BRANDS_DIR = brands;
const registry = require(path.join(PLUGIN, "scripts", "registry.js"));
const entries = registry.listBundled();
const byName = Object.fromEntries(entries.map(e => [e.name, e]));

assert.strictEqual(byName.folderco.layout, "folder"); ok("folder layout is found");
assert.strictEqual(byName.flatco.layout, "flat"); ok("flat layout is still found");
assert.strictEqual(byName.both.layout, "folder"); ok("folder entry wins over a flat file of the same name");
assert.strictEqual(byName["style-1"].kind, "brand");
assert.strictEqual(byName["style-1"].source, path.join(brands, "style-1", "brand.md")); ok("a user brand shadows a default style by name");
for (const s of ["style-2", "style-3", "style-4", "style-5"]) assert.strictEqual(byName[s].layout, "folder");
ok("the five default styles are folder entries");
assert.strictEqual(registry.tokensCachePath(byName.folderco), path.join(brands, "folderco", "tokens.json"));
assert.strictEqual(registry.tokensCachePath(byName.flatco), path.join(brands, "tokens", "flatco.json")); ok("cache paths follow the layout");
assert.strictEqual(byName.folderco.assetsDir, path.join(brands, "folderco", "assets"));
assert.strictEqual(byName.flatco.assetsDir, path.join(brands, "flatco", "assets")); ok("assets folders follow the layout");

assert.strictEqual(registry.defaultBrand(project), "flatco"); ok("DEFAULT marker in the user brands directory");
fs.writeFileSync(path.join(tmp, "project", ".knowledgeware"), "folderco\n");
assert.strictEqual(registry.defaultBrand(project), "folderco"); ok(".knowledgeware in a parent directory wins over DEFAULT");

// load-style.js: names, tokens, cache writing, paletteDark passthrough
const tokens = JSON.parse(node([path.join(PLUGIN, "scripts", "load-style.js"), "folderco"]));
assert.strictEqual(tokens.name, "folderco"); ok("a folder entry is named after its folder, not brand.md");
assert.strictEqual(tokens.palette.accent, "AA0000");
assert.strictEqual(tokens.paletteDark.bg, "101010"); ok("paletteDark passes through to the tokens");
assert(fs.existsSync(path.join(brands, "folderco", "tokens.json"))); ok("the cache is written next to brand.md after a miss");
const second = node([path.join(PLUGIN, "scripts", "load-style.js"), "folderco", "-o", path.join(tmp, "out.json")], tmp);
assert(fs.readFileSync(path.join(tmp, "out.json"), "utf8").includes('"folderco"')); ok("the second load reads the cache");
const flat = JSON.parse(node([path.join(PLUGIN, "scripts", "load-style.js"), "flatco"]));
assert.strictEqual(flat.name, "flatco");
assert(fs.existsSync(path.join(brands, "tokens", "flatco.json"))); ok("a flat entry caches under tokens/<name>.json");

// html converter: frontmatter passes through, name from folder
const md = node([path.join(PLUGIN, "skills", "slideware", "html", "scripts", "load-style.js"), "folderco"]);
assert(md.startsWith("---\nname: folderco")); ok("html converter resolves a folder entry");
// a prose-only brandbook gets frontmatter with the folder name and paletteDark omitted
fs.mkdirSync(path.join(brands, "proseco"), { recursive: true });
fs.writeFileSync(path.join(brands, "proseco", "brand.md"), "# ProseCo\n\n> test\n\n## Palette\n| Role | Hex |\n|---|---|\n| Background | `#FAFAFA` |\n| Ink primary | `#101010` |\n| Brand accent | `#CC3300` |\n");
const prose = node([path.join(PLUGIN, "skills", "slideware", "html", "scripts", "load-style.js"), "proseco"]);
assert(/^---\nname: proseco\n/.test(prose) && !prose.includes("paletteDark")); ok("html converter generates frontmatter for a prose-only folder entry");

// list-styles.js
const inv = JSON.parse(node([path.join(PLUGIN, "scripts", "list-styles.js"), "--json"], project));
const fc = inv.find(e => e.name === "folderco");
assert(fc && fc.isDefault && fc.layout === "folder" && fc.hasTokens && fc.hasAssets); ok("list-styles reports layout, cache, assets and the project default");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`registry-test: ${n} passed`);
