// render-test.js — the runtime in Chrome: layout-dependent verbs (move onto an anchor, clone into a CSS grid, burst),
// the kit template, the render check and frame times. Skips when no Chromium browser is installed.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { findChrome, launch } = require("../scripts/cdp");
const H = require("../scripts/htmlfile");
const { renderCheck, timesFor } = require("../scripts/render");

// CI runners' Chrome sandboxing varies, so CI runs this only when CHROME names a browser explicitly.
if (!findChrome() || (process.env.CI && !process.env.CHROME)) { console.log("render-test: skipped (no Chromium browser, or CI without CHROME set)"); process.exit(0); }

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>body { margin: 0; --color-accent: #C8643B; }</style></head><body>
<am-scene name="team" poster="done" aria-label="One agent becomes six; all finish, one with a warning." style="display:block; width: 640px; height: 360px">
  <template>
    <style>
      #lead { position: absolute; left: 40px; top: 150px; width: 40px; height: 40px; background: var(--am-accent); }
      #grid { position: absolute; left: 300px; top: 60px; display: grid; grid-template-columns: repeat(3, 40px); gap: 24px; }
      #grid .agent { width: 40px; height: 40px; background: var(--am-accent); }
      #grid .agent[data-state=warn] { background: #D99A1E; }
      #goal { position: absolute; left: 560px; top: 280px; width: 24px; height: 24px; outline: 1px dashed #999; }
      #n { position: absolute; left: 40px; top: 20px; font: 20px monospace; }
      #list { position: absolute; left: 40px; top: 230px; width: 200px; margin: 0; padding: 0; list-style: none; font: 14px sans-serif; }
      #list li { padding: 8px; margin-bottom: 6px; background: #eee; }
      #bot { position: absolute; left: 120px; top: 60px; }
      #track { position: absolute; left: 300px; top: 320px; width: 300px; display: flex; justify-content: space-between; }
      .st { width: 10px; height: 10px; background: #ccc; } .st[data-state=ok] { background: #3C7D3A; }
      #runner { position: absolute; left: 290px; top: 315px; width: 20px; height: 20px; background: #222; }
    </style>
    <div id="lead"></div><div id="grid"><div class="agent" id="a"></div></div><div id="goal"></div><span id="n">1 agent</span>
    <ol id="list"><li id="r1">first</li><li id="r2">second</li><li id="r3">third</li></ol>
    <i id="bot" data-am-sprite="bot:calm"></i>
    <div id="track"><b class="st" id="s1"></b><b class="st" id="s2"></b><b class="st" id="s3"></b></div><i id="runner"></i>
    <script type="application/json" data-am-sprites>{ "bot": { "unit": 4, "palette": { "A": "#C8643B", "K": "#111" }, "poses": { "calm": ["AAAA", "AKKA", "AAAA"], "glad": ["AAAA", "KAAK", "AAAA"] } } }</script>
    <script type="text/animotion">
      s.enter("#lead", "pop", 0.1)
       .clone("#a", 5, ">", { from: "center" })
       .count("#n", { to: 6, format: "{n} agents" }, "<")
       .set("#a-3", { state: "warn" }, "+=0.2")
       .move("#lead", "#goal", ">", { arc: 30 })
       .burst("#goal", ">", { count: 12 })
       .enter("#r2", "append", 0.5, { dur: 1, ease: "linear" })
       .tween("#goal", { background: "color-mix(in oklab, #C8643B 30%, white)" }, 0, { dur: 1, from: { background: "rgba(0, 0, 0, 0)" }, ease: "linear" })
       .set("#goal", { opacity: 0.5 }, 0.05)
       .pose("#bot", "glad", 1)
       .move("#runner", "#s3", 0.2, { dur: 1, ease: "linear", pass: { targets: ".st", set: { state: "ok" } } })
       .label("done", "+=0.3")
       .expect("done", "#a-5", { visible: true })
       .expect("done", "#a-3", { state: "warn" })
       .expect("done", "#n", { text: "6 agents" })
       .expect("end", "#r2", { visible: true });
    </script>
  </template>
</am-scene>
</body></html>`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animotion-render-"));
  const file = path.join(dir, "page.html");
  try {
    fs.writeFileSync(file, H.setKit(H.inline(PAGE).text, "<style>:host { --am-accent: var(--color-accent); }</style>", "kit.html").text);

    const { results, pageErrors } = await renderCheck(file);
    assert.deepEqual(pageErrors, []);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].errors, [], "render check errors: " + results[0].errors.join("; "));
    assert.ok(results[0].info.labels.done > 1);

    // Geometry: the lead lands on its anchor; clones land in the grid's cells, out of the source's place.
    const browser = await launch(), page = await browser.newPage({ width: 800, height: 500 });
    await page.goto("file://" + file + "?am-still");
    await page.evaluate("AM.ready().then(() => true)");
    const g = await page.evaluate(`(() => {
      const s = AM.get("team"), r = s.shadowRoot, c = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; };
      s.seek("done");
      const out = { lead: c(r.getElementById("lead")), goal: c(r.getElementById("goal")), clones: [...r.querySelectorAll(".am-clone")].map(c), kit: getComputedStyle(r.getElementById("lead")).backgroundColor };
      s.seek(0); out.cloneAtStart = getComputedStyle(r.getElementById("a-1")).visibility;
      out.leadOpacity = (s.seek(0.5), getComputedStyle(r.getElementById("goal")).opacity);
      out.pose = [(s.seek(0.5), r.getElementById("bot").innerHTML.length), (s.seek(2), r.getElementById("bot").innerHTML)];
      // append: the row below never jumps and ends where the layout puts it
      const r3 = r.getElementById("r3"), tops = [];
      for (let t = 0; t <= 1.55; t += 0.05) { s.seek(t); tops.push(Math.round(r3.getBoundingClientRect().top)); }
      out.mid = (s.seek(0.5), getComputedStyle(r.getElementById("goal")).backgroundColor);
      out.tops = tops;
      // pass: each station turns ok as the runner's centre reaches it
      out.pass = [0.25, 0.75, 1.25].map((t) => (s.seek(t), [...r.querySelectorAll(".st")].map((e) => e.getAttribute("data-state") || "-").join("")));
      return out; })()`);
    await browser.close();
    assert.deepEqual(g.lead, g.goal, "move lands on the anchor's centre");
    assert.equal(g.clones.length, 5);
    assert.equal(new Set(g.clones.map((p) => p.join(","))).size, 5, "each clone in its own cell");
    assert.equal(g.kit, "rgb(200, 100, 59)", "the kit's tokens reach inside the scene");
    assert.equal(g.cloneAtStart, "hidden", "clones are hidden before they're made");
    assert.equal(g.leadOpacity, "0.5", "set can change opacity at once");
    assert.ok(/^rgba\(\d+, \d+, \d+, 0\.[45]/.test(g.mid), "a tween to a color-mix() tint interpolates (half-way: " + g.mid + ")");
    assert.ok(g.pose[0] > 0 && /fill="#111"/.test(g.pose[1]), "the sprite is drawn and changes pose");
    assert.ok(g.tops.every((v, i) => i === 0 || v >= g.tops[i - 1]), "rows below an appended row move down steadily: " + g.tops.join(","));
    assert.deepEqual(g.pass, ["ok--", "okok-", "okokok"], "stations tick in order as the runner reaches each");
    assert.ok(g.tops[g.tops.length - 1] - g.tops[0] <= 60, "and only by the row's own height: " + g.tops.join(","));

    const I = { duration: 4, labels: { a: 1, b: 2 }, items: [] };
    assert.deepEqual(timesFor(I, "labels"), [0, 1, 2, 4]);
    assert.deepEqual(timesFor(I, "every=1.5"), [0, 1.5, 3, 4]);
    console.log("render-test: OK");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch((e) => { console.error("FAIL render-test\n  " + (e.stack || e).toString().split("\n").slice(0, 4).join("\n  ")); process.exit(1); });
