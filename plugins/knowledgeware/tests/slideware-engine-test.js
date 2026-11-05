#!/usr/bin/env node
// Tests slideware's HTML engine without a browser: deck regions and splicing, `new` and `refresh`
// (idempotent, brand hash, brand switch), lanes (overrides, replacements, visibility, stamps,
// orphans), `check` (errors, offline, lanes, deck-plan), and the PowerPoint zip. Needs only node 22+.
//
// Usage: node plugins/knowledgeware/tests/slideware-engine-test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-slideware-"));
process.env.KNOWLEDGEWARE_BRANDS_DIR = path.join(tmp, "brands");   // only the shipped styles resolve
process.env.CLAUDE_PLUGIN_DATA = path.join(tmp, "data");            // the editor stamp points here
fs.mkdirSync(process.env.KNOWLEDGEWARE_BRANDS_DIR);

const HTML = path.join(__dirname, "..", "skills", "slideware", "html");
const D = require(path.join(HTML, "engine", "deckfile.js"));
const build = require(path.join(HTML, "engine", "build.js"));
const { check } = require(path.join(HTML, "engine", "check.js"));
const { buildPptx } = require(path.join(HTML, "engine", "pptx.js"));
const { readZip } = require(path.join(HTML, "engine", "zip.js"));
const Lanes = require(path.join(HTML, "runtime", "lanes.js"));

let n = 0;
const ok = (label) => { n++; console.log("ok   " + label); };

const SLIDES = `<!-- title · Hello -->
<section data-key="title" data-chrome="none" class="center">
  <h1>Hello, Acme Corp</h1>
  <aside class="notes">Why we're here.</aside>
</section>
<!-- s2 · Two -->
<section data-key="s2">
  <h2 id="head">Acme Corp in numbers</h2>
  <p>Body</p>
  <svg data-figure-ref="map" style="width: 400px"></svg>
  <aside class="notes">The numbers.</aside>
</section>
<!-- s3 · Three -->
<section data-key="s3" hidden>
  <h2>Backup</h2>
  <aside class="notes">Only if asked.</aside>
</section>`;

// new: every region, valid settings, the brand tagged
let text = build.newDeck({ brand: "style-1", title: "Engine test", footer: "Platform team", minutes: 10, slides: SLIDES });
const deck = D.readDeck(text);
for (const id of Object.keys(D.REGION_TAGS)) assert(deck.regions[id], `missing ${id}`);
ok("new writes every region");
assert.strictEqual(deck.config.title, "Engine test"); assert.deepStrictEqual(deck.config.sessions, { "": 10 }); ok("new writes the settings JSON");
assert.deepStrictEqual(deck.slides.map((s) => s.key), ["title", "s2", "s3"]); assert(deck.slides[2].hidden); ok("sections are read with their keys and hidden flag");
assert.strictEqual(deck.regions["sw-theme"].attrs["data-brand"], "style-1"); assert(/^[0-9a-f]{16}$/.test(deck.regions["sw-theme"].attrs["data-brand-hash"])); ok("the theme is tagged with the brand and its hash");

// regions are found by id even when their tags appear inside code or comments
const decoy = text.replace("</head>", "<script>/* <main id=\"sw-slides\"> */ var s = '<template id=\"sw-assets\">';</script>\n</head>");
assert.strictEqual(D.readDeck(decoy).slides.length, 3); ok("region lookup ignores tags inside scripts and comments");

// splice replaces one region and leaves the rest byte-identical
const before = D.region(text, "sw-deck-css");
const spliced = D.spliceRegion(text, "sw-deck-css", "\n.x { color: red; }\n");
assert(D.region(spliced, "sw-deck-css").content.includes(".x"));
assert(spliced.slice(0, before.openEnd) === text.slice(0, before.openEnd), "text before the region changed");
assert(spliced.slice(spliced.length - (text.length - before.closeStart)) === text.slice(before.closeStart), "text after the region changed");
ok("spliceRegion changes one region only");

// refresh: a current deck is unchanged; a stale runtime and brand are replaced; switching brands works
assert.deepStrictEqual(build.refreshDeck(text).changes, []); ok("refresh leaves a current deck alone");
const stale = D.spliceRegion(D.spliceRegion(text, "sw-runtime", "\n/* old */\n", { "data-version": "1.0.0" }), "sw-theme", "\n/* old */\n", { "data-brand": "style-1", "data-brand-hash": "0000000000000000" });
const r1 = build.refreshDeck(stale);
assert(r1.changes.some((c) => c.startsWith("runtime")) && r1.changes.some((c) => c.startsWith("brand")), r1.changes.join(", "));
const same = (id) => { const a = D.region(r1.text, id), b = D.region(text, id); return a.content === b.content && JSON.stringify(a.attrs) === JSON.stringify(b.attrs) || JSON.stringify(Object.entries(a.attrs).sort()) === JSON.stringify(Object.entries(b.attrs).sort()) && a.content === b.content; };
assert(["sw-runtime", "sw-theme", "sw-loader", "sw-slides", "sw-assets", "sw-deck"].every(same), "a region differs after refresh");
assert.strictEqual((r1.text.match(/<link\b[^>]*data-brand=/g) || []).length, (text.match(/<link\b[^>]*data-brand=/g) || []).length); ok("refresh restores a stale runtime and brand");
assert.deepStrictEqual(build.refreshDeck(r1.text).changes, []); ok("refresh is idempotent");
const r2 = build.refreshDeck(text, { brand: "style-3" });
assert.strictEqual(D.region(r2.text, "sw-theme").attrs["data-brand"], "style-3");
assert.strictEqual((r2.text.match(/<link\b[^>]*data-brand=/g) || []).length, (text.match(/<link\b[^>]*data-brand=/g) || []).length);
assert.strictEqual(D.region(r2.text, "sw-slides").content, D.region(text, "sw-slides").content); ok("refresh --brand switches the theme and links, not the slides");

// write the deck with a figure, a lane and a plan, then check it
const dir = path.join(tmp, "deck");
fs.mkdirSync(path.join(dir, "lanes"), { recursive: true });
const file = path.join(dir, "index.html");
text = D.spliceRegion(text, "sw-assets", D.region(text, "sw-assets").content + '<svg data-figure="map" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\n');
fs.writeFileSync(file, text);
let res = check(file);
assert.deepStrictEqual(res.errors, []); assert.deepStrictEqual(res.warnings, []); ok("check passes a clean deck");
assert(res.info.some((l) => /Hidden.*s3/.test(l))); ok("check lists hidden slides");

// lanes: an element override by id, a text replacement, a slide hidden in the lane
const overlay = { name: "Acme Investments", replace: [["Acme Corp", "Acme Investments"]], overrides: [{ key: "s2", id: "head", text: "By the numbers" }], hidden: ["title"] };
const overlayText = JSON.stringify(overlay);
fs.writeFileSync(path.join(dir, "lanes", "acme.json"), overlayText);
const lane = Lanes.applyLane(text, overlay, "acme", null, Lanes.sourceStamp(text, overlayText));
const ld = D.readDeck(lane.text);
assert(/<h2 id="head"[^>]*>By the numbers<\/h2>/.test(lane.text)); ok("a lane override replaces an element's text by id");
assert(lane.text.includes("Hello, Acme Investments") && !D.region(lane.text, "sw-slides").content.includes("Acme Corp")); ok("a lane replacement changes slide text");
assert(ld.slides[0].hidden && !deck.slides[0].hidden); ok("a lane hides a slide in the lane only");
assert.deepStrictEqual(lane.changed.sort(), ["s2", "title"]); assert.strictEqual(ld.config.lane, "acme"); ok("the lane file marks its changed slides and names its lane");
assert(check(file).warnings.some((w) => /acme.*hasn't been built/.test(w))); ok("check flags a lane file that hasn't been built");
fs.writeFileSync(path.join(dir, "index-acme.html"), lane.text);
assert(!check(file).warnings.length); ok("check accepts a current lane file");
fs.writeFileSync(file, text.replace("<p>Body</p>", "<p>Body, edited</p>"));
assert(check(file).warnings.some((w) => /acme.*out of date/.test(w))); ok("check flags a lane file the base has moved past");
fs.writeFileSync(path.join(dir, "lanes", "acme.json"), JSON.stringify({ ...overlay, overrides: [{ key: "s2", id: "gone", text: "x" }] }));
assert(check(file).warnings.some((w) => /override for s2 #gone matches nothing/.test(w))); ok("check flags an override that matches nothing");
fs.rmSync(path.join(dir, "lanes"), { recursive: true }); fs.rmSync(path.join(dir, "index-acme.html"));

// the catalogue: new copies core and the patterns its slides use into #sw-kit, in the kit layer under the brand
const catalog = require(path.join(HTML, "engine", "catalog.js"));
assert(catalog.list().some((p) => p.name === "core") && catalog.list().every((p) => p.css && p.examples.length), "every pattern has CSS and an example"); ok("the catalogue lists patterns, each with CSS and an example");
const kitDeck = build.newDeck({ brand: "style-1", title: "Kit", slides: '<section data-key="a" class="layout-steps"><h3>A</h3></section>\n<section data-key="b" class="layout-card-row"><h3>B</h3></section>' });
const kr = D.region(kitDeck, "sw-kit");
assert.strictEqual(kr.attrs["data-patterns"], "core card-row steps"); assert(/@layer sw-kit \{/.test(kr.content) && kr.content.includes(".layout-steps")); ok("new copies core and the used patterns into the kit layer");
assert(D.region(kitDeck, "sw-theme").content.startsWith(D.region(kitDeck, "sw-theme").content.split("@layer sw-defaults")[0]) && D.region(kitDeck, "sw-theme").content.includes("@layer sw-defaults, sw-kit, sw-brand;")); ok("the theme declares the layer order");
const moreSlides = D.spliceRegion(kitDeck, "sw-slides", D.region(kitDeck, "sw-slides").content + '<section data-key="c" class="layout-timeline"><h3>C</h3></section>\n');
const rk = build.refreshDeck(moreSlides);
assert(rk.changes.some((c) => /^kit/.test(c)) && D.region(rk.text, "sw-kit").attrs["data-patterns"].includes("timeline")); ok("refresh adds a pattern's CSS when a slide starts using it");
assert.deepStrictEqual(build.refreshDeck(rk.text).changes, []); ok("refresh leaves a current kit alone");
const offDeck = build.newDeck({ brand: "style-1", title: "Off", slides: '<section data-key="a" class="layout-steps"><h3>A</h3></section>', kit: false });
assert(!D.region(offDeck, "sw-kit").content.includes(".layout-steps") && D.readDeck(offDeck).config.kit === false); ok('"kit": false keeps the catalogue CSS out');
// a pattern in the knowledgeware home shadows the plugin's
const homeCat = path.join(tmp, "kwhome", "slideware", "catalog");
fs.mkdirSync(homeCat, { recursive: true });
fs.writeFileSync(path.join(homeCat, "steps.html"), '<!-- pattern\nname: steps\ntitle: My steps\nidea: mine\n-->\n<style>section[data-key].layout-steps { --mine: 1; }</style>\n<section data-key="x" class="layout-steps"></section>\n');
process.env.KNOWLEDGEWARE_HOME = path.join(tmp, "kwhome");
const mine = catalog.get("steps");
assert(mine.origin === "home" && mine.title === "My steps"); ok("a pattern in the knowledgeware home shadows the plugin's");
delete process.env.KNOWLEDGEWARE_HOME;

// check errors: a duplicate key, a missing figure, a network load
fs.writeFileSync(file, text.replace('data-key="s3"', 'data-key="s2"').replace('data-figure-ref="map"', 'data-figure-ref="nope"').replace("<p>Body</p>", '<p>Body</p><img src="https://example.com/x.png"><a href="https://example.com">a link</a>'));
res = check(file);
assert(res.errors.some((e) => /two slides have the key "s2"/.test(e)), res.errors.join("\n")); ok("check flags a duplicate key");
assert(res.errors.some((e) => /figure "nope" isn't in the asset block/.test(e))); ok("check flags a figure reference that doesn't resolve");
const net = res.warnings.find((w) => /network/.test(w)) || "";
assert(net.includes("https://example.com/x.png") && !/https:\/\/example\.com(,|$)/.test(net) && !net.includes("fonts.g"), net); ok("check flags network loads, not links or Google Fonts");

// deck-plan.md
fs.writeFileSync(file, text);
fs.writeFileSync(path.join(dir, "deck-plan.md"), "| Key | Slide | Status |\n|---|---|---|\n| title | Hello | done |\n| s9 | Missing | done |\n");
assert(check(file).info.some((l) => /done in the plan but not in the deck: s9/.test(l))); ok("check compares deck-plan.md with the deck");
// a plan named like the spec page, one folder up, is read when there's no deck-plan.md
fs.rmSync(path.join(dir, "deck-plan.md"));
const specText = text.replace(/("title": "Engine test",)/, '$1\n  "spec": "../unit.html",');
fs.writeFileSync(file, specText);
fs.writeFileSync(path.join(tmp, "unit.html"), "<html></html>");
fs.writeFileSync(path.join(tmp, "unit.md"), "| # | Slide | Status |\n|---|---|---|\n| 1 | `title` Hello | done |\n| 2 | `s3` Backup | hidden |\n| 3 | `gone` Old | deleted 2026-11-01 |\n");
const specInfo = check(file).info;
assert(specInfo.some((l) => /^\.\.\/unit\.md: 3 rows, 2 in the deck, 0 to do/.test(l)), specInfo.join("\n")); ok("check reads ../<unit>.md named like the spec; hidden and deleted rows aren't to do");
assert(specInfo.some((l) => /in the deck but not in the plan: s2/.test(l))); ok("check lists slides the plan doesn't mention");

// PowerPoint: a valid zip with the parts PowerPoint needs, the hidden flag and the notes
const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
const slides = [
  { key: "title", hidden: false, full: png, bg: png, notes: { title: "Hello", cue: "0:00", text: "Why we're here." }, blocks: [{ x: 100, y: 100, w: 600, h: 80, align: "left", lineHeight: 50, fontSize: 40, pad: [0, 0, 0, 0], bullet: null, runs: [{ t: "Hello, Acme Corp", size: 40, color: "#111111", font: "Inter", bold: true }] }] },
  { key: "s3", hidden: true, full: png, bg: png, notes: { title: "Backup", cue: "", text: "Only if asked." }, blocks: [] },
];
const zip = readZip(buildPptx(slides, { level: 1, title: "Engine test" }));
const names = [...zip.keys()];
for (const part of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/notesSlides/notesSlide1.xml", "ppt/media/slide1.png"]) assert(names.includes(part), `missing ${part}`);
ok("the pptx zip reads back with every required part");
const part = (nm) => zip.get(nm).toString("utf8");
assert(part("ppt/slides/slide1.xml").includes("Hello, Acme Corp") && part("ppt/slides/slide2.xml").includes('show="0"')); ok("the pptx carries native text and the hidden flag");
assert(part("ppt/notesSlides/notesSlide1.xml").includes("Why we")); ok("the pptx carries the notes");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`slideware-engine-test: ${n} passed`);
