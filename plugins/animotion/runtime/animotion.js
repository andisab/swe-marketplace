// animotion.js — animated scenes for single-file HTML: one isolated element, <am-scene>, on one seekable clock.
//
// A scene is a <template> rendered into the element's shadow root, plus a timeline written with verbs
// (s.enter, s.move, s.type, s.count, …) that the runtime evaluates as a pure function of time: render(t)
// is synchronous and order-independent, so any moment can be shown exactly (posters, print, checks).
//
//   <am-scene loop="3" poster="fixed" aria-label="What the scene shows" style="width: 900px; height: 400px">
//     <template>
//       <style>…</style> …markup…
//       <script type="text/animotion"> s.type("#name", "AAAA").label("fixed") </script>
//     </template>
//   </am-scene>
//
// Plays when it can be seen: in a slideware deck, while its slide is current and the deck is presenting or
// viewed (not printed, captured, edited, blacked out or in the presenter window); on any other page, while
// it is on screen. Otherwise it rests on its poster. Reduced motion shows the poster only.
// The contract and the verbs: skills/animotion/references/contract.md and verbs.md in the animotion plugin.
(function (global) {
  "use strict";
  const VERSION = "0.1.0";

  // ── easing ──────────────────────────────────────────────────────────────────────────────
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let t = p;
      for (let i = 0; i < 8; i++) {
        const e = X(t) - p, d = dX(t);
        if (Math.abs(e) < 1e-6) break;
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      if (t < 0 || t > 1 || Math.abs(X(t) - p) > 1e-4) {   // fall back to bisection
        let lo = 0, hi = 1; t = p;
        for (let i = 0; i < 30; i++) { if (X(t) < p) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return Y(t);
    };
  }
  const EASE = {
    linear: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    "in-out": null, // alias, filled below
    pop: (p) => { const c = 1.7, d = c + 1; return 1 + d * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    back: null,
    bounce: (p) => {
      const n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    },
    spring: (p) => 1 - Math.exp(-6 * p) * Math.cos(9 * p) * (1 - p),   // a short settle with one overshoot
    standard: bezier(0.2, 0, 0, 1),
    emphasized: bezier(0.3, 0, 0, 1),
  };
  EASE["in-out"] = EASE.inOut;
  EASE.back = EASE.pop;
  function easeFn(e) {
    if (typeof e === "function") return e;
    if (e === undefined || e === null) return EASE.inOut;
    const s = String(e).trim();
    if (EASE[s]) return EASE[s];
    let m = /^steps\((\d+)\)$/.exec(s);
    if (m) { const n = +m[1]; return (p) => (p >= 1 ? 1 : Math.floor(p * n) / n); }
    m = /^cubic-bezier\(([^)]+)\)$/.exec(s);
    if (m) { const v = m[1].split(",").map(Number); if (v.length === 4 && v.every(isFinite)) return bezier(...v); }
    throw new Error(`unknown ease "${s}" (use ${Object.keys(EASE).join(", ")}, steps(n) or cubic-bezier(a, b, c, d))`);
  }

  // ── seeded random (no Math.random: every frame must be reproducible) ─────────────────────
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ── values ────────────────────────────────────────────────────────────────────────────
  const lerp = (a, b, p) => a + (b - a) * p;
  const clamp01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
  function parseNum(v) {   // "12px" → { n: 12, unit: "px" }
    if (typeof v === "number") return { n: v, unit: "" };
    const m = /^\s*(-?[\d.]+(?:e-?\d+)?)\s*([a-z%]*)\s*$/i.exec(String(v));
    return m ? { n: parseFloat(m[1]), unit: m[2] } : null;
  }
  function parseColor(v) {   // rgb()/rgba() strings, as getComputedStyle returns them
    const m = /^\s*rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)\s*$/i.exec(String(v));
    if (!m) return null;
    let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  }
  // Any colour CSS can compute (oklab() from color-mix, oklch(), lab(), color(…)) as rgba(), through a canvas pixel,
  // so it can be interpolated. Returns the value unchanged when it isn't a colour.
  let canvasCx = null;
  function toRgba(doc, v) {
    if (typeof v !== "string" || parseColor(v) || !doc || !doc.createElement) return v;
    if (!/^(oklab|oklch|lab|lch|color|hsla?|hwb)\(|^#|^[a-z]+$/i.test(v.trim()) || /^(none|auto|inherit|initial|unset|currentcolor)$/i.test(v.trim())) return v;
    try {
      canvasCx = canvasCx || Object.assign(doc.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
      canvasCx.clearRect(0, 0, 1, 1);
      canvasCx.fillStyle = "rgba(0, 0, 0, 0)";
      canvasCx.fillStyle = v;
      canvasCx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = canvasCx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    } catch (e) { return v; }
  }
  const colorStr = (c) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${+c[3].toFixed(3)})`;

  // Count formatting: keep the prefix, suffix, decimals and grouping of the text being counted ("$18.00" → "-$54.00").
  function numberShape(text) {
    // The sign may sit before the prefix ("-$54.00") or after it ("$-54"); either way it isn't part of the prefix.
    const m = /^(-?)([^\d-]*?)(-?)([\d,]*\.?\d+)(.*)$/s.exec(String(text || "").replace(/\u2212/g, "-"));
    if (!m) return { prefix: "", suffix: "", decimals: 0, group: false, value: 0 };
    const digits = m[4], dot = digits.indexOf(".");
    return { prefix: m[2], suffix: m[5], decimals: dot < 0 ? 0 : digits.length - dot - 1, group: digits.includes(","), value: (m[1] || m[3] ? -1 : 1) * parseFloat(digits.replace(/,/g, "")) };
  }
  function formatter(format, startText) {
    if (typeof format === "function") return format;
    if (typeof format === "string") {
      const d = (/\{n:(\d+)\}/.exec(format) || [])[1];
      return (n) => format.replace(/\{n(?::\d+)?\}/g, d === undefined ? String(Math.round(n)) : n.toFixed(+d));
    }
    if (format && typeof format === "object") {
      const nf = new Intl.NumberFormat(format.locale || "en-US", format);
      return (n) => nf.format(n);
    }
    const sh = numberShape(startText);
    return (n) => {
      const abs = Math.abs(n), r = sh.decimals ? abs.toFixed(sh.decimals) : String(Math.round(abs));
      const [i, f] = r.split(".");
      const body = (sh.group ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i) + (f ? "." + f : "");
      return (n < 0 && Math.round(abs * Math.pow(10, sh.decimals)) !== 0 ? "-" : "") + sh.prefix + body + sh.suffix;
    };
  }

  // ── the timeline: verbs add items to channels; compile() resolves each channel's chain ──────
  // A channel is one thing a verb writes on one element: x, y, sx, sy, rotate, opacity, presence, text,
  // attr:<name>, class:<token>, style:<property>, dash, clip. An item covers [start, start + dur] and maps
  // progress p (eased) and the channel's value at its start to a value. Before the first item a channel
  // shows its base (the authored value); after an item ends it holds that item's end value.
  const DEFAULTS = { enter: 0.45, exit: 0.3, move: 0.6, tween: 0.5, count: 0.8, draw: 0.9, clone: 0.45, burst: 1.1 };
  // Motion tokens a visual language may set on the scene (or any ancestor) as custom properties:
  // --am-dur-xs … --am-dur-xl (ms or s) and --am-ease-enter / -exit / -move / -effect (a name or cubic-bezier()).
  // Verbs then default to them: enter md, exit md × 0.7, move lg, tween md, count lg, draw xl, clone md.
  const DUR_STEP = { enter: "md", move: "lg", tween: "md", count: "lg", draw: "xl", clone: "md" };
  const ROLE_EASE = { enter: "out", exit: "in", move: "inOut", effect: "cubic-bezier(0.33, 0, 0.67, 1)" };
  function readTokens(el) {
    if (!el || typeof getComputedStyle !== "function") return {};
    const cs = getComputedStyle(el), dur = {}, ease = {};
    for (const k of ["xs", "sm", "md", "lg", "xl"]) {
      const v = cs.getPropertyValue("--am-dur-" + k).trim(), n = parseNum(v);
      if (n && isFinite(n.n)) dur[k] = n.unit === "s" ? n.n : n.n / 1000;
    }
    for (const k of Object.keys(ROLE_EASE)) { const v = cs.getPropertyValue("--am-ease-" + k).trim(); if (v) ease[k] = v; }
    return { dur, ease };
  }
  const PRESETS = {   // entrances, matched to slideware's data-a offsets
    fade: {},
    up: { y: 14 }, down: { y: -14 }, left: { x: -18 }, right: { x: 18 },
    pop: { s: 0.82, ease: "pop" },
    "grow-x": { sx: 0, opacity: false, origin: "left center" }, "grow-y": { sy: 0, opacity: false, origin: "center bottom" },
    wipe: { clip: true, opacity: false }, draw: { draw: true, opacity: false },
    append: { height: true },
  };
  const TRANSFORM = new Set(["x", "y", "sx", "sy", "rotate"]);

  class Timeline {
    constructor(scene, root, seed, tokens = {}) {
      this._scene = scene;     // the <am-scene> host (null in tests)
      this._tok = { dur: tokens.dur || {}, ease: tokens.ease || {} };
      this._root = root;       // where selectors resolve: the scene's stage
      this.items = [];
      this.labels = Object.create(null);   // no prototype: "constructor" isn't a label
      this.expects = [];
      this.end = 0;
      this._prev = { start: 0, end: 0 };
      this._verb = "";
      this.rand = rng(seed);
    }
    get duration() { return this.end; }
    // The scene's stage, for building markup before the verbs run (e.g. root.querySelector("#bot").innerHTML = AM.sprite(…)).
    get root() { return this._root; }
    // A verb's default duration and an ease name, through the scene's motion tokens.
    _dur(kind) {
      const d = this._tok.dur;
      if (kind === "exit") return d.md !== undefined ? d.md * 0.7 : DEFAULTS.exit;
      const step = DUR_STEP[kind];
      return step && d[step] !== undefined ? d[step] : DEFAULTS[kind];
    }
    _ease(e) {
      if (typeof e === "string" && e in ROLE_EASE) {
        try { return easeFn(this._tok.ease[e] || ROLE_EASE[e]); } catch (err) { this._fail(`--am-ease-${e}: ${err.message}`); }
      }
      return easeFn(e);
    }

    // Position grammar (GSAP's): omitted = end of the timeline; number = seconds; "<" start of the previous
    // verb, ">" its end, "<0.2" / ">-0.1" offsets; "+=1" / "-=0.5" from the end; "label", "label+=0.5".
    _at(pos) {
      if (pos === undefined || pos === null || pos === "") return this.end;
      if (typeof pos === "number") { if (!isFinite(pos) || pos < 0) this._fail(`position ${pos} must be a number of seconds ≥ 0`); return pos; }
      const s = String(pos).trim();
      if (/^\d*\.?\d+$/.test(s)) return parseFloat(s);
      let m = /^([<>])\s*([+-]?(?:=)?\s*\d*\.?\d+)?$/.exec(s);
      if (m) {
        const base = m[1] === "<" ? this._prev.start : this._prev.end;
        return Math.max(0, base + (m[2] ? parseFloat(m[2].replace("=", "").replace(/\s/g, "")) : 0));
      }
      m = /^([+-])=?\s*(\d*\.?\d+)$/.exec(s);
      if (m) return Math.max(0, this.end + (m[1] === "-" ? -1 : 1) * parseFloat(m[2]));
      m = /^([A-Za-z_][\w-]*)\s*(?:([+-])=?\s*(\d*\.?\d+))?$/.exec(s);
      if (m) {
        if (!(m[1] in this.labels)) {
          const known = Object.keys(this.labels);
          this._fail(`no label "${m[1]}"${known.length ? ` (labels so far: ${known.join(", ")})` : " (no labels yet; s.label(name) adds one)"}`);
        }
        return Math.max(0, this.labels[m[1]] + (m[2] ? (m[2] === "-" ? -1 : 1) * parseFloat(m[3]) : 0));
      }
      this._fail(`can't read position "${s}" (use seconds, "<", ">", "<0.2", "+=1", "label" or "label+=0.5")`);
    }
    _fail(msg) { throw new Error(`${this._verb ? `s.${this._verb}: ` : ""}${msg}`); }

    // Targets: a selector inside the scene, an element, or a list of either.
    _els(target) {
      if (target === null || target === undefined) this._fail("needs a target (a selector inside the scene, or an element)");
      if (typeof target === "string") {
        let list;
        try { list = [...this._root.querySelectorAll(target)]; } catch (e) { this._fail(`"${target}" isn't a valid selector`); }
        if (!list.length) {
          const ids = this._root.querySelectorAll ? [...this._root.querySelectorAll("[id]")].map((e) => "#" + e.id).slice(0, 12) : [];
          this._fail(`nothing in the scene matches "${target}"${ids.length ? ` (ids in the scene: ${ids.join(", ")})` : ""}`);
        }
        return list;
      }
      if (Array.isArray(target)) return target.flatMap((t) => this._els(t));
      if (target && typeof target.length === "number" && !target.nodeType) return [...target];
      return [target];
    }
    // Stagger: { stagger: 0.1 } or { stagger: { each: 0.1, from: "start" | "end" | "center" | "random" } }.
    _offsets(n, stagger) {
      if (!stagger) return new Array(n).fill(0);
      const each = typeof stagger === "number" ? stagger : stagger.each || 0;
      const from = (typeof stagger === "object" && stagger.from) || "start";
      const order = [...Array(n).keys()];
      if (from === "end") order.reverse();
      else if (from === "center") { const c = (n - 1) / 2; order.sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b); }
      else if (from === "random") { for (let i = n - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } }
      const off = new Array(n);
      order.forEach((idx, rank) => { off[idx] = rank * each; });
      return off;
    }
    // The primitive every verb uses: one item on one channel of one element.
    _item(el, ch, start, dur, fn, o = {}) {
      this.items.push({ el, ch, start, dur: Math.max(0, dur), fn, ease: o.discrete ? null : this._ease(o.ease), discrete: !!o.discrete, verb: this._verb, n: this.items.length, clear: !!o.clear, back: !!o.back });
    }
    _group(start, ends) {
      const end = Math.max(start, ...ends);
      this._prev = { start, end };
      if (end > this.end) this.end = end;
    }
    _run(verb, f) { const v = this._verb; this._verb = verb; try { f(); } finally { this._verb = v; } return this; }

    // ── public primitives (for AM.verb authors) ──
    // s.track(target, channel, to, pos, { from, dur, ease, stagger }) — a continuous value: numbers, "12px", colours.
    track(target, ch, to, pos, o = {}) {
      return this._run(this._verb || "track", () => {
        const els = this._els(target), start = this._at(pos), dur = o.dur ?? this._dur("tween"), off = this._offsets(els.length, o.stagger);
        els.forEach((el, i) => this._item(el, ch, start + off[i], dur, interp(o.from, to), Object.assign({ ease: TRANSFORM.has(ch) ? "move" : "effect" }, o)));
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    // s.cue(target, channel, value, pos, { stagger }) — a discrete value, or a generator (p, startValue) => value with { dur }.
    cue(target, ch, value, pos, o = {}) {
      return this._run(this._verb || "cue", () => {
        const els = this._els(target), start = this._at(pos), off = this._offsets(els.length, o.stagger);
        const gen = typeof value === "function", dur = gen ? o.dur ?? 0 : 0;
        els.forEach((el, i) => this._item(el, ch, start + off[i], dur, gen ? value : () => value, { discrete: !gen, ease: gen ? o.ease ?? "linear" : null }));
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    // s.custom(target | null, (el, p, t) => {…}, pos, { dur }) — escape hatch: called on every render.
    // With target null it is scene-level: the way to drive another engine (an anime.js or GSAP timeline) by seeking it.
    custom(target, fn, pos, o = {}) {
      return this._run("custom", () => {
        const els = target === null ? [null] : this._els(target), start = this._at(pos), dur = o.dur ?? 0;
        els.forEach((el) => this.items.push({ el, ch: "custom", start, dur, custom: fn, ease: this._ease(o.ease || "linear"), n: this.items.length, verb: "custom" }));
        this._group(start, [start + dur]);
      });
    }

    // ── verbs ──
    label(name, pos) {
      return this._run("label", () => {
        if (!/^[A-Za-z_][\w-]*$/.test(String(name))) this._fail(`label "${name}" must be a word (letters, digits, - and _)`);
        if (name === "end" || name === "start") this._fail(`"${name}" is reserved (poster="${name}" and expect("${name}", …) already mean the scene's ${name}); pick another name`);
        const t = this._at(pos);
        this.labels[name] = t;
        this._prev = { start: t, end: t };
        if (t > this.end) this.end = t;
      });
    }
    wait(sec) {
      return this._run("wait", () => {
        if (!(sec >= 0)) this._fail("needs seconds ≥ 0");
        const start = this.end;
        this.end += sec;
        this._prev = { start, end: this.end };
      });
    }
    set(target, props, pos, o = {}) {
      return this._run("set", () => {
        if (!props || typeof props !== "object") this._fail("needs an object: { state, text, class, attr, style }");
        const els = this._els(target), start = this._at(pos), off = this._offsets(els.length, o.stagger);
        els.forEach((el, i) => {
          const t = start + off[i], it = (ch, v) => this._item(el, ch, t, 0, () => v, { discrete: true });
          for (const [k, v] of Object.entries(props)) {
            if (k === "state") it("attr:data-state", v === null || v === undefined ? null : String(v));
            else if (k === "text") it("text", String(v));
            else if (k === "class") String(v).split(/\s+/).filter(Boolean).forEach((tok) => {
              const on = tok[0] !== "-", name = tok.replace(/^[+-]/, "");
              it("class:" + name, on);
            });
            else if (k === "attr") for (const [a, av] of Object.entries(v)) it("attr:" + a, av === null || av === false ? null : String(av));
            else if (k === "style") for (const [p, pv] of Object.entries(v)) it("style:" + p, pv === null ? "" : String(pv));
            else if (k === "visible") it("presence", !!v);
            else if (k === "opacity" || k === "x" || k === "y" || k === "rotate") it(k, num(v));
            else if (k === "scale") { it("sx", num(v)); it("sy", num(v)); }
            else if (k === "pose") it("pose", this._pose(el, v));
            else this._fail(`unknown key "${k}" (use state, text, class, attr, style, visible, opacity, x, y, scale, rotate, pose)`);
          }
        });
        this._group(start, off.map((d) => start + d));
      });
    }
    // s.pose(target, pose, pos, { stagger }) — swap a sprite to another of its poses (its element has data-am-sprite).
    pose(target, pose, pos, o = {}) { return this._run("pose", () => this.set(target, { pose }, pos, o)); }
    _pose(el, pose) {
      const sp = el._amSprite;
      if (!sp) this._fail(`#${el.id || el.tagName.toLowerCase()} isn't a sprite (give it data-am-sprite="<name>:<pose>")`);
      if (!sp.def.poses[pose]) this._fail(`sprite "${sp.name}" has no pose "${pose}" (poses: ${Object.keys(sp.def.poses).join(", ")})`);
      return pose;
    }
    text(target, value, pos, o = {}) { return this._run("text", () => this.set(target, { text: value }, pos, o)); }
    tween(target, props, pos, o = {}) {
      return this._run("tween", () => {
        if (!props || typeof props !== "object") this._fail("needs an object of properties: { x, y, scale, rotate, opacity, or any CSS property }");
        const els = this._els(target), start = this._at(pos), dur = o.dur ?? this._dur("tween"), off = this._offsets(els.length, o.stagger);
        const from = o.from || {};
        els.forEach((el, i) => {
          for (const [k, v] of Object.entries(props)) {
            for (const [ch, val, fr] of channelsFor(k, v, from[k])) this._item(el, ch, start + off[i], dur, interp(this._color(fr), this._color(val)), { ease: o.ease ?? (TRANSFORM.has(ch) ? "move" : "effect") });
          }
        });
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    enter(target, preset = "fade", pos, o = {}) { return this._run("enter", () => this._presence(target, preset, pos, o, true)); }
    exit(target, preset = "fade", pos, o = {}) { return this._run("exit", () => this._presence(target, preset, pos, o, false)); }
    draw(target, pos, o = {}) { return this._run("draw", () => this._presence(target, "draw", pos, Object.assign({ dur: this._dur("draw"), ease: "move" }, o), true)); }
    _presence(target, preset, pos, o, entering) {
      const P = PRESETS[preset];
      if (!P) this._fail(`unknown preset "${preset}" (use ${Object.keys(PRESETS).join(", ")})`);
      const els = this._els(target), start = this._at(pos), off = this._offsets(els.length, o.stagger);
      const dur = o.dur ?? this._dur(entering ? "enter" : "exit");
      const ease = o.ease ?? P.ease ?? (entering ? "enter" : "exit");
      const dist = o.distance;
      els.forEach((el, i) => {
        const t = start + off[i];
        const mix = (hiddenVal, shownVal) => (p) => lerp(entering ? hiddenVal : shownVal, entering ? shownVal : hiddenVal, p);
        if (entering) this._item(el, "presence", t, 0, () => true, { discrete: true });
        else this._item(el, "presence", t + dur, 0, () => false, { discrete: true });
        if (P.opacity !== false) {
          const full = el.style && el.style.opacity !== "" && el.style.opacity !== undefined ? +el.style.opacity : 1;   // the authored opacity
          this._item(el, "opacity", t, dur, entering ? (p) => lerp(0, full, p) : (p, s0) => lerp(s0, 0, p), { ease });
        }
        if (P.x !== undefined) this._item(el, "x", t, dur, mix(dist !== undefined ? Math.sign(P.x) * dist : P.x, 0), { ease });
        if (P.y !== undefined) this._item(el, "y", t, dur, mix(dist !== undefined ? Math.sign(P.y) * dist : P.y, 0), { ease });
        if (P.s !== undefined) { this._item(el, "sx", t, dur, mix(P.s, 1), { ease }); this._item(el, "sy", t, dur, mix(P.s, 1), { ease }); }
        if (P.sx !== undefined) this._item(el, "sx", t, dur, mix(P.sx, 1), { ease });
        if (P.sy !== undefined) this._item(el, "sy", t, dur, mix(P.sy, 1), { ease });
        if (P.origin && el.style && !el.style.transformOrigin) el.style.transformOrigin = P.origin;
        if (P.clip) this._item(el, "clip", t, dur, mix(0, 1), { ease });
        if (P.draw) {
          if (el.setAttribute && !el.getAttribute("pathLength")) el.setAttribute("pathLength", "1");
          if (el.style) el.style.strokeDasharray = "1";
          this._item(el, "dash", t, dur, mix(1, 0), { ease });
        }
        if (P.height) {   // the whole box grows: height (border-box), vertical padding and margins, then they're cleared
          const cs = getComputedStyle(el), h = el.offsetHeight || 0;
          if (el.style) el.style.overflow = el.style.overflow || "hidden";
          // entering, the row takes no space until it starts (back: its first value is held before then)
          const grow = (ch, full) => this._item(el, ch, t, dur, (p) => lerp(entering ? 0 : full, entering ? full : 0, p) + "px", { ease, clear: entering, back: entering });
          grow("style:height", h);
          for (const side of ["padding-top", "padding-bottom", "margin-top", "margin-bottom"]) { const v = parseFloat(cs.getPropertyValue(side)) || 0; if (v) grow("style:" + side, v); }
          this._item(el, "style:box-sizing", t, 0, () => "border-box", { discrete: true, back: entering });
          if (entering) this._item(el, "style:box-sizing", t + dur, 0, () => "", { discrete: true });
        }
      });
      this._group(start, off.map((d) => start + d + dur));
    }
    // s.move(target, to, pos, { dur, ease, arc, align, offset }) — to: an anchor selector (centre on it),
    // { x, y } (pixels from where the layout puts it), or { path: "#svg-path" } (follow it).
    move(target, to, pos, o = {}) {
      return this._run("move", () => {
        const els = this._els(target), start = this._at(pos), dur = o.dur ?? this._dur("move"), ease = o.ease ?? "move", off = this._offsets(els.length, o.stagger);
        els.forEach((el, i) => {
          const t = start + off[i];
          if (to && typeof to === "object" && !to.nodeType && to.path) {
            const pts = samplePath(this._scene, this._els(to.path)[0], 64), c = centre(this._scene, el);
            const at = (p) => { const f = p * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = f - k; return [lerp(pts[k][0], pts[k + 1][0], r) - c[0], lerp(pts[k][1], pts[k + 1][1], r) - c[1]]; };
            this._item(el, "x", t, dur, (p) => at(p)[0], { ease });
            this._item(el, "y", t, dur, (p) => at(p)[1], { ease });
            return;
          }
          let dx, dy;
          if (to && typeof to === "object" && !to.nodeType && ("x" in to || "y" in to)) { dx = to.x || 0; dy = to.y || 0; }
          else {
            const anchor = this._els(to)[0];
            const a = box(this._scene, anchor), b = box(this._scene, el), align = o.align || "center";
            if (o.point || o.on) {   // point: the mover's point that lands; on: the anchor's point it lands on
              const pa = pointOf(b, o.point || "center"), pb = pointOf(a, o.on || "center");
              dx = pb[0] - pa[0]; dy = pb[1] - pa[1];
            } else {
              dx = a.cx - b.cx;
              dy = align === "bottom" ? a.bottom - b.bottom : align === "top" ? a.top - b.top : align === "above" ? a.top - b.bottom : a.cy - b.cy;
            }
            if (o.offset) { dx += o.offset.x || 0; dy += o.offset.y || 0; }
          }
          if (o.pass) this._passes(el, t, dur, dx, dy, o);
          this._item(el, "x", t, dur, (p, s0) => lerp(s0, dx, p), { ease });
          if (o.arc) this._item(el, "y", t, dur, (p, s0, raw) => lerp(s0, dy, p) - 4 * o.arc * raw * (1 - raw), { ease, raw: true });
          else this._item(el, "y", t, dur, (p, s0) => lerp(s0, dy, p), { ease });
        });
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    // move's { pass: { targets, set } }: as the mover's centre passes each target's centre (projected on the line of
    // travel), apply set to that target. Times come from the ease, so checks tick exactly as the mover reaches them.
    _passes(el, t, dur, dx, dy, o) {
      const targets = this._els(o.pass.targets), ease = this._ease(o.ease ?? "move"), b = box(this._scene, el);
      const x0 = this._lastX(el), y0 = this._lastY(el);
      const sx = b.cx + x0, sy = b.cy + y0, vx = dx - x0, vy = dy - y0, L2 = vx * vx + vy * vy || 1;
      targets.forEach((tg) => {
        const c = box(this._scene, tg), want = ((c.cx - sx) * vx + (c.cy - sy) * vy) / L2;   // 0 at the start, 1 at the end
        if (want < 0 || want > 1) return;
        let lo = 0, hi = 1;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ease(m) < want) lo = m; else hi = m; }
        this.set(tg, o.pass.set, t + hi * dur);
      });
    }
    // The x / y a move continues from: the end value of the last verb added on that channel (0 if none).
    _lastX(el) { return this._last(el, "x"); }
    _lastY(el) { return this._last(el, "y"); }
    _last(el, ch) {
      let v = 0;
      const its = this.items.filter((it) => it.el === el && it.ch === ch).sort((a, b) => a.start - b.start || a.n - b.n);
      for (const it of its) { try { v = +it.fn(1, v, 1) || 0; } catch (e) { /* keep v */ } }
      return v;
    }
    // s.clone(source, n, pos, { into, each, dur, ease, id, init }) — n copies of source, added to a container (default:
    // the source's parent) whose CSS lays them out; each flies out of the source into its place.
    // Copies get ids <source-id>-1 … -n and the class am-clone, so later verbs can target them.
    clone(source, n, pos, o = {}) {
      return this._run("clone", () => {
        if (!(n >= 1)) this._fail("needs a count ≥ 1");
        const src = this._els(source)[0], into = o.into ? this._els(o.into)[0] : src.parentNode;
        const base = (o.id || src.id || "clone").replace(/^#/, "");
        const made = [];
        for (let i = 1; i <= n; i++) {
          const c = src.cloneNode(true);
          copySprites(src, c);
          c.id = `${base}-${i}`;
          c.querySelectorAll("[id]").forEach((d) => { d.id = `${d.id}-${i}`; });   // ids stay unique: #label in clone 3 is #label-3
          c.classList.add("am-clone");
          into.appendChild(c);
          if (o.init) o.init(c, i);   // per-clone setup before anything is measured: its label, its pose, its colour
          made.push(c);
        }
        const start = this._at(pos), dur = o.dur ?? this._dur("clone"), ease = o.ease ?? "enter";
        const off = this._offsets(n, o.each === undefined ? { each: 0.06, from: o.from || "start" } : { each: o.each, from: o.from || "start" });
        const s = box(this._scene, src);
        made.forEach((c, i) => {
          const b = box(this._scene, c), t = start + off[i];
          this._item(c, "presence", t, 0, () => true, { discrete: true });
          this._item(c, "x", t, dur, (p) => lerp(s.cx - b.cx, 0, p), { ease });
          this._item(c, "y", t, dur, (p) => lerp(s.cy - b.cy, 0, p), { ease });
          this._item(c, "opacity", t, Math.min(dur, 0.2), (p) => p, { ease: "linear" });
        });
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    // s.count(target, { to, from, format, dur }) — format: a function, a template "{n} open" / "{n:2}", Intl options, or
    // omitted to keep the shape of the text already there ("$18.00").
    count(target, o, pos, extra = {}) {
      return this._run("count", () => {
        if (!o || typeof o.to !== "number") this._fail("needs { to: number }");
        const els = this._els(target), start = this._at(pos), dur = o.dur ?? extra.dur ?? this._dur("count"), off = this._offsets(els.length, extra.stagger);
        els.forEach((el, i) => this._item(el, "text", start + off[i], dur, (p, s0) => {
          const f = formatter(o.format, s0), from = o.from ?? numberShape(s0).value;
          return f(p >= 1 ? o.to : lerp(from, o.to, p));
        }, { ease: o.ease ?? extra.ease ?? "out" }));
        this._group(start, off.map((d) => start + d + dur));
      });
    }
    // s.type(target, text, pos, { cps, dur, append, caret }) — types the text character by character.
    type(target, text, pos, o = {}) {
      return this._run("type", () => {
        const str = String(text), els = this._els(target), start = this._at(pos);
        const dur = o.dur ?? str.length / (o.cps || 30), caret = o.caret !== false;
        els.forEach((el) => {
          this._item(el, "text", start, dur, (p, s0) => (o.append ? s0 : "") + str.slice(0, Math.round(clamp01(p) * str.length)), { ease: "linear" });
          if (caret) {
            this._item(el, "class:am-typing", start, 0, () => true, { discrete: true });
            this._item(el, "class:am-typing", start + dur + 0.4, 0, () => false, { discrete: true });
          }
        });
        this._group(start, [start + dur]);
        if (caret && start + dur + 0.4 > this.end) this.end = start + dur + 0.4;   // room for the caret to clear
      });
    }
    // s.burst(target, { count, colors, spread, size, dur }) — a seeded confetti burst from the target's centre.
    burst(target, pos, o = {}) {
      return this._run("burst", () => {
        const at = box(this._scene, this._els(target)[0]), start = this._at(pos), dur = o.dur ?? DEFAULTS.burst;
        const n = Math.min(o.count ?? 24, 150), spread = o.spread ?? 140, size = o.size ?? 6;
        const colors = o.colors || ["var(--color-accent, #D97757)", "var(--color-success, #2E7D32)", "var(--color-warning, #E3A008)", "var(--color-ink, #1A1A18)"];
        const layer = this._layer();
        for (let i = 0; i < n; i++) {
          const d = this._root.ownerDocument ? this._root.ownerDocument.createElement("i") : document.createElement("i");
          d.className = "am-particle";
          const w = size * (0.6 + this.rand() * 0.8);
          Object.assign(d.style, { left: at.cx - w / 2 + "px", top: at.cy - w / 2 + "px", width: w + "px", height: w * (0.4 + this.rand() * 0.8) + "px", background: colors[i % colors.length] });
          layer.appendChild(d);
          const ang = this.rand() * Math.PI * 2, v = spread * (0.45 + this.rand() * 0.55), vx = Math.cos(ang) * v, vy = Math.sin(ang) * v - spread * 0.5, rot = (this.rand() - 0.5) * 720;
          this._item(d, "presence", start, 0, () => true, { discrete: true });
          this._item(d, "presence", start + dur, 0, () => false, { discrete: true });
          this._item(d, "x", start, dur, (p) => vx * p, { ease: "out" });
          this._item(d, "y", start, dur, (p, s0, raw) => vy * EASE.out(raw) + spread * 1.2 * raw * raw, { ease: "linear", raw: true });
          this._item(d, "rotate", start, dur, (p) => rot * p, { ease: "out" });
          this._item(d, "opacity", start + dur * 0.6, dur * 0.4, (p) => 1 - p, { ease: "linear" });
        }
        this._group(start, [start + dur]);
      });
    }
    // A colour the browser can resolve (var(--color-accent), a name, hsl()) becomes rgb(), so it can be interpolated.
    _color(v) {
      if (typeof v !== "string" || parseNum(v) || parseColor(v) || !this._root.ownerDocument) return v;
      const probe = this._root.ownerDocument.createElement("i");
      probe.style.color = v;
      if (!probe.style.color) return v;
      this._root.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return parseColor(c) ? c : toRgba(this._root.ownerDocument, c);
    }
    _layer() {
      if (!this._fx) {
        const doc = this._root.ownerDocument || document;
        this._fx = doc.createElement("div");
        this._fx.className = "am-fx";
        this._root.appendChild(this._fx);
      }
      return this._fx;
    }
    // s.expect(label | seconds, target, { text, state, visible, class }) — an assertion checked by `animotion check --render`.
    expect(at, target, want) {
      return this._run("expect", () => {
        const t = typeof at === "number" ? at : at === "end" || at === "start" ? null : this._at(at);   // end: resolved when checked
        this._els(target);   // fail now if the target is wrong
        this.expects.push({ at, t, target, want });
      });
    }
  }
  // Continuous items: from may be omitted (the chain's value at the item's start).
  function interp(from, to) {
    return (p, s0) => {
      const a = from === undefined ? s0 : from;
      let ca = parseColor(a), cb = parseColor(to);
      if (ca && cb) {
        if (ca[3] === 0) ca = [cb[0], cb[1], cb[2], 0];   // from transparent: fade the target colour in, not through black
        if (cb[3] === 0) cb = [ca[0], ca[1], ca[2], 0];
        return colorStr(ca.map((v, i) => lerp(v, cb[i], p)));
      }
      const na = parseNum(a), nb = parseNum(to);
      if (na && nb) return nb.unit || na.unit ? lerp(na.n, nb.n, p) + (nb.unit || na.unit) : lerp(na.n, nb.n, p);
      return p < 1 ? a : to;
    };
  }
  function channelsFor(k, v, from) {
    if (k === "x" || k === "y" || k === "rotate" || k === "opacity") return [[k, num(v), from === undefined ? undefined : num(from)]];
    if (k === "scale") return [["sx", num(v), from === undefined ? undefined : num(from)], ["sy", num(v), from === undefined ? undefined : num(from)]];
    if (k === "scaleX") return [["sx", num(v), from === undefined ? undefined : num(from)]];
    if (k === "scaleY") return [["sy", num(v), from === undefined ? undefined : num(from)]];
    const prop = k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    return [["style:" + (prop === "background" ? "background-color" : prop), v, from]];   // background: a colour tween
  }
  const num = (v) => { const n = parseNum(v); return n ? n.n : +v; };

  // ── geometry, in scene pixels (independent of the slide's scale) ──
  function scaleOf(scene) {
    if (!scene || !scene.getBoundingClientRect) return 1;
    const w = scene.offsetWidth;
    return w ? scene.getBoundingClientRect().width / w : 1;
  }
  function box(scene, el) {
    if (!scene || !el.getBoundingClientRect) return { cx: 0, cy: 0, top: 0, bottom: 0, left: 0, right: 0 };
    const k = scaleOf(scene), s = scene.getBoundingClientRect(), r = el.getBoundingClientRect();
    const left = (r.left - s.left) / k, top = (r.top - s.top) / k, w = r.width / k, h = r.height / k;
    return { left, top, right: left + w, bottom: top + h, cx: left + w / 2, cy: top + h / 2 };
  }
  // A named point of a box ("center", "top-left", "top", "bottom-right", …) or { x, y } pixels from its top-left.
  function pointOf(b, p) {
    if (p && typeof p === "object") return [b.left + (p.x || 0), b.top + (p.y || 0)];
    const k = String(p);
    const x = /left/.test(k) ? b.left : /right/.test(k) ? b.right : b.cx;
    const y = /top/.test(k) ? b.top : /bottom/.test(k) ? b.bottom : b.cy;
    return [x, y];
  }
  const centre = (scene, el) => { const b = box(scene, el); return [b.cx, b.cy]; };
  function samplePath(scene, path, n) {
    if (!path.getTotalLength) throw new Error(`s.move: { path } must name an SVG <path>, <line>, <polyline> or <circle>`);
    const L = path.getTotalLength(), m = path.getScreenCTM(), k = scaleOf(scene), s = scene.getBoundingClientRect(), pts = [];
    for (let i = 0; i <= n; i++) {
      const p = path.getPointAtLength((L * i) / n), q = new DOMPoint(p.x, p.y).matrixTransform(m);
      pts.push([(q.x - s.left) / k, (q.y - s.top) / k]);
    }
    return pts;
  }

  // ── compile and render ──
  // Base values are read once from the freshly stamped scene; each channel's chain is then resolved in start order.
  function baseOf(el, ch, firstItem) {
    if (ch === "x" || ch === "y" || ch === "rotate") return 0;
    if (ch === "sx" || ch === "sy") return 1;
    if (ch === "opacity") { const v = el.style && el.style.opacity; return v !== "" && v !== undefined ? +v : 1; }
    if (ch === "presence") return firstItem ? !firstItem.fn(1, null) : true;   // first event shows it → it starts hidden
    if (ch === "text") return el.textContent;
    if (ch === "dash") return 0;
    if (ch === "pose") return el._amSprite ? el._amSprite.pose : null;
    if (ch === "clip") return 1;
    if (ch.startsWith("attr:")) return el.getAttribute(ch.slice(5));
    if (ch.startsWith("class:")) return el.classList.contains(ch.slice(6));
    if (ch.startsWith("style:")) {
      const prop = ch.slice(6), inline = el.style.getPropertyValue(prop);
      if (inline && !/var\(/.test(inline)) return inline;
      try { return toRgba(el.ownerDocument, getComputedStyle(el).getPropertyValue(prop).trim()); } catch (e) { return inline || ""; }
    }
    return null;
  }
  function compile(tl) {
    const byEl = new Map();
    for (const it of tl.items) {
      if (it.ch === "custom") continue;
      let chans = byEl.get(it.el);
      if (!chans) byEl.set(it.el, (chans = new Map()));
      let arr = chans.get(it.ch);
      if (!arr) chans.set(it.ch, (arr = []));
      arr.push(it);
    }
    const chains = [];
    for (const [el, chans] of byEl) for (const [ch, arr] of chans) {
      arr.sort((a, b) => a.start - b.start || a.n - b.n);
      let base = baseOf(el, ch, arr[0]);
      const first = arr[0];
      if (first.back) base = first.discrete ? first.fn(1, base, 1) : first.fn(first.ease(0), base, 0);   // held before it starts
      let v = base;
      for (const it of arr) { it.s0 = v; it.s1 = it.fn(1, v, 1); v = it.s1; }
      chains.push({ el, ch, base, items: arr, starts: arr.map((i) => i.start) });
    }
    return { chains, customs: tl.items.filter((i) => i.ch === "custom") };
  }
  // The value of a chain at time t.
  function valueAt(chain, t) {
    const { items } = chain;
    let lo = 0, hi = items.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (items[mid].start <= t + 1e-9) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k < 0) return chain.base;
    const it = items[k];
    if (it.discrete || it.dur === 0) return it.s1;
    const raw = clamp01((t - it.start) / it.dur);
    if (raw >= 1) return it.clear ? "" : it.s1;
    return it.fn(it.ease(raw), it.s0, raw);
  }
  function render(compiled, t, cache) {
    const tf = new Map();
    for (const c of compiled.chains) {
      const v = valueAt(c, t);
      if (TRANSFORM.has(c.ch)) { let o = tf.get(c.el); if (!o) tf.set(c.el, (o = { x: 0, y: 0, sx: 1, sy: 1, rotate: 0 })); o[c.ch] = v; continue; }
      write(c.el, c.ch, v, cache);
    }
    for (const [el, o] of tf) {
      put(el, "translate", o.x || o.y ? `${round(o.x)}px ${round(o.y)}px` : "", cache);
      put(el, "scale", o.sx !== 1 || o.sy !== 1 ? `${round(o.sx, 4)} ${round(o.sy, 4)}` : "", cache);
      put(el, "rotate", o.rotate ? `${round(o.rotate, 2)}deg` : "", cache);
    }
    for (const it of compiled.customs) it.custom(it.el, it.dur ? it.ease(clamp01((t - it.start) / it.dur)) : t >= it.start ? 1 : 0, t);
  }
  const round = (v, d = 2) => +(+v).toFixed(d);
  function put(el, prop, value, cache) {
    const key = prop;
    let c = cache.get(el);
    if (!c) cache.set(el, (c = {}));
    if (c[key] === value) return;
    c[key] = value;
    el.style.setProperty(prop, value);
  }
  function write(el, ch, v, cache) {
    let c = cache.get(el);
    if (!c) cache.set(el, (c = {}));
    if (c[ch] === v) return;
    c[ch] = v;
    if (ch === "opacity") el.style.opacity = v === 1 ? "" : String(round(v, 3));
    else if (ch === "presence") el.style.visibility = v ? "" : "hidden";   // never "visible": it would show through a hidden slide
    else if (ch === "text") el.textContent = v;
    else if (ch === "pose") { if (el._amSprite) el.innerHTML = el._amSprite.draw(v); }
    else if (ch === "dash") el.style.strokeDashoffset = String(round(v, 4));
    else if (ch === "clip") el.style.clipPath = v >= 1 ? "" : `inset(0 ${round((1 - v) * 100)}% 0 0)`;
    else if (ch.startsWith("attr:")) { if (v === null || v === undefined) el.removeAttribute(ch.slice(5)); else el.setAttribute(ch.slice(5), v); }
    else if (ch.startsWith("class:")) { el.classList.toggle(ch.slice(6), !!v); if (!el.classList.length && el.getAttribute("class") === "") el.removeAttribute("class"); }
    else if (ch.startsWith("style:")) el.style.setProperty(ch.slice(6), v === undefined || v === null ? "" : String(v));
  }

  // ── the element ───────────────────────────────────────────────────────────────────────
  const registry = new Map(), waiting = new Map(), verbs = {};
  const BASE_CSS = `
:host { display: block; position: relative; }
:host([hidden]) { display: none; }
.am-stage { position: relative; width: 100%; height: 100%; }
.am-stage, .am-stage * { transition: none !important; }   /* the timeline is the only clock */
.am-typing::after { content: ""; display: inline-block; width: .07em; height: 1em; margin-left: .06em; vertical-align: -.14em; background: currentColor; }
.am-fx { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.am-particle { position: absolute; display: block; border-radius: 1px; }
.am-ctl { position: absolute; right: 6px; bottom: 6px; z-index: 10; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%;
  background: color-mix(in srgb, var(--color-ink, #1A1A18) 72%, transparent); color: var(--color-bg, #fff); cursor: pointer;
  display: grid; place-items: center; opacity: 0; transition: opacity .2s; font: 11px/1 system-ui, sans-serif; }
:host(:hover) .am-ctl, .am-ctl:focus-visible, .am-ctl.am-held { opacity: .9; }
.am-ctl[hidden] { display: none; }
.am-ctl svg { width: 12px; height: 12px; fill: currentColor; }`;
  const ICON_PAUSE = '<svg viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9"/><rect x="7" y="1.5" width="3" height="9"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z"/></svg>';
  const scenes = new Set();
  const reduce = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener() {} };
  const printing = typeof matchMedia === "function" ? matchMedia("print") : { matches: false, addEventListener() {} };
  let still = false, userPausedAll = false;
  const query = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
  if (query.has("am-still") || query.has("capture") || query.has("print")) still = true;

  const HTMLBase = typeof HTMLElement === "undefined" ? class {} : HTMLElement;
  class AmScene extends HTMLBase {
    connectedCallback() {
      if (this._mounted) {
        scenes.add(this);
        if (io && !this.ownerDocument.getElementById("sw-slides")) io.observe(this);
        sync();
        return;
      }
      whenReady(() => { if (this.isConnected) this._mount(); });
    }
    disconnectedCallback() {
      scenes.delete(this);
      this._stopClock();
      if (io) io.unobserve(this);
      this._wasActive = false;
      if (this._tl) this._park();
    }

    get duration() { return this._tl ? this._tl.duration : 0; }
    get labels() { return this._tl ? Object.assign({}, this._tl.labels) : {}; }
    get time() { return this._t || 0; }
    get state() { return this._state || "idle"; }
    get error() { return this._error || null; }
    get isCopy() {
      const deck = this.ownerDocument.getElementById("sw-slides");
      return !!deck && (!this.closest("#sw-slides") || !!this.closest(".rp-copy-stage"));
    }

    _mount() {
      this._mounted = true;
      this._root = this.shadowRoot || this.attachShadow({ mode: "open" });
      try { if (!this._internals && this.attachInternals) { this._internals = this.attachInternals(); this._internals.role = "group"; } } catch (e) { /* role from aria-label is enough */ }
      scenes.add(this);
      if (io && !this.ownerDocument.getElementById("sw-slides")) io.observe(this); else if (!io) this._onScreen = true;
      this._stamp();
      const fonts = this.ownerDocument.fonts;
      if (fonts && fonts.status !== "loaded") fonts.ready.then(() => this._refont());
      this._park();
      sync();
    }
    // Fonts arrived after the scene was measured with fallbacks: rebuild, park, and let the policy start it again.
    _refont() {
      if (!this._tl) return;
      this._stamp();
      this._compiled = false;
      this._park();
      this._wasActive = false;
      sync();
    }
    // Render the template into the shadow root, fresh: the timeline's clones and particles are rebuilt on compile.
    _stamp() {
      const tpl = this.querySelector(":scope > template");
      const doc = this.ownerDocument;
      this._root.innerHTML = "";
      const style = doc.createElement("style");
      style.textContent = BASE_CSS;
      this._root.appendChild(style);
      this._stage = doc.createElement("div");
      this._stage.className = "am-stage";
      this._root.appendChild(this._stage);
      this._code = null;
      // The page's kit (<template id="am-kit">: shared CSS and SVG symbols) goes into every scene, before its own markup.
      const kit = doc.getElementById("am-kit");
      if (kit && kit.content) this._stage.appendChild(kit.content.cloneNode(true));
      if (tpl) {
        const frag = tpl.content.cloneNode(true);
        frag.querySelectorAll('script[type="text/animotion"]').forEach((s) => { this._code = (this._code || "") + s.textContent + "\n"; s.remove(); });
        this._stage.appendChild(frag);
      }
      try { drawSprites(this._stage, readSprites(this._stage)); this._spriteError = null; } catch (e) { this._spriteError = e.message; }
      this._ctl = doc.createElement("button");
      this._ctl.className = "am-ctl";
      this._ctl.type = "button";
      this._ctl.hidden = true;
      this._ctl.setAttribute("aria-label", "Pause animation");
      this._ctl.innerHTML = ICON_PAUSE;
      this._ctl.addEventListener("click", (e) => { e.stopPropagation(); this._userPaused ? this.resume() : this.pause(); });
      this._ctl.addEventListener("keydown", (e) => e.stopPropagation());
      this._root.appendChild(this._ctl);
      this._tl = null; this._compiled = false; this._cache = new Map(); this._error = null;
    }
    // Build the timeline (needs layout: the scene must be rendered).
    _compile() {
      if (this._compiled) return !!this._tl;
      if (!this.getClientRects().length || !this.offsetWidth) return false;   // not laid out yet (display: none)
      this._compiled = true;
      const name = this.getAttribute("name") || "";
      const seed = hash(this.getAttribute("seed") || name || "animotion");
      const tl = new Timeline(this, this._stage, seed, readTokens(this));
      try {
        if (this._spriteError) throw new Error(this._spriteError);
        const def = name && registry.get(name);
        if (this._code) new Function("s", "AM", this._code).call(this, tl, AM);
        else if (def) def.call(this, tl, AM);
        else if (name && !this.hasAttribute("duration")) {
          this._compiled = false;   // the definition may arrive later (AM.scene after this element)
          let w = waiting.get(name);
          if (!w) waiting.set(name, (w = new Set()));
          w.add(this);
          return false;
        }
        // CSS @keyframes in the template join the clock, sought to the same time.
        const css = this._root.getAnimations ? this._root.getAnimations() : [];
        css.forEach((a) => a.pause());
        if (this.hasAttribute("duration")) tl.end = Math.max(tl.end, parseFloat(this.getAttribute("duration")) || 0);
        this._css = css;
        this._tl = tl;
        this._out = compile(tl);
        return true;
      } catch (e) {
        this._error = `scene${name ? ` "${name}"` : ""}: ${e.message}`;
        console.error("animotion: " + this._error);
        this._tl = null;
        return false;
      }
    }
    _ensure() { return this._compile() && !!this._tl; }
    _render(t) {
      if (!this._tl) return;
      const D = this._tl.duration;
      t = Math.max(0, Math.min(D, t));
      render(this._out, t, this._cache);
      for (const a of this._css || []) { try { a.currentTime = t * 1000; } catch (e) { /* finished animations */ } }
      this._t = t;
    }
    // The time a label, number, "end" or "start" names.
    _time(x) {
      if (x === undefined || x === null || x === "end") return this.duration;
      if (x === "start") return 0;
      if (typeof x === "number") return x;
      if (/^-?\d*\.?\d+$/.test(String(x))) return parseFloat(x);
      if (this._tl && x in this._tl.labels) return this._tl.labels[x];
      throw new Error(`no label "${x}" in scene${this.getAttribute("name") ? ` "${this.getAttribute("name")}"` : ""}`);
    }
    get posterTime() {
      const p = this.getAttribute("poster");
      try { return this._time(p === null ? "end" : p); } catch (e) { return this.duration; }
    }

    // ── public API ──
    seek(x) { if (!this._ensure()) return this; this._stopClock(); this._fade(1); this._render(this._time(x)); this._state = "paused"; this._held(false); return this; }
    play(from) {
      if (!this._ensure()) return this;
      this._userPaused = false;
      this._t0 = from === undefined ? 0 : this._time(from);
      this._elapsed = this._t0;
      this._target = null;
      this._state = "playing";
      this._startClock();
      this._held(false);
      return this;
    }
    playTo(label) {
      if (!this._ensure()) return this;
      const T = this._time(label);
      if (this._state === "held" && Math.abs(T - (this._t || 0)) < 1e-6) return this;   // already there
      if (this._state === "playing" && this._target !== null && this._target !== undefined && Math.abs(T - this._target) < 1e-6) return this;
      if (T < (this._t || 0) - 1e-6) { this.seek(T); this._state = "held"; return this; }
      this._elapsed = this._t || 0;
      this._target = T;
      this._state = "playing";
      this._startClock();
      return this;
    }
    pause() { if (this._state === "playing") { this._userPaused = true; this._stopClock(); this._state = "paused"; this._held(true); } return this; }
    resume() { if (this._userPaused) { this._userPaused = false; this._state = "playing"; this._startClock(); this._held(false); } return this; }
    restart() { return this.play(0); }
    _held(on) {
      if (!this._ctl) return;
      this._ctl.classList.toggle("am-held", on);
      this._ctl.innerHTML = on ? ICON_PLAY : ICON_PAUSE;
      this._ctl.setAttribute("aria-label", on ? "Play animation" : "Pause animation");
    }
    // Rest on the poster: the state every still view shows.
    _park() {
      this._stopClock();
      this._userPaused = false;
      if (!this._ensure()) return;
      this._fade(1);
      this._render(this.posterTime);
      this._state = "poster";
      if (this._ctl) this._ctl.hidden = true;
    }
    _fade(o) { if (this._stage) { const v = o >= 1 ? "" : String(round(o, 3)); if (this._stage.style.opacity !== v) this._stage.style.opacity = v; } }

    // Loops: loop="n" | "infinite" (infinite only while a deck is presenting, else 3), hold= seconds on the
    // last frame, reset="fade" | "cut".
    _loops() {
      const l = this.getAttribute("loop");
      if (l === null) return 1;
      if (l === "" || l === "infinite") return presenting() ? Infinity : 3;
      const n = parseInt(l, 10);
      return n >= 1 ? n : 1;
    }
    _tick(dt) {
      const D = this.duration;
      if (this._target !== null && this._target !== undefined) {   // stepping to a label
        this._elapsed = Math.min(this._target, this._elapsed + dt);
        this._render(this._elapsed);
        if (this._elapsed >= this._target - 1e-9) { this._stopClock(); this._state = "held"; if (this._ctl) this._ctl.hidden = true; this._emit("am:label", { time: this._target }); }
        return;
      }
      this._elapsed += dt;
      const loops = this._loops();
      const hold = parseFloat(this.getAttribute("hold") ?? (loops > 1 ? "1.5" : "0")) || 0;
      const reset = this.getAttribute("reset") === "cut" ? 0 : 0.6;
      const C = D + hold + (loops > 1 ? reset : 0);
      const n = Math.floor(this._elapsed / C), u = this._elapsed - n * C;
      if (n >= loops) {   // done: rest on the poster (a finished one-shot rests on its end unless a poster is named)
        this._emit("am:end", {});
        if (loops > 1 || this.hasAttribute("poster")) this._park(); else { this._render(D); this._state = "ended"; this._stopClock(); }
        if (this._ctl) this._ctl.hidden = true;
        return;
      }
      if (n !== this._cycle) { if (this._cycle !== undefined && n > this._cycle) this._emit("am:loop", { n }); this._cycle = n; }
      if (u < D) { this._fade(1); this._render(u); }
      else if (u < D + hold || loops === 1) { this._fade(1); this._render(D); }
      else {
        const r = (u - D - hold) / reset;
        if (r < 0.5) { this._render(D); this._fade(1 - r * 2); } else { this._render(0); this._fade(r * 2 - 1); }
      }
    }
    _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
    _startClock() { this._cycle = undefined; if (this._ctl) this._ctl.hidden = this.getAttribute("controls") === "none"; running.add(this); loop(); }
    _stopClock() { running.delete(this); }
  }

  // ── one clock for every playing scene ──
  const running = new Set();
  let io = null;   // watches scenes on ordinary pages: they play while on screen
  let rafId = 0, last = 0;
  function loop() {
    if (rafId || typeof requestAnimationFrame === "undefined") return;
    last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);   // a stalled tab resumes where it was, not seconds later
      last = now;
      for (const s of [...running]) s._tick(dt);
      rafId = running.size ? requestAnimationFrame(step) : 0;
    };
    rafId = requestAnimationFrame(step);
  }

  // ── policy: when may a scene move? ──
  function SWok() { return typeof global.SW === "object" && global.SW && typeof global.SW.isReady === "function"; }
  function presenting() { return SWok() && typeof global.SW.builds === "function" && !!global.SW.builds(); }
  function deckBlocks() {
    const c = document.documentElement.classList;
    return c.contains("sw-quiet") || c.contains("sw-print") || c.contains("sw-editing") || c.contains("rp-presenter") || c.contains("rp-ov-on");
  }
  function active(s) {   // may this scene be playing right now?
    if (still || reduce.matches || printing.matches || s.isCopy || !s.isConnected) return false;
    const deck = s.ownerDocument.getElementById("sw-slides");
    if (deck) {
      if (!SWok() || !global.SW.isReady() || deckBlocks()) return false;
      const cur = global.SW.current && global.SW.current();
      return !!cur && cur.contains(s);
    }
    return !!s._onScreen;
  }
  function suspended(s) { return (SWok() && global.SW.paused && global.SW.paused()) || (typeof document !== "undefined" && document.hidden) || userPausedAll; }
  function cuesOf(s) {
    return [...s.querySelectorAll(":scope > am-cue[data-step]")].map((c) => ({ step: +c.getAttribute("data-step"), to: c.getAttribute("to") })).sort((a, b) => a.step - b.step);
  }
  function sync() {
    for (const s of scenes) {
      if (!s._mounted) continue;
      const act = active(s);
      if (!act) { if (s._wasActive || s._state === "playing" || s._state === undefined) s._park(); s._wasActive = false; continue; }
      const trig = s.getAttribute("trigger") || "enter";
      if (trig === "steps" && presenting()) {
        const cues = cuesOf(s), step = global.SW.step ? global.SW.step() : 0;
        const hit = cues.filter((c) => c.step <= step).pop();
        if (!s._wasActive) {   // arriving: show the state the slide's step stands at (going back lands built)
          if (hit) s.seek(hit.to); else s.seek(0);
          s._state = "held";
        } else if (hit) s.playTo(hit.to);
        else if (s._t > 0) { s.seek(0); s._state = "held"; }
      } else if (trig !== "manual" && !s._wasActive) s.play(0);
      s._wasActive = true;
      const sus = suspended(s);
      if (sus && s._state === "playing") { s._stopClock(); s._state = "suspended"; }
      else if (!sus && s._state === "suspended") { s._state = "playing"; s._startClock(); }
    }
  }
  function whenReady(fn) {
    if (typeof document === "undefined") return;
    let tries = 0;
    const go = () => {
      if (document.getElementById("sw-slides") && SWok() && !global.SW.isReady()) global.SW.on("ready", fn);
      else if (document.getElementById("sw-slides") && !SWok() && ++tries < 100) setTimeout(go, 30);   // the deck runtime hasn't run yet
      else fn();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true }); else go();
  }

  const keys = new WeakMap();
  let nextKey = 0;
  const keyOf = (el) => { if (!el) return null; if (!keys.has(el)) keys.set(el, ++nextKey); return keys.get(el); };

  // A pixel sprite as crisp SVG: rows of characters, one per cell; palette maps a character to a colour ("." is empty).
  // Horizontal runs merge into one rect each. Groups: each character's rects share data-part="<char>" for targeting.
  function sprite(rows, palette = {}, o = {}) {
    const lines = (Array.isArray(rows) ? rows : String(rows).split("\n")).map((l) => l.replace(/\s+$/, "")).filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
    const unit = o.unit || 8, w = Math.max(...lines.map((l) => l.length)), h = lines.length, rects = [];
    lines.forEach((line, y) => {
      for (let x = 0; x < line.length;) {
        const c = line[x];
        if (c === "." || c === " ") { x++; continue; }
        let x2 = x;
        while (line[x2 + 1] === c) x2++;
        const fill = palette[c] || "currentColor";
        rects.push(`<rect data-part="${c}" x="${x}" y="${y}" width="${x2 - x + 1}" height="1" fill="${fill}"/>`);
        x = x2 + 1;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="${w * unit}" height="${h * unit}" shape-rendering="crispEdges"${o.id ? ` id="${o.id}"` : ""} aria-hidden="true">${rects.join("")}</svg>`;
  }

  // Sprite definitions: JSON in <script type="application/json" data-am-sprites> inside the kit or a scene's template:
  //   { "agent": { "unit": 4, "palette": { "A": "currentColor", "K": "#1F1E1C" }, "poses": { "neutral": ["..AA..", …], "happy": […] } } }
  // An element with data-am-sprite="agent" (first pose) or "agent:happy" is drawn with it; s.pose(el, "happy") swaps.
  function readSprites(root) {
    const defs = {};
    root.querySelectorAll('script[type="application/json"][data-am-sprites]').forEach((sc) => {
      try { Object.assign(defs, JSON.parse(sc.textContent)); } catch (e) { throw new Error(`sprite definitions aren't valid JSON: ${e.message}`); }
      sc.remove();
    });
    return defs;
  }
  function drawSprites(root, defs) {
    root.querySelectorAll("[data-am-sprite]").forEach((el) => {
      const [name, pose0] = el.getAttribute("data-am-sprite").split(":");
      const def = defs[name];
      if (!def || !def.poses) throw new Error(`no sprite "${name}" (defined: ${Object.keys(defs).join(", ") || "none"}; add it to the kit's data-am-sprites JSON)`);
      const pose = pose0 || Object.keys(def.poses)[0];
      if (!def.poses[pose]) throw new Error(`sprite "${name}" has no pose "${pose}" (poses: ${Object.keys(def.poses).join(", ")})`);
      el._amSprite = { name, def, pose, draw: (p) => sprite(def.poses[p], def.palette, { unit: def.unit }) };
      el.innerHTML = el._amSprite.draw(pose);
    });
  }
  function copySprites(src, dst) {
    const a = [src, ...src.querySelectorAll("[data-am-sprite]")], b = [dst, ...dst.querySelectorAll("[data-am-sprite]")];
    a.forEach((el, i) => { if (el._amSprite && b[i]) b[i]._amSprite = el._amSprite; });
  }

  // ── the AM API ──
  const AM = {
    version: VERSION,
    sprite,
    // AM.scene(name, s => s.enter(…)…) — a timeline defined outside the element, for <am-scene name>.
    scene(name, fn) {
      registry.set(name, fn);
      const w = waiting.get(name);
      if (w) { waiting.delete(name); w.forEach((s) => { s._compiled = false; s._park(); }); sync(); }
      return AM;
    },
    // AM.verb(name, (s, ...args) => s.move(…).set(…)) — a new verb built from existing ones.
    verb(name, fn) {
      if (Timeline.prototype[name] && !verbs[name]) throw new Error(`animotion: "${name}" is a built-in verb`);
      verbs[name] = fn;
      Timeline.prototype[name] = function (...args) { return this._run(name, () => fn(this, ...args)); };
      return AM;
    },
    list() { return [...scenes].map((s) => ({ el: s, name: s.getAttribute("name") || "", duration: s.duration, labels: s.labels, poster: s.posterTime, state: s.state, error: s.error, copy: s.isCopy })); },
    get(x) { return typeof x === "string" ? [...scenes].find((s) => s.getAttribute("name") === x) || null : x; },
    // Still mode: every scene rests on its poster and nothing plays (for captures and printing).
    still(on = true) { still = !!on; sync(); for (const s of scenes) if (still) s._park(); return AM; },
    pauseAll(on = true) { userPausedAll = !!on; sync(); return AM; },
    // For checks: compiled facts about a scene.
    inspect(x) {
      const s = AM.get(x);
      if (!s || !s._ensure()) return null;
      const tl = s._tl;
      return { name: s.getAttribute("name") || "", duration: tl.duration, labels: tl.labels, poster: s.posterTime, expects: tl.expects.map((e) => ({ at: e.at, t: e.t, target: String(e.target), want: e.want })),
        items: tl.items.map((i) => ({ verb: i.verb, ch: i.ch, start: +i.start.toFixed(3), dur: +i.dur.toFixed(3), key: keyOf(i.el), fx: !!(i.el && i.el.classList && i.el.classList.contains("am-particle")),
          target: i.el && i.el.id ? "#" + i.el.id : i.el ? i.el.tagName.toLowerCase() : null })) };
    },
    // Check every s.expect(): seek to its time and compare. Returns [{ ok, at, target, msg }].
    verify(x) {
      const s = AM.get(x);
      if (!s || !s._ensure()) return [{ ok: false, msg: s && s.error ? s.error : "scene not ready" }];
      const out = [];
      for (const e of s._tl.expects) {
        s.seek(e.t !== null ? e.t : e.at === "start" ? 0 : s.duration);
        const els = typeof e.target === "string" ? [...s._stage.querySelectorAll(e.target)] : [e.target];
        for (const el of els) {
          const bad = [];
          const w = e.want || {};
          if (w.text !== undefined && el.textContent.trim() !== String(w.text)) bad.push(`text is "${el.textContent.trim()}", expected "${w.text}"`);
          if (w.state !== undefined && el.getAttribute("data-state") !== w.state) bad.push(`state is ${JSON.stringify(el.getAttribute("data-state"))}, expected ${JSON.stringify(w.state)}`);
          if (w.visible !== undefined) { const vis = getComputedStyle(el).visibility !== "hidden" && +getComputedStyle(el).opacity > 0.01; if (vis !== !!w.visible) bad.push(w.visible ? "is hidden, expected visible" : "is visible, expected hidden"); }
          if (w.class !== undefined && !el.classList.contains(w.class)) bad.push(`lacks class ${w.class}`);
          out.push({ ok: !bad.length, at: e.at, target: String(e.target), msg: bad.join("; ") });
        }
      }
      s._park();
      return out;
    },
    // Promise: every scene on the page mounted and compiled (fonts loaded). Scenes that can't compile report an error.
    ready() {
      const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
      return fonts.then(() => new Promise((res) => {
        const check = (n) => {
          const all = [...document.querySelectorAll("am-scene")];
          if (all.every((s) => s._mounted) || n > 100) { all.forEach((s) => s._ensure()); res(AM.list()); } else setTimeout(() => check(n + 1), 20);
        };
        check(0);
      }));
    },
  };

  // ── wiring ──
  if (typeof customElements !== "undefined" && typeof document !== "undefined") {
    if (global.AM && global.AM.version) return;   // inlined twice: the first one wins
    global.AM = AM;
    customElements.define("am-scene", AmScene);
    if (!customElements.get("am-cue")) customElements.define("am-cue", class extends HTMLElement {});
    io = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      for (const e of entries) e.target._onScreen = e.isIntersecting && (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= innerHeight * 0.5);
      sync();
    }, { threshold: [0, 0.35, 0.6] }) : null;
    reduce.addEventListener("change", sync);
    printing.addEventListener("change", () => { if (printing.matches) for (const s of scenes) s._park(); sync(); });
    addEventListener("beforeprint", () => { for (const s of scenes) { s._compiled = s._compiled && !!s._tl; s._park(); } });
    document.addEventListener("visibilitychange", sync);
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    whenReady(() => {
      if (SWok()) {
        ["change", "pause", "refresh", "ready"].forEach((t) => global.SW.on(t, sync));
        if (global.SW.key) global.SW.key({ keys: ["m"], desc: "Pause or play animations" }, () => {
          const cur = [...scenes].filter((s) => active(s));
          const anyPlaying = cur.some((s) => s._state === "playing");
          cur.forEach((s) => (anyPlaying ? s.pause() : s.resume()));
        });
      }
      sync();
    });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { AM, Timeline, readTokens, ROLE_EASE, sprite, compile, valueAt, render, easeFn, EASE, formatter, numberShape, parseColor, interp, rng, hash, VERSION };
})(typeof window !== "undefined" ? window : globalThis);
