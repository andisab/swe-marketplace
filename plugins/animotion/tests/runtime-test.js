// runtime-test.js — the timeline core of runtime/animotion.js, without a browser: the position grammar, the verbs'
// channels, render(t) as a pure function of t (any seek order gives the same frame), formatting and errors.
// Layout-dependent verbs (move, clone, burst) are covered by render-test.js in Chrome.
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const R = require(path.join(__dirname, "..", "runtime", "animotion.js"));

// A small fake DOM: enough for the channels (style, text, attributes, classes) and selector lookup by #id / .class / tag.
function el(tag, id, text = "", cls = []) {
  const attrs = new Map(), classes = new Set(cls), style = {};
  return {
    tagName: tag.toUpperCase(), id, textContent: text, nodeType: 1,
    style: Object.assign(style, {
      setProperty(k, v) { if (v === "" || v === null) delete style["_" + k]; else style["_" + k] = v; },
      getPropertyValue(k) { return style["_" + k] || ""; },
    }),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: (k) => attrs.delete(k),
    // like a browser: toggling writes the class attribute, and removing the last class leaves class=""
    classList: { contains: (c) => classes.has(c), add: (c) => { classes.add(c); attrs.set("class", [...classes].join(" ")); },
      toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); attrs.set("class", [...classes].join(" ")); }, get length() { return classes.size; } },
  };
}
function root(els) {
  return {
    querySelectorAll(sel) {
      if (sel === "[id]") return els.filter((e) => e.id);
      if (sel.startsWith("#")) return els.filter((e) => e.id === sel.slice(1));
      if (sel.startsWith(".")) return els.filter((e) => e.classList.contains(sel.slice(1)));
      if (/^[a-z]+$/.test(sel)) return els.filter((e) => e.tagName === sel.toUpperCase());
      throw new Error("bad selector");
    },
  };
}
function scene(els) { return new R.Timeline(null, root(els), 1); }
// Compile once, as the runtime does (compiling reads the authored values), then render any time.
const compiled = new WeakMap();
function frame(tl, t) {
  let c = compiled.get(tl);
  if (!c) compiled.set(tl, (c = { out: R.compile(tl), cache: new Map() }));
  R.render(c.out, t, c.cache);
  return c.out;
}
const vis = (e) => e.style.visibility !== "hidden";

let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n  ${e.stack.split("\n").slice(0, 3).join("\n  ")}`); process.exitCode = 1; } }

test("position grammar", () => {
  const a = el("div", "a"), tl = scene([a]);
  tl.set("#a", { state: "x" });             // 0
  tl.wait(1);                               // end 1
  tl.label("one");                          // 1
  tl.tween("#a", { x: 10 }, undefined, { dur: 0.5 }); // 1 → 1.5
  assert.equal(tl.end, 1.5);
  tl.tween("#a", { y: 5 }, "<", { dur: 0.2 });        // starts with the previous: 1
  assert.equal(tl._prev.start, 1);
  tl.tween("#a", { y: 6 }, ">0.1", { dur: 0.2 });     // previous end 1.2 + 0.1
  assert.equal(+tl._prev.start.toFixed(6), 1.3);
  tl.tween("#a", { y: 7 }, "+=1", { dur: 0.1 });      // end 1.5 + 1
  assert.equal(tl._prev.start, 2.5);
  tl.tween("#a", { y: 8 }, "one+=0.25", { dur: 0.1 });
  assert.equal(tl._prev.start, 1.25);
  tl.tween("#a", { y: 9 }, 4, { dur: 0.1 });
  assert.equal(tl.end, 4.1);
  assert.throws(() => tl.tween("#a", { y: 1 }, "two"), /no label "two" \(labels so far: one\)/);
  assert.throws(() => tl.tween("#a", { y: 1 }, "?!"), /can't read position/);
});

test("unknown target names the scene's ids", () => {
  const tl = scene([el("div", "name"), el("div", "qty")]);
  assert.throws(() => tl.type("#nme", "x"), /s\.type: nothing in the scene matches "#nme" \(ids in the scene: #name, #qty\)/);
});

test("type: characters by time, caret on then off", () => {
  const f = el("span", "f", ""), tl = scene([f]);
  tl.type("#f", "ABCDEFGHIJ", 0, { cps: 10 });   // 1 s
  frame(tl, 0.5);
  assert.equal(f.textContent, "ABCDE");
  assert.ok(f.classList.contains("am-typing"));
  frame(tl, 2);
  assert.equal(f.textContent, "ABCDEFGHIJ");
  assert.ok(!f.classList.contains("am-typing"));
  assert.equal(f.getAttribute("class"), null, "no empty class attribute is left behind");
  frame(tl, 0);
  assert.equal(f.textContent, "");
});

test("type append keeps the text already there", () => {
  const f = el("span", "f", "> "), tl = scene([f]);
  tl.type("#f", "verify", 0, { cps: 6, append: true, caret: false });
  frame(tl, 0.5);
  assert.equal(f.textContent, "> ver");
});

test("count keeps the shape of the text", () => {
  const tot = el("b", "total", "$18.00"), open = el("span", "open", "0 open"), tl = scene([tot, open]);
  tl.count("#total", { to: -54 }, 0, { dur: 1 });
  tl.count("#open", { to: 2, format: "{n} open" }, 0, { dur: 1 });
  frame(tl, 1);
  assert.equal(tot.textContent, "-$54.00");
  assert.equal(open.textContent, "2 open");
  frame(tl, 0);
  assert.equal(tot.textContent, "$18.00");
  assert.equal(R.formatter(undefined, "1,250 users")(98765.4), "98,765 users");
  assert.equal(R.formatter(undefined, "-$54.00")(18), "$18.00", "a sign before the prefix isn't kept");
  assert.equal(R.numberShape("$-54").value, -54);
  assert.equal(R.numberShape("\u221254 kg").value, -54);
  assert.equal(R.formatter({ style: "currency", currency: "USD" })(-54), "-$54.00");
});

test("enter and exit: presence and opacity", () => {
  const a = el("div", "a"), tl = scene([a]);
  tl.enter("#a", "up", 1, { dur: 1 }).exit("#a", "fade", 3, { dur: 0.5 });
  frame(tl, 0.5);
  assert.ok(!vis(a), "hidden before it enters");
  frame(tl, 1.5);
  assert.ok(vis(a));
  assert.ok(+a.style.opacity > 0 && +a.style.opacity < 1);
  frame(tl, 2.5);
  assert.equal(a.style.opacity, "");               // 1 → authored value
  assert.equal(a.style.getPropertyValue("translate"), "");
  frame(tl, 4);
  assert.ok(!vis(a), "hidden after it exits");
  assert.notEqual(a.style.visibility, "visible", "never writes visible");
});

test("set: state, class and attr are discrete and seek back to the authored values", () => {
  const a = el("li", "a"), tl = scene([a]);
  a.setAttribute("data-state", "open");
  tl.set("#a", { state: "fixed", class: "+done -todo", attr: { title: "ok" } }, 1);
  frame(tl, 2);
  assert.equal(a.getAttribute("data-state"), "fixed");
  assert.ok(a.classList.contains("done"));
  assert.equal(a.getAttribute("title"), "ok");
  frame(tl, 0.5);
  assert.equal(a.getAttribute("data-state"), "open");
  assert.ok(!a.classList.contains("done"));
  assert.equal(a.getAttribute("title"), null);
});

test("render is order-independent", () => {
  const mk = () => { const a = el("div", "a", "0"), b = el("div", "b"); const tl = scene([a, b]); tl.count("#a", { to: 100 }, 0, { dur: 2 }).enter("#b", "pop", 0.5).tween("#b", { x: 40, rotate: 10 }, 1, { dur: 1 }).set("#b", { state: "on" }, 1.5); return { tl, a, b }; };
  const snap = (s) => JSON.stringify([s.a.textContent, s.b.style, s.b.getAttribute("data-state")]);
  const fresh = mk(), out = R.compile(fresh.tl);
  R.render(out, 1.25, new Map());
  const want = snap(fresh);
  const jumpy = mk(), out2 = R.compile(jumpy.tl), cache = new Map();
  for (const t of [3, 0, 1.9, 0.2, 2.5, 1.25]) R.render(out2, t, cache);
  assert.equal(snap(jumpy), want);
});

test("tween chains from the previous value; from overrides", () => {
  const a = el("div", "a"), tl = scene([a]);
  tl.tween("#a", { x: 100 }, 0, { dur: 1, ease: "linear" }).tween("#a", { x: 0 }, 1, { dur: 1, ease: "linear" });
  frame(tl, 1.5);
  assert.equal(a.style.getPropertyValue("translate"), "50px 0px");
  const b = el("div", "b"), t2 = scene([b]);
  t2.tween("#b", { scale: 2 }, 0, { dur: 1, from: { scale: 0 }, ease: "linear" });
  frame(t2, 0.25);
  assert.equal(b.style.getPropertyValue("scale"), "0.5 0.5");
  frame(t2, 0.5);
  assert.equal(b.style.getPropertyValue("scale"), "", "scale 1 is written as nothing");
});

test("stagger orders", () => {
  const tl = scene([]);
  assert.deepEqual(tl._offsets(4, 0.1).map((v) => +v.toFixed(2)), [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(tl._offsets(5, { each: 1, from: "center" }), [3, 1, 0, 2, 4]);
  assert.deepEqual(tl._offsets(3, { each: 1, from: "end" }), [2, 1, 0]);
  const r1 = new R.Timeline(null, root([]), 7)._offsets(6, { each: 1, from: "random" });
  const r2 = new R.Timeline(null, root([]), 7)._offsets(6, { each: 1, from: "random" });
  assert.deepEqual(r1, r2, "seeded: the same seed gives the same order");
});

test("eases", () => {
  const e = R.easeFn("cubic-bezier(0.33, 1, 0.68, 1)");
  assert.ok(Math.abs(e(0.5) - 0.875) < 0.01);
  assert.equal(R.easeFn("steps(4)")(0.3), 0.25);
  assert.ok(R.EASE.pop(0.7) > 1, "pop overshoots");
  assert.equal(R.easeFn("out")(1), 1);
  assert.throws(() => R.easeFn("wobbly"), /unknown ease "wobbly"/);
});

test("colours interpolate", () => {
  const f = R.interp("rgb(0, 0, 0)", "rgb(200, 100, 50)");
  assert.equal(f(0.5), "rgba(100, 50, 25, 1)");
  assert.equal(R.interp("rgba(0, 0, 0, 0)", "rgb(200, 100, 50)")(0.5), "rgba(200, 100, 50, 0.5)", "from transparent fades the colour in");
});

test("end and start are reserved label names", () => {
  const tl = scene([el("div", "a")]);
  assert.throws(() => tl.label("end"), /"end" is reserved/);
});

test("labels and expect record times", () => {
  const a = el("div", "a", "0 open"), tl = scene([a]);
  tl.count("#a", { to: 3, format: "{n} open" }, 0, { dur: 1 }).label("done").expect("done", "#a", { text: "3 open" });
  assert.equal(tl.labels.done, 1);
  assert.equal(tl.expects[0].t, 1);
  assert.throws(() => tl.expect("nope", "#a", {}), /no label "nope"/);
});

test("custom drives another engine by time", () => {
  const seen = [];
  const tl = scene([]);
  tl.custom(null, (el, p, t) => seen.push([+p.toFixed(2), t]), 1, { dur: 2 });
  const out = R.compile(tl);
  R.render(out, 2, new Map());
  assert.deepEqual(seen.pop(), [0.5, 2]);
  assert.equal(tl.duration, 3);
});

test("discrete before continuous at the same moment, by order added", () => {
  const a = el("div", "a"), tl = scene([a]);
  tl.set("#a", { text: "one" }, 1).set("#a", { text: "two" }, 1);
  frame(tl, 1);
  assert.equal(a.textContent, "two");
});

test("motion tokens set verb defaults", () => {
  const a = el("div", "a"), tl = new R.Timeline(null, root([a]), 1, { dur: { md: 0.2, lg: 1 }, ease: { enter: "linear" } });
  tl.enter("#a", "fade", 0);
  assert.equal(tl.end, 0.2, "enter takes md");
  tl.exit("#a", "fade", 1);
  assert.equal(+tl.end.toFixed(3), 1.14, "exit takes md × 0.7");
  tl.move("#a", { x: 10 }, 2);
  assert.equal(tl.end, 3, "move takes lg");
  const it = tl.items.find((i) => i.ch === "opacity");
  assert.equal(it.ease(0.5), 0.5, "the enter role uses the token's ease");
  const plain = new R.Timeline(null, root([el("div", "b")]), 1);
  plain.enter("#b", "fade", 0);
  assert.equal(plain.end, 0.45, "no tokens: the built-in default");
  assert.throws(() => new R.Timeline(null, root([el("div", "c")]), 1, { ease: { move: "wobbly" } }).move("#c", { x: 1 }), /--am-ease-move: unknown ease/);
});

test("review fixes: caret, numeric positions, prototype labels, colours, opacity, ease roles", () => {
  const f = el("span", "f"), tl = scene([f]);
  tl.type("#f", "hello", 0, { cps: 10 });
  frame(tl, tl.duration);
  assert.ok(!f.classList.contains("am-typing"), "a closing type verb clears its caret inside the timeline");
  assert.equal(tl._prev.end, 0.5, '">" still means when the typing ends');
  const t2 = scene([el("div", "a")]);
  t2.set("#a", { text: "x" }, "2.5");
  assert.equal(t2._prev.start, 2.5, "a numeric string is seconds");
  assert.throws(() => t2.set("#a", { text: "y" }, "constructor"), /no label "constructor"/);
  assert.equal(R.parseColor("1px solid rgb(0, 0, 0)"), null, "a shorthand with a colour in it isn't a colour");
  const half = el("div", "h"); half.style.opacity = "0.5";
  const t3 = scene([half]);
  t3.enter("#h", "fade", 0, { dur: 1 });
  frame(t3, 1);
  assert.equal(half.style.opacity, "0.5", "enter fades to the authored opacity");
  const t4 = new R.Timeline(null, root([el("div", "c")]), 1, { ease: { effect: "linear", move: "in" } });
  t4.tween("#c", { opacity: 0.5, x: 10 }, 0, { dur: 1 });
  const op = t4.items.find((i) => i.ch === "opacity"), x = t4.items.find((i) => i.ch === "x");
  assert.equal(op.ease(0.5), 0.5, "opacity takes the effect role");
  assert.equal(x.ease(0.5), 0.125, "x takes the move role");
  const t5 = scene([el("div", "m")]);
  t5.tween("#m", { x: 100 }, 5, { dur: 0.1 }).tween("#m", { x: 20 }, 1, { dur: 0.1 });
  assert.equal(t5._last(t5._els("#m")[0], "x"), 100, "the latest in time wins, not the latest added");
});

console.log(`runtime-test: ${passed} passed${process.exitCode ? ", some failed" : ""}`);
