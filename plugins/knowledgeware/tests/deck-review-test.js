#!/usr/bin/env node
// Tests slideware's HTML review flow against a temporary deck: the builder's addressable
// markup (data-key, data-f), review.js inlined only on request, edits.json folded into
// slides.js and lane overlays (exact and loose matches, ambiguous and missing text kept and
// layered, comments kept), and serve-deck.js's save and rebuild calls. Needs only node: a
// stub reveal.js stands in for the real package, since the builder only inlines its files.
//
// Usage: node plugins/knowledgeware/tests/deck-review-test.js
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PLUGIN = path.join(__dirname, "..");
const HTML = path.join(PLUGIN, "skills", "slideware", "html");
const TEMPLATES = path.join(HTML, "assets", "templates");
const ENV = { ...process.env, NODE_OPTIONS: "" };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kw-review-"));
const deck = path.join(tmp, "deck");
fs.mkdirSync(path.join(deck, "lanes"), { recursive: true });

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.log(`FAIL ${name}\n     ${where(e)}${e.message.split("\n").join("\n     ")}`); process.exitCode = 1; }
}
function where(e) { const m = (e.stack || "").match(/deck-review-test\.js:(\d+)/); return m ? `line ${m[1]}: ` : ""; }

// ── A deck with a stub reveal.js (the builder reads package.json's version, dist/reveal.css and dist/reveal.js) ──
const builder = fs.readFileSync(path.join(TEMPLATES, "build-deck.js"), "utf8");
const version = builder.match(/const REVEAL_VERSION = "([^"]+)"/)[1];
const stub = path.join(deck, "node_modules", "reveal.js", "dist");
fs.mkdirSync(stub, { recursive: true });
fs.writeFileSync(path.join(stub, "..", "package.json"), JSON.stringify({ name: "reveal.js", version }));
fs.writeFileSync(path.join(stub, "reveal.css"), ".reveal{}");
fs.writeFileSync(path.join(stub, "reveal.js"), "window.Reveal={initialize(){}};");
// A stub js-yaml too (no npm here): style.md's frontmatter is two levels of maps with
// quoted strings and numbers, which is all the builder's loadStyleSpec reads.
fs.mkdirSync(path.join(deck, "node_modules", "js-yaml"));
fs.writeFileSync(path.join(deck, "node_modules", "js-yaml", "index.js"), `
exports.load = (text) => {
  const out = {};
  let cur = out;
  for (const raw of text.split("\\n")) {
    const line = raw.replace(/\\s+#.*$/, "");
    if (!line.trim()) continue;
    const m = line.match(/^(\\s*)([\\w-]+):\\s*(.*)$/);
    if (!m) throw new Error("stub yaml: " + raw);
    const [, indent, key, rest] = m;
    const v = rest.trim();
    const value = v === "" ? null : /^'.*'$|^".*"$/.test(v) ? v.slice(1, -1) : v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
    if (indent === "") { if (value === null) cur = out[key] = {}; else { out[key] = value; cur = out; } }
    else cur[key] = value;
  }
  return out;
};
`);
for (const f of ["build-deck.js", "presenter.js", "review.js", "package.json"]) fs.copyFileSync(path.join(TEMPLATES, f), path.join(deck, f));
execFileSync(process.execPath, [path.join(HTML, "scripts", "load-style.js"), "style-1", "-o", path.join(deck, "style.md")], { env: ENV, stdio: "pipe" });

const SLIDES = `// slides.js — test deck. This comment, and the "quoted" words in it, must survive a fold.
module.exports = {
  lane: "Acme Corp",
  lanes: ["./lanes/acme-life.js"],
  slides: [
    { key: "cover", layout: "title", title: "Deck title", subtitle: 'Single quotes here', footer: \`Backticks here\` },
    { layout: "section", kicker: "PART ONE", title: "Section heading" },
    { key: "cols", layout: "two-column", title: "Two columns", left: "Left <strong>bold</strong><br/>line", right: "Shared text" },
    { layout: "card-row", title: "Cards", cards: [
      { heading: "Card 1", body: "Shared text" },
      { heading: "Card 2", body: "Short body." },
    ], notes: "What to say.\\n\\n- One\\n- Two [pause]", cue: { module: "Part one", run: "default" } },
    { layout: "quote", quote: "The medium is the message.", attribution: "— Someone" },
  ],
};
`;
const LANE = `module.exports = {
  name: "Acme Life",
  replace: [["Acme Corp", "Acme Life"]],
  slides: { cols: { right: "Lane text" } },
};
`;
function reset() {
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES);
  fs.writeFileSync(path.join(deck, "lanes", "acme-life.js"), LANE);
  for (const f of ["edits.json", "index.html", "index-acme-life.html", "index.review.html", "index-acme-life.review.html"]) { try { fs.unlinkSync(path.join(deck, f)); } catch (e) { /* absent */ } }
}
function build(...args) {
  try { return { out: execFileSync(process.execPath, ["build-deck.js", ".", ...args], { cwd: deck, env: ENV, stdio: "pipe" }).toString(), code: 0 }; }
  catch (e) { return { out: e.stdout.toString() + e.stderr.toString(), code: e.status }; }
}
const read = (f) => fs.readFileSync(path.join(deck, f), "utf8");
const fresh = (f) => { delete require.cache[require.resolve(f)]; return require(f); };
const edits = (slides, extra = {}) => fs.writeFileSync(path.join(deck, "edits.json"), JSON.stringify({ built: "2026-10-29T00:00:00Z", lane: null, file: "index.html", slides, ...extra }, null, 2));

// ── Markup ──
reset();
const plain = build();
ok("the deck builds with the stub reveal.js", () => assert.strictEqual(plain.code, 0, plain.out));
ok("every slide carries data-key: its key, else s<n> by position", () => {
  const keys = [...read("index.html").matchAll(/<section class="layout-[^"]*" data-key="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(keys, ["cover", "s2", "cols", "s4", "s5"]);
});
ok("text fields carry data-f, light-HTML fields also data-html, the notes aside data-f=notes", () => {
  const html = read("index.html");
  assert.match(html, /<h1[^>]* data-f="title">Deck title<\/h1>/);
  assert.match(html, /<div class="col-left"[^>]* data-f="left" data-html="">Left <strong>bold<\/strong><br\/>line<\/div>/);
  assert.match(html, /<h4 data-f="cards.1.heading">Card 2<\/h4><p data-f="cards.1.body" data-html="">Short body.<\/p>/);
  assert.match(html, /<aside class="notes" data-f="notes" data-module="Part one" data-run="default">What to say\.&#10;&#10;- One/);
  assert.match(html, /<blockquote[^>]* data-f="quote">/);
});
ok("unkeyed slides are marked data-key-auto; a lane marks the slides it changes and carries a colour", () => {
  const html = read("index.html"), lane = read("index-acme-life.html");
  assert.match(html, /data-key="s2" data-key-auto=""/);
  assert.ok(!/data-key="cover" data-key-auto/.test(html));
  assert.ok(!/<section[^>]*data-lane-changed/.test(html), "the base deck changes nothing");
  assert.match(lane, /data-key="cols"[^>]* data-lane-changed=""/, "the overlay replaces cols.right");
  assert.ok(!/data-key="cover"[^>]* data-lane-changed/.test(lane), "nothing in the cover changes in the lane");
  assert.match(html, /presenter: \{"sessions":\{\},"lanes":\[\{"name":"Acme Corp","file":"index.html","color":null,"current":true\},\{"name":"Acme Life","file":"index-acme-life.html","color":"#2F7DE1","current":false\}\]\}/);
});
ok("an overlay's own color is used and checked", () => {
  fs.writeFileSync(path.join(deck, "lanes", "acme-life.js"), LANE.replace('name: "Acme Life",', 'name: "Acme Life",\n  color: "#AA00FF",'));
  let r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("index.html").includes('"color":"#AA00FF"'));
  fs.writeFileSync(path.join(deck, "lanes", "acme-life.js"), LANE.replace('name: "Acme Life",', 'name: "Acme Life",\n  color: "blue",'));
  r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /lane acme-life: color must be a #rrggbb hex/);
  reset();
  build();
});
ok("without review, the deck carries no review plugin or config", () => {
  const html = read("index.html");
  assert.ok(!html.includes("root.RevealReview = function"));
  assert.ok(!/review: \{/.test(html));
  assert.match(html, /plugins: \[RevealPresenter\],/);
});

// ── Review inlining ──
ok("--review writes a .review flavour beside the clean files, with its own lane switcher", () => {
  const r = build("--review");
  assert.strictEqual(r.code, 0, r.out);
  const clean = read("index.html"), cleanLane = read("index-acme-life.html"), html = read("index.review.html"), lane = read("index-acme-life.review.html");
  assert.match(html, /plugins: \[RevealPresenter, RevealReview\],/);
  assert.match(html, /review: \{"built":"\d{4}-\d\d-\d\dT[^"]+","lane":null,"file":"index.review.html"\},/);
  assert.match(lane, /review: \{"built":"[^"]+","lane":"acme-life","file":"index-acme-life.review.html"\},/);
  assert.ok(html.includes("root.RevealReview = function"));
  assert.match(html, /<title>[^<]* · review<\/title>/);
  for (const c of [clean, cleanLane]) {
    assert.ok(!c.includes("root.RevealReview = function"), "the clean flavour carries no review code");
    assert.ok(!/review: \{/.test(c));
    assert.match(c, /plugins: \[RevealPresenter\],/);
  }
  assert.match(html, /"lanes":\[\{"name":"Acme Corp","file":"index\.review\.html"[^\]]*"file":"index-acme-life\.review\.html"/, "the review switcher links review files");
  assert.match(clean, /"lanes":\[\{"name":"Acme Corp","file":"index\.html"[^\]]*"file":"index-acme-life\.html"/, "the clean switcher links clean files");
  assert.match(r.out, /Review mode \(--review\) is in the \.review files only/);
  assert.match(r.out, /Share: index\.html and index-\*\.html, not the \.review files/);
});
ok("review: true in slides.js does the same, and dropping it removes the stale .review files", () => {
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('lane: "Acme Corp",', 'lane: "Acme Corp",\n  review: true,'));
  let r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("index.review.html").includes("root.RevealReview = function"));
  assert.ok(fs.existsSync(path.join(deck, "index-acme-life.review.html")));
  assert.match(r.out, /review: true in slides.js/);
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES);
  r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(!fs.existsSync(path.join(deck, "index.review.html")), "stale review file removed");
  assert.ok(!fs.existsSync(path.join(deck, "index-acme-life.review.html")));
  assert.match(r.out, /Removed index\.review\.html \(review is off\)/);
  reset();
});
ok("the build refuses when review.js is missing and says where to copy it from", () => {
  fs.renameSync(path.join(deck, "review.js"), path.join(deck, "review.js.bak"));
  const r = build("--review");
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /review\.js not found[\s\S]*cp \$PLUGIN\/skills\/slideware\/html\/assets\/templates\/review\.js/);
  fs.renameSync(path.join(deck, "review.js.bak"), path.join(deck, "review.js"));
});

// ── Fold ──
ok("edits fold into slides.js in every quote style, with newlines, keeping comments and layout", () => {
  reset();
  edits({
    cover: { title: { from: "Deck title", to: 'A "quoted" title' }, subtitle: { from: "Single quotes here", to: "It's single-quoted" }, footer: { from: "Backticks here", to: "Back`tick ${not code}" } },
    s4: { notes: { from: "What to say.\n\n- One\n- Two [pause]", to: "Say less.\n\n- One [pause]" }, "cards.1.heading": { from: "Card 2", to: "Card two" } },
    s5: { quote: { from: "The medium is the message.", to: "The medium is the message." } },   // unchanged: ignored
  });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  const src = read("slides.js");
  assert.ok(src.startsWith("// slides.js — test deck. This comment, and the \"quoted\" words in it, must survive a fold."));
  assert.ok(src.includes(`title: "A \\"quoted\\" title"`), src);
  assert.ok(src.includes(`subtitle: 'It\\'s single-quoted'`), src);
  assert.ok(src.includes("footer: `Back\\`tick \\${not code}`"), src);
  assert.ok(src.includes(`notes: "Say less.\\n\\n- One [pause]"`), src);
  assert.ok(src.includes(`{ heading: "Card two", body: "Short body." }`), src);
  assert.match(r.out, /Folded 5 edits from edits.json into slides.js \(2 slides\)\./);
  assert.match(r.out, /edits.json folded and removed\./);
  assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
  const folded = require(path.join(deck, "slides.js"));
  assert.strictEqual(folded.slides[0].footer, "Back`tick ${not code}");
  assert.strictEqual(folded.slides[3].notes, "Say less.\n\n- One [pause]");
  assert.ok(read("index.html").includes("Card two"));
});
ok("a light-HTML field matches loosely (the browser's innerHTML differs from the source)", () => {
  reset();
  edits({ cols: { left: { from: "Left <strong>bold</strong><br>line", to: "Left <em>edited</em><br>line" } } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("slides.js").includes(`left: "Left <em>edited</em><br>line"`));
});
ok("ambiguous and missing text stay in edits.json, are layered over the build, and comments are kept", () => {
  reset();
  edits({
    cols: { right: { from: "Shared text", to: "Right, edited" }, title: { from: "Two columns", to: "Two columns, edited" } },
    s4: { "cards.0.heading": { from: "Card one", to: "Card uno" }, comment: "Needs a stronger verb" },
  });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  const src = read("slides.js");
  assert.ok(src.includes(`title: "Two columns, edited"`));
  assert.ok(src.includes(`right: "Shared text"`), "the ambiguous text is untouched");
  assert.match(r.out, /kept in edits.json: cols.right \(text appears 2 times in slides.js\); layered over this build/);
  assert.match(r.out, /kept in edits.json: s4.cards.0.heading \(text not found in slides.js\)/);
  assert.match(r.out, /comment on s4: Needs a stronger verb/);
  const left = JSON.parse(read("edits.json"));
  assert.deepStrictEqual(Object.keys(left.slides).sort(), ["cols", "s4"]);
  assert.deepStrictEqual(left.slides.cols, { right: { from: "Shared text", to: "Right, edited" } });
  assert.deepStrictEqual(left.slides.s4, { "cards.0.heading": { from: "Card one", to: "Card uno" }, comment: "Needs a stronger verb" });
  const html = read("index.html");
  assert.match(html, /data-f="right" data-html="">Right, edited</);
  assert.match(html, /data-f="cards.0.heading">Card uno</);
  assert.ok(!read("index-acme-life.html").includes("Right, edited"), "base edits don't reach the lane");
  // Nothing new to fold: the file stays, the build still layers.
  const again = build();
  assert.strictEqual(again.code, 0, again.out);
  assert.ok(fs.existsSync(path.join(deck, "edits.json")));
  assert.ok(read("index.html").includes("Card uno"));
});
ok("edits made in a lane fold into that lane's overlay, not into slides.js", () => {
  reset();
  edits({ cols: { right: { from: "Lane text", to: "Lane text, edited" } } }, { lane: "acme-life", file: "index-acme-life.html" });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("lanes/acme-life.js").includes(`right: "Lane text, edited"`));
  assert.strictEqual(read("slides.js"), SLIDES);
  assert.ok(read("index-acme-life.html").includes("Lane text, edited"));
  assert.ok(!read("index.html").includes("Lane text, edited"));
  assert.match(r.out, /into lanes\/acme-life.js/);
});
ok("edits from a lane that no longer exists fail the build before anything is written", () => {
  reset();
  edits({ cols: { right: { from: "Lane text", to: "x" } } }, { lane: "gone" });
  const r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /saved in lane "gone", which slides.js no longer lists/);
  assert.strictEqual(read("slides.js"), SLIDES);
});
ok("a malformed edits.json fails the build and leaves slides.js alone", () => {
  reset();
  fs.writeFileSync(path.join(deck, "edits.json"), "{ not json");
  let r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /edits.json isn't valid JSON/);
  edits({ cover: { title: "no from/to" } });
  r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /cover.title must be \{ from, to \}/);
  assert.strictEqual(read("slides.js"), SLIDES);
});

// ── Structural fold: hidden, deleted, order ──
const KEYS = ["cover", "s2", "cols", "s4", "s5"];
ok("hidden, deleted and order fold into slides.js, comments travelling with their slides", () => {
  reset();
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('    { layout: "section",', '    // The first divider.\n    { layout: "section",'));
  edits({ cover: { title: { from: "Deck title", to: "Deck title, edited" } } }, { keys: KEYS, deck: { hidden: { s2: true }, deleted: ["s5"], order: ["cols", "cover", "s2", "s4", "s5"] } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  const src = read("slides.js");
  const at = (t) => src.indexOf(t);
  assert.ok(at('key: "cols"') < at('key: "cover"'), "cols now comes before cover:\n" + src);
  assert.ok(src.includes('{ hidden: true, layout: "section", kicker: "PART ONE"'), src);
  assert.ok(src.includes("// The first divider.\n    { hidden: true, layout: \"section\""), "the comment stays above its slide:\n" + src);
  assert.ok(!src.includes("The medium is the message."), "the quote slide is gone:\n" + src);
  assert.ok(src.includes('title: "Deck title, edited"'), "text edits fold too");
  assert.ok(src.startsWith("// slides.js — test deck."), "the header comment survives");
  assert.match(r.out, /Folded the slide list into slides.js \(1 hidden or shown, 1 deleted, reordered\)\./);
  assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
  const folded = fresh(path.join(deck, "slides.js"));
  assert.deepStrictEqual(folded.slides.map((x) => x.key || x.layout), ["cols", "cover", "section", "card-row"]);
  assert.strictEqual(folded.slides[2].hidden, true);
  const html = read("index.html");
  assert.ok(html.indexOf('data-key="cols"') < html.indexOf('data-key="cover"'));
  assert.ok(!html.includes("The medium is the message."));
});
ok("showing a slide removes its hidden field; the list is re-read to prove the fold", () => {
  reset();
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('{ layout: "section", kicker: "PART ONE", title: "Section heading" }', '{ layout: "section", hidden: true, kicker: "PART ONE", title: "Section heading" }'));
  edits({}, { keys: KEYS, deck: { hidden: { s2: false } } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  const src = read("slides.js");
  assert.ok(src.includes('{ layout: "section", kicker: "PART ONE", title: "Section heading" }'), src);
  assert.ok(!src.includes("hidden"), src);
  // hidden as the last entry: the comma before it goes with it
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('attribution: "— Someone" }', 'attribution: "— Someone", hidden: true }'));
  edits({}, { keys: KEYS, deck: { hidden: { s5: false } } });
  assert.strictEqual(build().code, 0);
  assert.ok(read("slides.js").includes('attribution: "— Someone" }'), read("slides.js"));
});
ok("structural edits made on a different slide list are kept and layered, not folded", () => {
  reset();
  edits({}, { keys: ["cover", "s2", "cols", "s4"], deck: { deleted: ["s4"], order: ["s4", "cover", "s2", "cols"] } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(read("slides.js"), SLIDES, "slides.js is untouched");
  assert.match(r.out, /kept in edits.json: the hidden \/ deleted \/ order edits \(slides.js's slide list changed since the edits were made\)/);
  const left = JSON.parse(read("edits.json"));
  assert.deepStrictEqual(left.deck, { deleted: ["s4"], order: ["s4", "cover", "s2", "cols"] });
  const html = read("index.html");   // auto keys are positional, so look for the slides' content
  assert.ok(!html.includes('data-f="title">Cards<'), "the deleted card-row slide is layered out");
  assert.ok(html.includes("The medium is the message."), "the quote slide, left out of the order, is kept at the end");
  assert.ok(html.indexOf('data-key="cover"') < html.indexOf('data-key="s2"'));
});
ok("in a lane, hidden and deleted go to the overlay by key, the order to slides.js, unkeyed slides are kept", () => {
  reset();
  edits({}, { lane: "acme-life", file: "index-acme-life.html", keys: KEYS, deck: { hidden: { cover: true }, deleted: ["cols", "s4"], order: ["s2", "cover", "cols", "s4", "s5"] } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  const lane = read("lanes/acme-life.js");
  assert.ok(lane.includes('cols: { right: "Lane text", hidden: true }') || lane.includes('cols: { right: "Lane text",hidden: true }') || /cols: \{[^}]*hidden: true/.test(lane), lane);
  assert.ok(/cover: \{ hidden: true \}/.test(lane), lane);
  const laneObj = fresh(path.join(deck, "lanes", "acme-life.js"));
  assert.strictEqual(laneObj.slides.cover.hidden, true);
  assert.strictEqual(laneObj.slides.cols.hidden, true);
  assert.strictEqual(laneObj.slides.cols.right, "Lane text");
  const src = read("slides.js");
  assert.ok(src.indexOf('layout: "section"') < src.indexOf('key: "cover"'), "the order went to slides.js:\n" + src);
  assert.match(r.out, /kept in edits.json: hidden for s4 \(a lane overlay needs the slide's own `key`/);
  const left = JSON.parse(read("edits.json"));
  assert.deepStrictEqual(left.deck, { hidden: { s4: true } });
  const laneHtml = read("index-acme-life.html");
  assert.match(laneHtml, /<section class="layout-card-row"[^>]*data-visibility="hidden"/);
  assert.ok(!/<section class="layout-card-row"[^>]*data-visibility="hidden"/.test(read("index.html")), "the base deck still shows it");
});
ok("after a reorder, leftovers and comments follow their slides to the new keys and the next build succeeds", () => {
  reset();
  // s4 (the card row) moves to the front and becomes s1; its ambiguous edit and comment must follow it.
  edits({ s4: { "cards.0.body": { from: "Shared text", to: "Card body, edited" }, comment: "tighten this" }, s2: { comment: "divider ok" } },
    { keys: KEYS, deck: { order: ["s4", "cover", "s2", "cols", "s5"], deleted: ["s5"] } });
  let r = build();
  assert.strictEqual(r.code, 0, r.out);
  const left = JSON.parse(read("edits.json"));
  assert.deepStrictEqual(left.keys, ["s1", "cover", "s3", "cols"]);
  assert.deepStrictEqual(Object.keys(left.slides).sort(), ["s1", "s3"]);
  assert.strictEqual(left.slides.s1.comment, "tighten this");
  assert.strictEqual(left.slides.s1["cards.0.body"].to, "Card body, edited");
  assert.strictEqual(left.slides.s3.comment, "divider ok");
  assert.strictEqual(left.deck, undefined);
  assert.match(read("index.html"), /<h4 data-f="cards.0.heading">Card 1<\/h4><p data-f="cards.0.body" data-html="">Card body, edited</, "the layered edit lands on the moved slide");
  r = build();   // the next build must not wedge on the stale keys
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("index.html").includes("Card body, edited"));
});
ok("an edit on a deleted slide is dropped, not left to wedge the build", () => {
  reset();
  edits({ s5: { quote: { from: "Nope", to: "x" }, comment: "gone" } }, { keys: KEYS, deck: { deleted: ["s5"], order: KEYS } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /dropped quote on s5: the slide was deleted/);
  assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
});
ok("an order that doesn't list every slide exactly once is kept, not folded", () => {
  reset();
  for (const order of [["cover", "s2", "cols", "s4"], ["cover", "cover", "s2", "cols", "s4"], ["cover", "s2", "cols", "s4", "zz"]]) {
    edits({}, { keys: KEYS, deck: { order } });
    const r = build();
    assert.strictEqual(r.code, 0, r.out);
    assert.strictEqual(read("slides.js"), SLIDES, "slides.js is untouched for " + order.join(","));
    assert.match(r.out, /the order doesn't list every slide exactly once/);
    assert.deepStrictEqual(JSON.parse(read("edits.json")).deck.order, order);
    fs.unlinkSync(path.join(deck, "edits.json"));
  }
});
ok("a deck dir given through a symlink builds from the folded slides.js", () => {
  reset();
  const link = path.join(tmp, "deck-link");
  try { fs.unlinkSync(link); } catch (e) { /* absent */ }
  fs.symlinkSync(deck, link, "dir");
  edits({ cover: { title: { from: "Deck title", to: "Through the symlink" } } });
  const r = (() => { try { return { out: execFileSync(process.execPath, ["build-deck.js", link], { cwd: link, env: ENV, stdio: "pipe" }).toString(), code: 0 }; } catch (e) { return { out: e.stdout.toString() + e.stderr.toString(), code: e.status }; } })();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("slides.js").includes('title: "Through the symlink"'));
  assert.ok(read("index.html").includes("Through the symlink"), "index.html was built from the stale module");
});
ok("a slide whose text contains \"key:\" still reorders", () => {
  reset();
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('notes: "What to say.', 'notes: "The key: takeaway. What to say.'));
  edits({}, { keys: KEYS, deck: { order: ["s2", "cover", "cols", "s4", "s5"] } });
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /Folded the slide list/);
  assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
});
ok("applyEdits layers hidden flags, the order and deletions", () => {
  const b = require(path.join(deck, "build-deck.js"));
  const slides = [{ key: "a", layout: "title", title: "A" }, { layout: "section", title: "B" }, { key: "c", layout: "quote", quote: "C", hidden: true }];
  const out = b.applyEdits(slides, [], { hidden: { c: false, a: true }, deleted: ["s2"], order: ["c", "s2", "a"] });
  assert.deepStrictEqual(out.map((x) => x.key || x.layout), ["c", "a"]);
  assert.strictEqual(out[0].hidden, undefined);
  assert.strictEqual(out[1].hidden, true);
  assert.throws(() => b.applyEdits(slides, [], { order: ["zz"] }), /deck.order names "zz"/);
});

// ── Spec and teaches ──
ok("a deck's spec is embedded and printed; teaches is validated, ignored by the renderer and safe from lane replacements", () => {
  reset();
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('lane: "Acme Corp",', 'lane: "Acme Corp",\n  spec: "./unit.html",')
    .replace('{ key: "cols", layout: "two-column",', '{ key: "cols", teaches: "Acme Corp-structure", layout: "two-column",'));
  let r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /Spec: \.\/unit\.html \(NOT FOUND next to the deck; the librarian can't follow it\) · 1 of 5 slides name the section they teach/);
  fs.writeFileSync(path.join(deck, "unit.html"), "<html></html>");
  r = build();
  assert.match(r.out, /Spec: \.\/unit\.html · 1 of 5/);
  assert.ok(read("index.html").includes('<meta name="knowledgeware-spec" content="./unit.html"/>'));
  assert.ok(read("index-acme-life.html").includes('<meta name="knowledgeware-spec" content="./unit.html"/>'), "lanes carry the same spec");
  assert.ok(!read("index.html").includes("teaches"), "teaches never renders");
  const laneObj = fresh(path.join(deck, "build-deck.js")).applyLane(fresh(path.join(deck, "slides.js")).slides, { name: "x", replace: [["Acme Corp", "Acme Life"]] }, "x");
  assert.strictEqual(laneObj[2].teaches, "Acme Corp-structure", "a replace pair never rewrites a section id");
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('{ key: "cols", layout: "two-column",', '{ key: "cols", teaches: 7, layout: "two-column",'));
  r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /slide 3: teaches must name a section id in the spec/);
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('lane: "Acme Corp",', 'lane: "Acme Corp",\n  spec: "",'));
  r = build();
  assert.notStrictEqual(r.code, 0);
  assert.match(r.out, /spec must be the path of the deck's spec page/);
  reset();
});

// ── Literal helpers ──
ok("stringLiterals and literal round-trip every quote style", () => {
  const b = require(path.join(deck, "build-deck.js"));
  const src = `// 'comment' "quotes"\nconst a = "d\\"q\\n", b = 'it\\'s', c = \`t\\\`x\${1}\`, d = \`plain\`; /* "no" */`;
  const lits = b.stringLiterals(src).map(l => [l.quote, l.value]);
  assert.deepStrictEqual(lits, [['"', 'd"q\n'], ["'", "it's"], ["`", "plain"]]);
  for (const q of ['"', "'", "`"]) {
    const text = "a \"b\" 'c' `d` ${e}\nf\\g";
    assert.strictEqual(new Function(`return ${b.literal(text, q)}`)(), text, `quote ${q}`);
  }
});

// ── serve-deck.js ──
(async () => {
  reset();
  build("--review");
  const { createServer } = require(path.join(HTML, "scripts", "serve-deck.js"));
  const server = createServer(deck);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const call = (method, p, body) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: p, headers: body ? { "Content-Type": "application/json" } : {} }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
  const t = async (name, fn) => { try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.log(`FAIL ${name}\n     ${where(e)}${e.message}`); process.exitCode = 1; } };

  await t("serve-deck serves the deck and answers /__status", async () => {
    const root = await call("GET", "/");
    assert.strictEqual(root.status, 200);
    assert.match(root.type, /text\/html/);
    assert.ok(!root.body.includes("root.RevealReview = function"), "the served index.html is the clean flavour");
    const rv = await call("GET", "/index.review.html");
    assert.strictEqual(rv.status, 200);
    assert.ok(rv.body.includes("root.RevealReview = function"));
    const st = JSON.parse((await call("GET", "/__status")).body);
    assert.deepStrictEqual({ ok: st.ok, slideware: st.slideware, hasEdits: st.hasEdits, hasBuilder: st.hasBuilder }, { ok: true, slideware: true, hasEdits: false, hasBuilder: true });
  });
  await t("serve-deck keeps requests inside the deck directory", async () => {
    const up = await call("GET", "/../slides.js");   // the URL normalizes to /slides.js: the deck's own file, nothing above it
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.body, read("slides.js"));
    assert.strictEqual((await call("GET", "/%2e%2e/%2e%2e/etc/passwd")).status, 404);
    assert.strictEqual((await call("GET", "/nope.html")).status, 404);
    assert.strictEqual((await call("GET", "/__edits")).status, 405);
    assert.strictEqual((await call("GET", "/__build")).status, 405);
  });
  await t("POST /__edits writes edits.json and POST /__build folds it with --review", async () => {
    const bad = await call("POST", "/__edits", "nope");
    assert.strictEqual(bad.status, 400);
    const saved = await call("POST", "/__edits", JSON.stringify({ built: "x", lane: null, file: "index.html", slides: { cover: { title: { from: "Deck title", to: "Served title" } } } }));
    assert.strictEqual(saved.status, 200, saved.body);
    assert.ok(fs.existsSync(path.join(deck, "edits.json")));
    const built = await call("POST", "/__build", JSON.stringify({ review: true }));
    const j = JSON.parse(built.body);
    assert.strictEqual(built.status, 200, built.body);
    assert.strictEqual(j.ok, true);
    assert.match(j.output, /Folded 1 edit from edits.json into slides.js/);
    assert.match(j.output, /Review mode \(--review\) is in the \.review files only/);
    assert.ok(read("slides.js").includes(`title: "Served title"`));
    assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
    assert.ok(read("index.review.html").includes("root.RevealReview = function"));
  });
  await t("a failing build comes back as ok: false with the builder's output", async () => {
    fs.writeFileSync(path.join(deck, "slides.js"), "module.exports = { slides: [{ layout: 'nope' }] };");
    const built = await call("POST", "/__build", "");
    const j = JSON.parse(built.body);
    assert.strictEqual(built.status, 500);
    assert.strictEqual(j.ok, false);
    assert.match(j.output, /Unknown layout: "nope"/);
  });
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(process.exitCode ? `\n${passed} passed, some FAILED` : `\nall ${passed} passed`);
})();
