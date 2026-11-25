// policy-test.js — when scenes play, in Chrome: fonts arriving after mount, a scene moved in the DOM, CSS that would run
// on the wall clock, the render check's errors actually firing, and (with knowledgeware beside this plugin) a deck's
// click steps. Skips without a Chromium browser, and in CI unless CHROME is set.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { findChrome, launch } = require("../scripts/cdp");
const H = require("../scripts/htmlfile");
const { renderCheck } = require("../scripts/render");

if (!findChrome() || (process.env.CI && !process.env.CHROME)) { console.log("policy-test: skipped (no Chromium browser, or CI without CHROME set)"); process.exit(0); }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const scene = (name, attrs, css, markup, code) => `<am-scene name="${name}" aria-label="${name}" ${attrs} style="display:block; width: 400px; height: 200px">
  <template><style>${css}</style>${markup}<script type="text/animotion">${code}</script></template></am-scene>`;
const pageOf = (body) => H.inline(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${body}</body></html>`).text;

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n  ${(e.stack || String(e)).split("\n").slice(0, 3).join("\n  ")}`); process.exitCode = 1; } }

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animotion-policy-"));
  const browser = await launch();
  try {
    const open = async (html, query = "") => {
      const f = path.join(dir, `p${Math.random().toString(36).slice(2)}.html`);
      fs.writeFileSync(f, html);
      const p = await browser.newPage({ width: 800, height: 600 });
      await p.goto("file://" + f + query);
      await p.evaluate("AM.ready().then(() => true)");
      return { p, f };
    };
    const state = (p, n) => p.evaluate(`(() => { const s = AM.get(${JSON.stringify(n)}); return [s.state, +s.time.toFixed(2)]; })()`);
    const plain = pageOf(scene("a", 'poster="end"', "#b { width: 40px; height: 40px; background: red; }", '<div id="b"></div>', 's.tween("#b", { x: 300 }, 0, { dur: 6, ease: "linear" })'));

    await test("fonts arriving after mount re-measure and keep playing", async () => {
      const { p } = await open(plain);
      await wait(400);
      assert.equal((await state(p, "a"))[0], "playing");
      await p.evaluate('AM.get("a")._refont(); true');
      await wait(500);
      const [st, t] = await state(p, "a");
      assert.equal(st, "playing", "not parked on the poster for good");
      assert.ok(t > 0.2, "and its clock runs");
      await p.close();
    });

    await test("a scene moved in the DOM plays again, not frozen", async () => {
      const { p } = await open(plain);
      await wait(400);
      await p.evaluate('(() => { const s = AM.get("a"), d = document.createElement("div"); document.body.appendChild(d); d.appendChild(s); })(); true');
      await wait(600);
      const [st, t2] = await state(p, "a");
      assert.equal(st, "playing", "it plays again from the start once it's back on screen");
      assert.ok(t2 > 0.2 && t2 < 3, `and its clock runs (t = ${t2})`);
      await p.close();
    });

    await test("transitions are off, and an animation a state switches on is reported", async () => {
      const html = pageOf(scene("css", 'poster="end"', "#r { width: 40px; height: 40px; background: rgb(255, 0, 0); transition: background 1s; } #r[data-state=ok] { background: rgb(0, 128, 0); } @keyframes g { to { scale: 2; } } #q { width: 20px; height: 20px; } #q[data-state=on] { animation: g 2s 1 both; }",
        '<div id="r"></div><div id="q"></div>', 's.set("#r", { state: "ok" }, 1).set("#q", { state: "on" }, 1.5).wait(2)'));
      const { p, f } = await open(html, "?am-still");
      const bg = await p.evaluate('(() => { const s = AM.get("css"); s.seek(2); return getComputedStyle(s.shadowRoot.getElementById("r")).backgroundColor; })()');
      assert.equal(bg, "rgb(0, 128, 0)", "a seek shows the state at once, with no transition from the last frame");
      await p.close();
      const { results } = await renderCheck(f);
      assert.match(results[0].errors.join(), /animation started outside the scene's clock \(#q\)/);
    });

    await test("the render check's errors fire", async () => {
      const bad = pageOf(scene("bad", 'poster="start"', "#t { position: absolute; left: 0; top: 0; font-size: 16px; } #w { position: absolute; left: 380px; top: 10px; width: 80px; height: 20px; background: #888; }",
        '<span id="t">0</span><div id="w"></div>', 's.enter("#t", "fade", 0.5).enter("#w", "fade", 0.5).count("#t", { to: 3 }, ">").label("d").expect("d", "#t", { text: "4" })'));
      const f = path.join(dir, "bad.html");
      fs.writeFileSync(f, bad);
      const { results } = await renderCheck(f);
      const errs = results[0].errors.join(" | "), warns = results[0].warnings.join(" | ");
      assert.match(errs, /poster frame .* is blank/, "a poster before anything has entered");
      assert.match(errs, /expect at d on #t: text is "3", expected "4"/);
      assert.match(warns, /#w leaves the scene's box/);
    });

    const SW = path.join(__dirname, "..", "..", "knowledgeware", "skills", "slideware", "html", "engine", "cli.js");
    if (fs.existsSync(SW)) {
      await test("deck click steps: each click plays to its cue once; going back lands built", async () => {
        const deckDir = path.join(dir, "deck");
        execFileSync("node", [SW, "new", deckDir, "--brand", "style-1", "--title", "Steps"], { stdio: "ignore" });
        let d = fs.readFileSync(path.join(deckDir, "index.html"), "utf8");
        const sc = scene("st", 'trigger="steps"', "#b { width: 40px; height: 40px; background: red; }", '<div id="b"></div>',
          's.tween("#b", { x: 100 }, 0, { dur: 0.6 }).label("one").tween("#b", { x: 200 }, ">", { dur: 0.6 }).label("two")')
          .replace("</am-scene>", '<am-cue data-step="1" to="one"></am-cue><am-cue data-step="2" to="two"></am-cue></am-scene>')
          .replace("display:block;", "position: absolute; left: 100px; top: 200px;");
        d = d.replace("</main>", `<section data-key="s2"><h2>Scene</h2>${sc}</section><section data-key="s3"><h2>After</h2></section></main>`);
        fs.writeFileSync(path.join(deckDir, "index.html"), H.inline(d).text);
        const p = await browser.newPage({ width: 1280, height: 720 });
        await p.goto("file://" + path.join(deckDir, "index.html"));
        await p.evaluate("AM.ready().then(() => true)");
        await p.evaluate('window.__labels = 0; document.addEventListener("am:label", () => window.__labels++); SW.builds(true); SW.go(1, 0); true');
        await wait(300);
        assert.deepEqual(await state(p, "st"), ["held", 0], "held at the start before the first click");
        await p.evaluate("SW.next(); true");
        await wait(1200);
        assert.deepEqual(await state(p, "st"), ["held", 0.6]);
        for (let i = 0; i < 5; i++) await p.evaluate(`document.documentElement.classList.toggle("x-${i}"); true`);
        await wait(300);
        assert.equal(await p.evaluate("window.__labels"), 1, "unrelated class changes don't replay the cue");
        assert.equal(await p.evaluate('AM.get("st").shadowRoot.querySelector(".am-ctl").hidden'), true);
        await p.evaluate("SW.next(); true");
        await wait(1200);
        await p.evaluate("SW.next(); true");   // to the next slide
        await wait(300);
        await p.evaluate("SW.prev(); true");   // back: the slide arrives built
        await wait(150);
        assert.deepEqual(await state(p, "st"), ["held", 1.2], "arriving backwards shows the cued state, no replay");
        await p.close();
      });
    } else console.log("policy-test: deck steps skipped (knowledgeware isn't beside this plugin)");
  } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`policy-test: ${passed} passed${process.exitCode ? ", some failed" : ""}`);
})();
