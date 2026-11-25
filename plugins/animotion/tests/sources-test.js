// sources-test.js — index/sources.yaml reads cleanly with scripts/sources.js: unique ids, the required fields present
// with values from the schema's enums, and the CLI's filters return what they should.
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require(path.join(__dirname, "..", "scripts", "sources.js"));

const list = S.entries();
assert.ok(list.length >= 100, `expected the full index, read ${list.length} entries`);
const ids = new Set();
const problems = [];
for (const e of list) {
  if (ids.has(e.id)) problems.push(`${e.id}: duplicate id`);
  ids.add(e.id);
  if (!e.name) problems.push(`${e.id}: no name`);
  if (!["fetch-embed", "consult", "study-only"].includes(e.use)) problems.push(`${e.id}: use "${e.use}"`);
  if (!e.kind) problems.push(`${e.id}: no kind`);
  if (Object.keys(e.idioms).length !== S.IDIOMS.length) problems.push(`${e.id}: idioms should score all of ${S.IDIOMS.join(", ")} (or be "any")`);
  if (!["yes", "conditional", "no", "n/a"].includes(e.embed)) problems.push(`${e.id}: license.embed "${e.embed}"`);
  if (e.use === "fetch-embed" && e.embed === "no") problems.push(`${e.id}: fetch-embed but embed: no`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.verified)) problems.push(`${e.id}: last_verified "${e.verified}"`);
}
assert.deepEqual(problems, [], "\n" + problems.join("\n"));

const pixel = S.find(list, { idiom: "pixel", use: "fetch-embed" });
assert.ok(pixel.some((e) => e.id === "pixelarticons"));
assert.ok(pixel.every((e) => e.use === "fetch-embed" && (e.idioms.pixel === "any" || e.idioms.pixel >= 2)));
assert.ok(!S.find(list, { use: "fetch-embed" }).some((e) => e.id === "undraw"), "unDraw is never fetched");
console.log(`sources-test: ${list.length} entries OK`);
