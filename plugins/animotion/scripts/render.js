// render.js — what needs a browser: the render check (check --render) and frame sheets (frames).
// Both open the file in still mode (?capture for a slideware deck, ?am-still otherwise), so every scene rests on its
// poster and nothing plays on its own; then they seek scenes to exact times.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { launch } = require("./cdp");
const H = require("./htmlfile");

async function open(file, { width = 1280, height = 720, scale = 1 } = {}) {
  const text = fs.readFileSync(file, "utf8");
  const deck = H.isSlideware(text);
  const browser = await launch();
  try {   // a page that fails to load must not leave Chrome (and its profile folder) behind
    const page = await browser.newPage({ width, height, scale });
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await page.goto(pathToFileURL(path.resolve(file)).href + (deck ? "?capture" : "?am-still"));
    const ok = await page.evaluate(`typeof AM === "object" && !!AM.version`);
    if (!ok) throw new Error("the animotion runtime didn't load in the page (run `animotion inline <file>` first)");
    await page.evaluate("AM.ready().then(() => true)");
    return { browser, page, deck };
  } catch (e) { await browser.close(); throw e; }
}

// In-page helpers, installed once per page.
const HELPERS = String.raw`
window.__am = {
  scenes() { return [...document.querySelectorAll("am-scene")].filter((s) => !s.isCopy); },
  pick(sel) {
    const all = this.scenes();
    if (sel === undefined || sel === null || sel === "") return all;
    return all.filter((s, i) => s.getAttribute("name") === sel || String(i + 1) === String(sel));
  },
  // Show the scene's slide (decks only), so it can be seen and measured.
  show(s) {
    if (!window.SW || !SW.allSlides) return true;
    const sec = s.closest("section[data-key]");
    if (!sec) return false;
    const i = SW.slides().indexOf(sec);
    if (i < 0) return false;   // a hidden slide
    SW.go(i, 0);
    return true;
  },
  // What a frame shows, element by element: attributes and inline style declarations sorted, so the order a seek history
  // left them in doesn't count (an emptied style attribute changes nothing either).
  snap(s) {
    return [...s.shadowRoot.querySelectorAll(".am-stage *")].map((el) => {
      const st = [...el.style].map((k) => k + ":" + el.style.getPropertyValue(k)).sort().join(";");
      const at = el.getAttributeNames().filter((n) => n !== "style" && !(n === "class" && !el.getAttribute(n))).sort().map((n) => n + "=" + el.getAttribute(n)).join(" ");
      const name = el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : "");
      return { name, key: at + " | " + st + " | " + (el.children.length ? "" : el.textContent) };
    });
  },
  visible(el) {
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el); return cs.visibility !== "hidden" && +cs.opacity > 0.01 && cs.display !== "none";
  },
  check(s) {
    const r = { name: s.getAttribute("name") || "", errors: [], warnings: [], info: {} };
    if (s.error) { r.errors.push(s.error); return r; }
    if (s.closest("section[hidden]")) { r.warnings.push("is on a hidden slide, so it wasn't checked"); return r; }
    if (!s.offsetWidth || !s.offsetHeight) { r.errors.push("has no size (" + s.offsetWidth + " × " + s.offsetHeight + "): give it a width and height, by inline style or CSS"); return r; }
    if (!s._ensure()) { r.warnings.push(s.error || "isn't laid out (on a hidden slide, or display: none), so it wasn't checked"); return r; }
    const I = AM.inspect(s), D = I.duration;
    r.info = { duration: +D.toFixed(2), labels: I.labels, poster: +I.poster.toFixed(2), verbs: I.items.length };
    if (D < 0.3) r.warnings.push("is shorter than 0.3 s: is anything animated?");
    if (D > 30) r.errors.push("runs " + D.toFixed(1) + " s; keep a scene under 30 s (split it, or pace it with steps)");
    else if (D > 20) r.warnings.push("runs " + D.toFixed(1) + " s; over 20 s is long for one slide");
    const p = s.getAttribute("poster");
    if (p && p !== "end" && p !== "start" && isNaN(+p) && !(p in I.labels)) r.errors.push('poster="' + p + '" names no label (labels: ' + (Object.keys(I.labels).join(", ") || "none") + ")");
    for (const c of s.querySelectorAll(":scope > am-cue")) {
      const to = c.getAttribute("to");
      if (to && !(to in I.labels)) r.errors.push('<am-cue to="' + to + '"> names no label (labels: ' + (Object.keys(I.labels).join(", ") || "none") + ")");
    }
    // Seeking must be repeatable: the same time gives the same frame, whatever came before.
    const T = [D / 2, 0, D, D * 0.25, D * 0.8, D / 2];
    s.seek(T[0]); const a = this.snap(s);
    for (const t of T.slice(1)) s.seek(t);
    const b = this.snap(s), diff = a.findIndex((x, i) => !b[i] || x.key !== b[i].key);
    if (diff >= 0 || a.length !== b.length) {
      const x = a[diff] || a[a.length - 1], y = b[diff] || {};
      r.errors.push("seeking isn't repeatable: at " + T[0].toFixed(2) + " s " + (x ? x.name : "an element") + " differs after other seeks (" + (x ? x.key : "") + " → " + (y.key || "missing") + "); something depends on more than the timeline's time");
    }
    // CSS animations a state or class starts during the scene run on the wall clock, not the scene's: every still would differ.
    for (const el of s.shadowRoot.querySelectorAll(".am-stage *")) void getComputedStyle(el).animationName;   // style recalc creates them
    const strays = s.shadowRoot.getAnimations().filter((x) => !(s._css || []).includes(x));   // not adopted at compile
    if (strays.length) {
      const who = [...new Set(strays.map((x) => { const el = x.effect && x.effect.target; return el ? (el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : "")) : "?"; }))].slice(0, 4).join(", ");
      r.errors.push("a CSS animation started outside the scene's clock (" + who + "): drive it with a verb (tween, enter), or give the element the animation from the start so the runtime can seek it");
      strays.forEach((x) => x.cancel());
    }
    // Overflow, at every label and every half second.
    if (!s.hasAttribute("data-am-overflow")) {
      const times = [...new Set([...Object.values(I.labels), ...Array.from({ length: Math.min(80, Math.floor(D / 0.5) + 1) }, (_, i) => i * 0.5), D])].sort((x, y) => x - y);
      const host = s.getBoundingClientRect(), k = host.width / (s.offsetWidth || 1), seen = new Set(), out = new Set();
      for (const t of times) {
        s.seek(t);
        for (const el of s.shadowRoot.querySelectorAll(".am-stage *")) {
          if (/^(STYLE|SCRIPT)$/.test(el.tagName) || el.closest(".am-fx") || el.closest("[data-am-overflow]") || !this.visible(el)) continue;
          const b = el.getBoundingClientRect();
          if (!b.width && !b.height) continue;
          const tol = 2 * k;
          if (b.left < host.left - tol || b.top < host.top - tol || b.right > host.right + tol || b.bottom > host.bottom + tol) {
            if ([...out].some((o) => o.contains(el))) continue;   // its parent is already reported
            out.add(el);
            const id = el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
            if (!seen.has(id)) { seen.add(id); r.warnings.push(id + " leaves the scene's box at " + t.toFixed(2) + " s (data-am-overflow on it or the scene allows that)"); }
          }
        }
        if (seen.size > 6) break;
      }
    }
    // Text must be readable: something visible at the poster, and no text smaller than 12 px on the scene's own scale.
    s.seek(I.poster);
    const small = new Set();
    for (const el of s.shadowRoot.querySelectorAll(".am-stage *")) {
      if (!this.visible(el) || /^(STYLE|SCRIPT|svg|SVG)$/.test(el.tagName) || el.closest("svg")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const fs = parseFloat(getComputedStyle(el).fontSize);   // 0 is text hidden on purpose (a number swapped for a glyph)
      if (own && fs > 0 && fs < (document.getElementById("sw-slides") ? 14 : 12)) small.add(el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.classList[0] ? "." + el.classList[0] : ""));
    }
    if (small.size) r.warnings.push(document.getElementById("sw-slides")
      ? "text smaller than 14 px on a slide at the poster (" + [...small].slice(0, 5).join(", ") + "): labels on a projected slide are 16 px or more"
      : "text smaller than 12 px at the poster (" + [...small].slice(0, 5).join(", ") + "): raise it to 12 px or more");
    const shown = [...s.shadowRoot.querySelectorAll(".am-stage *")].filter((el) => !/^(STYLE|SCRIPT)$/.test(el.tagName) && this.visible(el) && el.getBoundingClientRect().width > 0);
    if (!shown.length) r.errors.push("the poster frame (" + I.poster.toFixed(2) + " s) is blank");
    // Assertions written with s.expect().
    for (const v of AM.verify(s)) if (!v.ok) r.errors.push("expect at " + v.at + " on " + v.target + ": " + v.msg);
    // Flashing: a channel that switches on and off more than 3 times within any second.
    const flips = {};
    for (const it of I.items) if (!it.fx && (it.ch === "presence" || it.ch.startsWith("class:"))) (flips[it.key + " " + it.ch] = flips[it.key + " " + it.ch] || { target: it.target, ch: it.ch, ts: [] }).ts.push(it.start);
    for (const f of Object.values(flips)) { const ts = f.ts.sort((x, y) => x - y); for (let i = 3; i < ts.length; i++) if (ts[i] - ts[i - 3] < 1) { r.warnings.push(f.target + " (" + f.ch + ") flips more than 3 times in a second (WCAG 2.3.1: keep flashes under 3 per second)"); break; } }
    s._park();
    return r;
  },
};`;

async function renderCheck(file) {
  const { browser, page, deck } = await open(file);
  try {
    await page.evaluate(HELPERS + "; true");
    const n = await page.evaluate("__am.scenes().length");
    const results = [];
    for (let i = 0; i < n; i++) {
      await page.evaluate(`__am.show(__am.scenes()[${i}])`);
      await page.evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
      results.push(await page.evaluate(`__am.check(__am.scenes()[${i}])`));
    }
    const pageErrors = page.console.filter((c) => c.type === "exception" || (c.type === "error" && /animotion/.test(c.text))).map((c) => c.text.split("\n")[0]);
    return { results, pageErrors, deck };
  } finally { await browser.close(); }
}

// Times to capture for one scene: "labels" (default: start, each label, end), "changes" (where verbs start or end),
// "every=0.5", or a list of seconds and label names "0,qty,fix+0.5". More than max are sampled evenly (reported).
function timesFor(I, at, max = 12) {
  const D = I.duration;
  let ts;
  if (!at || at === "labels") ts = [0, ...Object.values(I.labels), D];
  else if (at === "changes") ts = [0, ...I.items.flatMap((i) => [i.start, i.start + i.dur]), D];
  else if (/^every=/.test(at)) { const step = parseFloat(at.slice(6)) || 0.5; ts = Array.from({ length: Math.floor(D / step) + 1 }, (_, i) => i * step).concat(D); }
  else ts = at.split(",").map((x) => {
    const m = /^\s*([A-Za-z_][\w-]*)\s*(?:([+-])\s*(\d*\.?\d+))?\s*$/.exec(x);
    if (m && m[1] in I.labels) return I.labels[m[1]] + (m[2] ? (m[2] === "-" ? -1 : 1) * parseFloat(m[3]) : 0);
    if (m && (m[1] === "end" || m[1] === "poster" || m[1] === "start")) return m[1] === "start" ? 0 : m[1] === "end" ? D : I.poster;
    if (m) throw new Error(`--at: no label "${m[1]}" (labels: ${Object.keys(I.labels).join(", ") || "none"})`);
    return parseFloat(x);
  }).filter((v) => isFinite(v));
  ts = [...new Set(ts.map((t) => +Math.max(0, Math.min(D, t)).toFixed(3)))].sort((a, b) => a - b);
  if (ts.length > max) { const k = (ts.length - 1) / (max - 1); const all = ts.length; ts = Array.from({ length: max }, (_, i) => ts[Math.round(i * k)]); ts.sampled = all; }
  return ts;
}

async function frames(file, { scene, at, sheet, dir, cols = 3, cellWidth = 560, scale = 2, max = 12, autoName = false } = {}) {
  const { browser, page } = await open(file, { scale });
  const written = [];
  try {
    await page.evaluate(HELPERS + "; true");
    const picked = await page.evaluate(`__am.pick(${JSON.stringify(scene ?? null)}).map((s) => __am.scenes().indexOf(s))`);
    if (!picked.length) throw new Error(scene ? `no scene named or numbered "${scene}"` : "no scenes in the file");
    for (const idx of picked) {
      const shown = await page.evaluate(`__am.show(__am.scenes()[${idx}])`);
      if (!shown) { written.push({ scene: idx + 1, skipped: "on a hidden slide" }); continue; }
      await page.evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
      const I = await page.evaluate(`(() => { const s = __am.scenes()[${idx}]; s._ensure(); return AM.inspect(s); })()`);
      if (!I) { written.push({ scene: idx + 1, skipped: "doesn't compile (run check)" }); continue; }
      const name = I.name || `scene-${idx + 1}`;
      const labelAt = Object.fromEntries(Object.entries(I.labels).map(([k, v]) => [v.toFixed(3), k]));
      const shots = [];
      const times = timesFor(I, at, max);
      if (times.sampled) written.push({ scene: name, note: `${times.sampled} times asked, ${times.length} drawn (evenly sampled; raise --max to draw more)` });
      for (const t of times) {
        const rect = await page.evaluate(`(() => { const s = __am.scenes()[${idx}]; s.seek(${t}); const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
        const pad = 6;
        const png = await page.screenshot({ clip: { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + pad * 2, height: rect.height + pad * 2 } });
        const label = `${t.toFixed(2)} s${labelAt[t.toFixed(3)] ? ` · ${labelAt[t.toFixed(3)]}` : t === 0 ? " · start" : Math.abs(t - I.duration) < 1e-3 ? " · end" : ""}${Math.abs(t - I.poster) < 1e-3 ? " · poster" : ""}`;
        shots.push({ t, label, png });
        if (dir) {
          fs.mkdirSync(dir, { recursive: true });
          const f = path.join(dir, `${name.replace(/[^\w.-]+/g, "-")}-${t.toFixed(2)}.png`);
          fs.writeFileSync(f, png);
          written.push({ scene: name, file: f });
        }
      }
      await page.evaluate(`__am.scenes()[${idx}]._park()`);
      if (sheet) {
        const safe = name.replace(/[^\w.-]+/g, "-");   // a scene name becomes part of a file name
        const out = picked.length > 1 || autoName ? sheet.replace(/(\.png)?$/i, `-${safe}.png`) : sheet;
        await composeSheet(browser, shots, out, { cols, cellWidth, title: `${name} · ${I.duration.toFixed(2)} s · ${Object.keys(I.labels).length} labels` });
        written.push({ scene: name, file: out, frames: shots.length });
      }
    }
  } finally { await browser.close(); }
  return written;
}

// A contact sheet: the frames in a grid, each with its time and label, drawn by Chrome itself (no image library).
async function composeSheet(browser, shots, out, { cols, cellWidth, title }) {
  const page = await browser.newPage({ width: cols * (cellWidth + 16) + 16, height: 400, scale: 1 });
  const cells = shots.map((s) => `<figure><img src="data:image/png;base64,${s.png.toString("base64")}"><figcaption>${s.label}</figcaption></figure>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:12px 16px 16px;background:#1c1c1a;color:#eee;font:13px/1.3 system-ui,sans-serif}
    h1{font-size:14px;font-weight:600;margin:0 0 10px} .g{display:grid;grid-template-columns:repeat(${cols},${cellWidth}px);gap:16px}
    figure{margin:0} img{width:100%;display:block;background:#fff;border-radius:3px} figcaption{margin-top:5px;color:#f5c66b;font-variant-numeric:tabular-nums}
  </style><h1>${title.replace(/</g, "&lt;")}</h1><div class="g">${cells}</div>`;
  await page.evaluate(`document.open(); document.write(${JSON.stringify(html)}); document.close(); true`);
  await page.evaluate("Promise.all([...document.images].map((i) => i.decode().catch(() => {}))).then(() => true)");
  const h = await page.evaluate("Math.ceil(document.documentElement.scrollHeight)");
  await page.setViewport(cols * (cellWidth + 16) + 16, h, 1);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, await page.screenshot());
  await page.close();
}

module.exports = { renderCheck, frames, timesFor };
