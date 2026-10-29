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
  for (const f of ["edits.json", "index.html", "index-acme-life.html"]) { try { fs.unlinkSync(path.join(deck, f)); } catch (e) { /* absent */ } }
}
function build(...args) {
  try { return { out: execFileSync(process.execPath, ["build-deck.js", ".", ...args], { cwd: deck, env: ENV, stdio: "pipe" }).toString(), code: 0 }; }
  catch (e) { return { out: e.stdout.toString() + e.stderr.toString(), code: e.status }; }
}
const read = (f) => fs.readFileSync(path.join(deck, f), "utf8");
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
ok("without review, the deck carries no review plugin or config", () => {
  const html = read("index.html");
  assert.ok(!html.includes("RevealReview"));
  assert.ok(!/review: \{/.test(html));
  assert.match(html, /plugins: \[RevealPresenter\],/);
});

// ── Review inlining ──
ok("--review inlines review.js and the review config (built, lane, file)", () => {
  const r = build("--review");
  assert.strictEqual(r.code, 0, r.out);
  const html = read("index.html"), lane = read("index-acme-life.html");
  assert.match(html, /plugins: \[RevealPresenter, RevealReview\],/);
  assert.match(html, /review: \{"built":"\d{4}-\d\d-\d\dT[^"]+","lane":null,"file":"index.html"\},/);
  assert.match(lane, /review: \{"built":"[^"]+","lane":"acme-life","file":"index-acme-life.html"\},/);
  assert.ok(html.includes("root.RevealReview = function"));
  assert.match(r.out, /Review mode inlined \(--review\)/);
});
ok("review: true in slides.js does the same", () => {
  fs.writeFileSync(path.join(deck, "slides.js"), SLIDES.replace('lane: "Acme Corp",', 'lane: "Acme Corp",\n  review: true,'));
  const r = build();
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(read("index.html").includes("RevealReview"));
  assert.match(r.out, /review: true in slides.js/);
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
    assert.ok(root.body.includes("RevealReview"));
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
    assert.match(j.output, /Review mode inlined \(--review\)/);
    assert.ok(read("slides.js").includes(`title: "Served title"`));
    assert.ok(!fs.existsSync(path.join(deck, "edits.json")));
    assert.ok(read("index.html").includes("RevealReview"));
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
