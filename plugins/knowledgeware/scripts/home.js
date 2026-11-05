#!/usr/bin/env node
// home.js — where knowledgeware keeps a user's local resources, outside the plugin.
//
//   <home>                   $KNOWLEDGEWARE_HOME, else ~/.claude/knowledgeware
//   <home>/brands/           brandbooks (brandware); $KNOWLEDGEWARE_BRANDS_DIR, when set, is used instead
//   <home>/slideware/catalog/  slide patterns (slideware), beside the catalogue the plugin ships
//
// Each skill's resources sit in a folder named after the skill (<home>/<skill>/<kind>/); brands are
// shared by every skill, so they sit at the top. The plugin's own resources come first and the
// home's shadow them by name, so a user can keep, change or add entries without touching the plugin,
// and plugin updates never touch the home. The home is the user's to version or not: `init` writes a
// README and a .gitignore for caches and renders.
//
//   node scripts/home.js            print the home and each resource folder
//   node scripts/home.js init       create the home with its README and .gitignore (never overwrites)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_ROOT = path.join(__dirname, "..");

function expand(p) {
  if (!p || !p.trim()) return null;
  p = p.trim();
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}
function homeDir() { return expand(process.env.KNOWLEDGEWARE_HOME) || path.join(os.homedir(), ".claude", "knowledgeware"); }
function brandsDir() { return expand(process.env.KNOWLEDGEWARE_BRANDS_DIR) || path.join(homeDir(), "brands"); }
// A skill's resource folders, plugin first: e.g. catalogDirs("slideware") for the slide patterns.
function catalogDirs(skill) {
  const shipped = { slideware: path.join(PLUGIN_ROOT, "skills", "slideware", "html", "catalog") }[skill];
  return [shipped, path.join(homeDir(), skill, "catalog")].filter(Boolean);
}

const README = `# knowledgeware home

Local resources for the knowledgeware plugin's skills, kept outside the plugin so updates never touch them.
The plugin reads this folder from \`KNOWLEDGEWARE_HOME\`, or from \`~/.claude/knowledgeware\` when that isn't set.

| Folder | What | Used by |
|---|---|---|
| \`brands/<name>/\` | brandbooks: \`brand.md\`, \`assets/\`, an optional \`css/slideware.css\` (\`KNOWLEDGEWARE_BRANDS_DIR\`, when set, is used instead) | brandware, and every skill that renders a brand |
| \`slideware/catalog/\` | your own slide patterns, one \`<name>.html\` each; they shadow the plugin's patterns of the same name | slideware |

Version it or not, as you like. The \`.gitignore\` here leaves out caches and renders.
`;
const GITIGNORE = `# Caches and renders the plugin rebuilds on demand
.DS_Store
__pycache__/
*.pyc
renders/
.cache/
`;
function initHome() {
  const home = homeDir();
  const made = [];
  for (const d of [home, path.join(home, "brands"), path.join(home, "slideware", "catalog")]) if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); made.push(d); }
  for (const [f, text] of [["README.md", README], [".gitignore", GITIGNORE]]) { const p = path.join(home, f); if (!fs.existsSync(p)) { fs.writeFileSync(p, text); made.push(p); } }
  return { home, made };
}

module.exports = { PLUGIN_ROOT, expand, homeDir, brandsDir, catalogDirs, initHome };

if (require.main === module) {
  if (process.argv[2] === "init") { const r = initHome(); console.log(r.made.length ? `Created:\n  ${r.made.join("\n  ")}` : `${r.home} is already set up.`); }
  else {
    console.log(`home       ${homeDir()}${process.env.KNOWLEDGEWARE_HOME ? "  (KNOWLEDGEWARE_HOME)" : ""}`);
    console.log(`brands     ${brandsDir()}${process.env.KNOWLEDGEWARE_BRANDS_DIR ? "  (KNOWLEDGEWARE_BRANDS_DIR)" : ""}`);
    console.log(`slideware  ${catalogDirs("slideware").join("  then  ")}`);
  }
}
