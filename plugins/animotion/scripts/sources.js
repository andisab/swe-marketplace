// sources.js — read index/sources.yaml without a YAML library, by its fixed layout: entries under `sources:` start
// with "  - id: <id>", and their fields are indented four spaces (license fields six). Enough to filter and show.
"use strict";
const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", "index", "sources.yaml");
const IDIOMS = ["pixel", "flat", "line", "hand", "iso", "wire"];

// { a: 1, b: "x, y", c: bare } → the same fields as indented lines, so one set of regexes reads both forms.
function inlineMap(text) {
  const out = [];
  for (const m of text.slice(1, -1).matchAll(/(\w+):\s*("(?:[^"\\]|\\.)*"|[^,]+)/g)) out.push(`      ${m[1]}: ${m[2].trim()}`);
  return out.join("\n") + "\n";
}
function field(block, re) { const m = re.exec(block); return m ? m[1].trim().replace(/^["']|["']$/g, "") : ""; }

function entries(text = fs.readFileSync(INDEX, "utf8")) {
  const body = text.slice(text.search(/^sources:\s*$/m));
  return body.split(/^(?=  - id: )/m).filter((b) => b.startsWith("  - id: ")).map((block) => {
    const id = field(block, /^  - id: (.+)$/m);
    const idiomsRaw = field(block, /^    idioms: (.+)$/m);
    const idioms = {};
    if (idiomsRaw === "any") IDIOMS.forEach((k) => (idioms[k] = "any"));
    else for (const m of idiomsRaw.matchAll(/(\w+):\s*(\d)/g)) idioms[m[1]] = +m[2];
    // license is either a block (fields indented six spaces) or an inline map on one line.
    const inline = field(block, /^    license: (\{.*\})\s*$/m);
    const lic = inline ? inlineMap(inline) : (/^    license:\n((?: {6}.*\n?)+)/m.exec(block) || [])[1] || "";
    return {
      id, block: block.replace(/\s+$/, ""),
      name: field(block, /^    name: (.+)$/m),
      kind: field(block, /^    kind: (.+)$/m),
      use: field(block, /^    use: (.+)$/m),
      idioms,
      embed: field(lic, /^ {6}embed: (.+)$/m),
      attribution: field(lic, /^ {6}attribution: (.+)$/m),
      licence: field(lic, /^ {6}(?:spdx|name): (.+)$/m),
      autoSelect: field(block, /^    auto_select: (.+)$/m) !== "false",
      verified: field(block, /^    last_verified: (.+)$/m),
    };
  });
}

// Filter: { idiom, use, kind, min (idiom score, default 2), all (include auto_select: false) }.
function find(list, o = {}) {
  const min = o.min === undefined ? 2 : +o.min;
  return list.filter((e) =>
    (!o.use || e.use === o.use) &&
    (!o.kind || e.kind === o.kind) &&
    (o.all || e.autoSelect) &&
    (!o.idiom || e.idioms[o.idiom] === "any" || (e.idioms[o.idiom] || 0) >= min))
    .sort((a, b) => (o.idiom ? (b.idioms[o.idiom] === "any" ? 0 : b.idioms[o.idiom] || 0) - (a.idioms[o.idiom] === "any" ? 0 : a.idioms[o.idiom] || 0) : 0) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

function table(list, idiom) {
  const rows = list.map((e) => [e.id, e.kind, e.use, idiom ? String(e.idioms[idiom] ?? "-") : "", e.embed || "-", e.attribution || "-", e.licence.slice(0, 28)]);
  const head = ["id", "kind", "use", idiom ? idiom : "", "embed", "credit", "licence"];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => c.padEnd(w[i])).join("  ").replace(/\s+$/, "");
  return [line(head), ...rows.map(line)].join("\n");
}

module.exports = { INDEX, IDIOMS, entries, find, table };
