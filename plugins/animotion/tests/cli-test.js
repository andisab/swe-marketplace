// cli-test.js — the parts of the CLI that read and rewrite a user's file, without a browser: htmlfile.js (finding
// scenes past scripts and comments, inlining the runtime and kit idempotently, removing them byte for byte), check.js
// (the static checks, including what must not trip them) and cli.js's argument handling.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const H = require(path.join(__dirname, "..", "scripts", "htmlfile.js"));
const { checkFile, codeOnly } = require(path.join(__dirname, "..", "scripts", "check.js"));
const CLI = path.join(__dirname, "..", "scripts", "cli.js");

let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n  ${e.stack.split("\n").slice(0, 3).join("\n  ")}`); process.exitCode = 1; } }

const scene = `<am-scene name="x" aria-label="y" poster="d" style="width: 100px; height: 50px"><template><b id="a">a</b><script type="text/animotion">s.wait(1).label("d")</script></template></am-scene>`;
const page = `<!doctype html><html><body>
<script>const tpl = "<am-scene name=\\"fake\\"></am-scene>"; const s = "</script" + ">";</script>
<!-- <am-scene name="commented"></am-scene> -->
${scene}
</body></html>`;

test("scenes are found past script strings and comments", () => {
  assert.deepEqual(H.scenes(page).map((s) => s.attrs.name), ["x"]);
  const p = `<html><body><script>var s = "<!--";</script>\n${scene}\n<script>var t = 1;</script></body></html>`;
  assert.equal(H.scenes(p).length, 1, "a lone <!-- inside a script doesn't hide what follows");
});

test("inline adds once, is idempotent, and removal restores the bytes", () => {
  const a = H.inline(page), b = H.inline(a.text);
  assert.deepEqual([a.action, b.action], ["added", "current"]);
  assert.match(a.text, /<\/script>\n<\/body>/, "the runtime sits just before </body>");
  assert.ok(!/<\/script/i.test(H.runtimeRegion(a.text).content), "the inlined runtime can't close its own script early");
  assert.equal(H.inline(a.text, { remove: true }).text, page);
  assert.equal(H.inline(a.text.replace(scene, "")).action, "removed", "no scene left: the runtime goes");
  assert.equal(H.inline(`<div></div>${scene}`).action, "added", "a page without </body> still gets it");
});

test("the kit is added, refreshed, kept intact and escaped", () => {
  const base = H.inline(page).text;
  const k1 = H.setKit(base, "<style>:host{--am-x:1}</style>", "animotion/kit.html"), k2 = H.setKit(k1.text, "<style>:host{--am-x:1}</style>", "animotion/kit.html");
  assert.deepEqual([k1.action, k2.action], ["added", "current"]);
  assert.ok(k1.text.indexOf('id="am-kit"') < k1.text.indexOf('id="am-runtime"'), "the kit comes before the runtime");
  const nested = `<style>:host{}</style><template><b>inner</b></template><script type="application/json" data-am-sprites>{"a":"</template>"}</script>`;
  assert.equal(H.kitRegion(H.setKit(base, nested, "k").text).content.trim(), nested.trim(), "a kit with a nested template round-trips");
  assert.match(H.setKit(base, "<style></style>", 'a"b').text, /data-source="a&quot;b"/);
  assert.equal(H.setKit(k1.text, null).text, base, "removing the kit restores the file");
});

test("hazards are found in code, not in comments or strings", () => {
  assert.equal(codeOnly('// Math.random()\ns.type("#a", "fetch() later"); /* Date.now() */ s.rand()').match(/Math\.random|fetch\(|Date\.now/), null);
  const mk = (code) => checkFile(H.inline(page.replace('s.wait(1).label("d")', code)).text);
  assert.deepEqual(mk('// no Math.random() here, we use s.rand()\ns.wait(1).label("d")').errors, []);
  assert.deepEqual(mk('s.text("#a", "call fetch() later").label("d")').errors, []);
  assert.match(mk('s.custom(null, () => Math.random()).label("d")').errors.join(), /Math\.random/);
  assert.match(mk("s.wait(1).label(").errors.join(), /doesn't parse/);
});

test("static checks: aria-label, posters, transitions", () => {
  const no = checkFile(H.inline(page.replace(' aria-label="y"', "")).text);
  assert.match(no.errors.join(), /needs aria-label/);
  const loop = checkFile(H.inline(page.replace(' poster="d"', ' loop="2"')).text);
  assert.match(loop.warnings.join(), /loops but names no poster/);
  const tr = checkFile(H.inline(page.replace("<b id=", "<style>b { transition: background .3s }</style><b id=")).text);
  assert.match(tr.warnings.join(), /transition/);
  const none = checkFile(H.inline(page.replace("<b id=", "<style>b { transition: none }</style><b id=")).text);
  assert.ok(!/transition/.test(none.warnings.join()), "transition: none is fine");
  assert.match(checkFile(page).errors.join(), /runtime isn't in the file/);
  assert.match(checkFile(page.replace("</body>", '<script src="runtime/animotion.js"></script></body>')).info.join(), /loads the runtime from runtime\/animotion\.js/);
});

test("cli: flags don't swallow the file name; bad options fail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animotion-cli-"));
  try {
    const f = path.join(dir, "p.html");
    fs.writeFileSync(f, page);
    const run = (...a) => { try { return { code: 0, out: execFileSync("node", [CLI, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status, out: (e.stdout || "") + (e.stderr || "") }; } };
    assert.match(run("inline", f).out, /added the animotion runtime/);
    const j = run("check", "--json", f);
    assert.equal(j.code, 0, j.out);
    assert.deepEqual(JSON.parse(j.out).errors, []);
    assert.match(run("inline", "--remove", f).out, /removed the runtime/, "--remove before the file");
    assert.equal(fs.readFileSync(f, "utf8"), page);
    const k = run("inline", f, "--kit", path.join(dir, "missing.html"));
    assert.equal(k.code, 2);
    assert.equal(fs.readFileSync(f, "utf8"), page, "a missing kit writes nothing");
    assert.equal(run("frames", f, "--max", "0").code, 2);
    assert.equal(run("frames", f, "--out", "x").code, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`cli-test: ${passed} passed${process.exitCode ? ", some failed" : ""}`);
