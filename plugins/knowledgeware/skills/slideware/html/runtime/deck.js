// deck.js — the slideware runtime: shows one deck file as a presentation.
//
// The engine inlines this file (with presenter.js after it) into every deck as
// <script id="sw-runtime">. It replaces Reveal.js. What it does:
//   - a fixed 1280×720 stage (#sw-slides), scaled to fit its host and letterboxed
//   - slides are the <section data-key> children of #sw-slides; <section hidden> is left out
//   - builds: elements with class="fragment" or data-step="n" appear one step at a time, but only
//     while builds are on (a presenter window is connected, or the deck says builds: "always");
//     otherwise every slide shows complete
//   - entrance motion on [data-a] elements, keys, touch swipes, a progress bar, blackout,
//     fullscreen, a key help panel, URL routing by slide key (#/s1-07, #/s1-07/2; old #/3 links)
//   - figures: <svg data-figure-ref="name"> on a slide is filled from <template id="sw-assets">,
//     with every id suffixed per copy so two copies never collide
//   - the running footer, from the deck settings (#sw-deck): text, the logo asset, page numbers
//   - print and PDF: one slide per 1280×720 page, every build shown
//
// Everything the runtime adds to the page is marked: classes start with sw-, attributes with
// data-sw-, custom properties with --sw-. The editor strips those when it reads the page, so
// runtime state never reaches the saved file.
//
// API (window.SW), for the presenter, the editor and the engine's headless tools:
//   SW.slides() SW.allSlides() SW.current() SW.index() SW.step() SW.steps(slide) SW.stepsLeft()
//   SW.go(i, step | "end") SW.next() SW.prev() SW.builds(on?) SW.paused() SW.pause(on?)
//   SW.on(type, fn) — "ready", "change" {index, step, moved}, "pause", "layout", "refresh"
//   SW.key({ key, desc, when }, fn) SW.keys()  SW.layout() SW.host(el) SW.scale() SW.refresh()
//   SW.asset(name) SW.expand(root) SW.ready(fn) SW.config SW.stage SW.measure()
(function () {
  "use strict";
  if (window.SW) return;

  const VERSION = "2.0.0";
  const W = 1280, H = 720;
  const doc = document, html = doc.documentElement;

  const CSS = `
html.sw-deck, html.sw-deck body { margin: 0; height: 100%; }
html.sw-deck body { overflow: hidden; background: var(--color-bg, #FFFFFF); }
#sw-slides { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; margin: 0; padding: 0;
  transform-origin: 0 0; transform: translate(var(--sw-x, 0px), var(--sw-y, 0px)) scale(var(--sw-scale, 1)); }
section[data-key] { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; margin: 0; box-sizing: border-box; overflow: hidden; }
section[data-key] > aside.notes { display: none !important; }
#sw-slides > section { transition: opacity .35s ease, visibility .35s ease; }
#sw-slides > section:not(.sw-present) { opacity: 0; visibility: hidden; pointer-events: none; }
#sw-slides > section[hidden] { display: none !important; }
html.sw-still #sw-slides > section, html.sw-still #sw-slides .fragment, html.sw-still #sw-slides [data-step] { transition: none !important; }

/* Builds: hidden until their step, only while builds are on. */
#sw-slides .fragment, #sw-slides [data-step] { transition: opacity .3s ease, visibility .3s ease; }
html.sw-builds #sw-slides > section :is(.fragment, [data-step]):not(.sw-visible) { opacity: 0; visibility: hidden; }
svg .fragment, svg [data-step] { will-change: auto; }

/* Entrance motion: [data-a] elements animate in when their slide becomes current, staggered by --i. */
#sw-slides > section.sw-present [data-a] { animation: .5s cubic-bezier(.4, 0, .2, 1) calc(100ms + var(--i, 0) * 70ms) both; }
#sw-slides > section.sw-present [data-a="up"]     { animation-name: sw-a-up; }
#sw-slides > section.sw-present [data-a="fade"]   { animation-name: sw-a-fade; animation-duration: .7s; }
#sw-slides > section.sw-present [data-a="left"]   { animation-name: sw-a-left; }
#sw-slides > section.sw-present [data-a="right"]  { animation-name: sw-a-right; }
#sw-slides > section.sw-present [data-a="pop"]    { animation-name: sw-a-pop; animation-timing-function: cubic-bezier(.3, 1.4, .5, 1); }
#sw-slides > section.sw-present [data-a="grow-x"] { animation-name: sw-a-grow-x; animation-duration: .8s; transform-origin: left center; }
#sw-slides > section.sw-present [data-a="grow-y"] { animation-name: sw-a-grow-y; animation-duration: .8s; transform-origin: center bottom; }
#sw-slides > section.sw-present [data-a="wipe"]   { animation-name: sw-a-wipe; animation-duration: .9s; }
#sw-slides > section.sw-present [data-a="draw"]   { animation-name: sw-a-draw; animation-duration: 1.1s; }
[data-a="draw"] { stroke-dasharray: 1; }
@keyframes sw-a-up     { from { opacity: 0; transform: translateY(14px); } }
@keyframes sw-a-fade   { from { opacity: 0; } }
@keyframes sw-a-left   { from { opacity: 0; transform: translateX(-18px); } }
@keyframes sw-a-right  { from { opacity: 0; transform: translateX(18px); } }
@keyframes sw-a-pop    { from { opacity: 0; transform: scale(.82); } }
@keyframes sw-a-grow-x { from { transform: scaleX(0); } }
@keyframes sw-a-grow-y { from { transform: scaleY(0); } }
@keyframes sw-a-wipe   { from { clip-path: inset(0 100% 0 0); } }
@keyframes sw-a-draw   { from { stroke-dashoffset: 1; } }
/* A build with motion waits for its step, then plays at once; a step's elements stagger among themselves. */
html.sw-builds #sw-slides > section.sw-present :is(.fragment, [data-step])[data-a]:not(.sw-visible) { animation-name: none; }
html.sw-builds #sw-slides > section.sw-present :is(.fragment, [data-step]).sw-visible[data-a] { animation-delay: calc(var(--sw-k, 0) * 70ms); }
html.sw-quiet [data-a] { animation: none !important; }
@media (prefers-reduced-motion: reduce) { [data-a] { animation: none !important; } }

/* Cosmetic defaults sit in a layer, so a brand's or deck's CSS restyles them without fighting specificity. */
@layer sw-defaults {
/* Running footer, from the deck settings. Brands restyle .sw-chrome in their slideware.css. */
.sw-chrome { position: absolute; left: var(--margin, 0.5in); right: var(--margin, 0.5in); bottom: 14px; z-index: 5;
  display: flex; justify-content: space-between; align-items: center; pointer-events: none;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--color-ink-muted, #6B6B63); }
.sw-chrome-l { display: flex; align-items: center; min-width: 0; white-space: nowrap; overflow: hidden; }
.sw-chrome-l span + span::before { content: ""; display: inline-block; width: 3px; height: 3px; border-radius: 50%;
  background: var(--color-ink-faint, #A8A294); margin: 0 14px; vertical-align: middle; }
.sw-chrome-r { display: flex; align-items: center; gap: 14px; flex: none; }
.sw-chrome-logo { height: 13px; width: auto; opacity: .85; }
.sw-chrome-pg { letter-spacing: .08em; color: var(--color-ink-body, #3D3A35); font-variant-numeric: tabular-nums; }

.sw-progress { position: fixed; left: 0; bottom: 0; z-index: 30; height: 3px; width: 100%; pointer-events: none;
  background: var(--color-accent, #3B5249); transform-origin: 0 0; transform: scaleX(var(--sw-progress, 0)); transition: transform .3s ease; }
.sw-help { display: none; position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 95; width: min(440px, 90vw);
  max-height: 80vh; overflow: auto; padding: 18px 20px; border-radius: 12px; border: 1px solid var(--color-border, #E3E3DF);
  background: var(--color-surface, #FFFFFF); color: var(--color-ink, #1A1A18); box-shadow: 0 12px 40px rgba(0, 0, 0, .25);
  font: 13px/1.45 var(--font-sans, system-ui, sans-serif); }
html.sw-help-on .sw-help { display: block; }
.sw-help h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-ink-muted, #6B6B63); }
.sw-help dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
.sw-help dt { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; white-space: nowrap; color: var(--color-accent, #3B5249); }
.sw-help dd { margin: 0; }
.sw-help p { margin: 10px 0 0; color: var(--color-ink-muted, #6B6B63); }
}
html.sw-paused::after { content: ""; position: fixed; inset: 0; z-index: 90; background: #000; }

/* Print and PDF, and ?print for headless captures: every visible slide on its own page, fully built. */
@page { size: ${W}px ${H}px; margin: 0; }
@media print {
  html.sw-deck, html.sw-deck body { height: auto; overflow: visible; }
  #sw-slides { position: static; transform: none; width: auto; height: auto; }
  #sw-slides > section { position: relative; opacity: 1 !important; visibility: visible !important; break-after: page; page-break-after: always; transition: none !important; }
  #sw-slides > section[hidden] { display: none !important; }
  #sw-slides :is(.fragment, [data-step]) { opacity: 1 !important; visibility: visible !important; }
  [data-a] { animation: none !important; }
  .sw-progress, .sw-help { display: none !important; }
  html.sw-paused::after { display: none; }
}
html.sw-print, html.sw-print body { height: auto; overflow: visible; }
html.sw-print #sw-slides { position: static; transform: none; width: auto; height: auto; }
html.sw-print #sw-slides > section { position: relative; opacity: 1 !important; visibility: visible !important; transition: none !important; }
html.sw-print #sw-slides > section[hidden] { display: none !important; }
html.sw-print #sw-slides :is(.fragment, [data-step]) { opacity: 1 !important; visibility: visible !important; }
html.sw-print [data-a] { animation: none !important; }
html.sw-print .sw-progress { display: none; }
`;

  // Inject the runtime's CSS at once, so the slides never flash unstyled.
  const styleEl = doc.createElement("style");
  styleEl.id = "sw-runtime-css";
  styleEl.textContent = CSS;
  (doc.head || html).appendChild(styleEl);

  const query = new URLSearchParams(location.search);
  const state = { all: [], slides: [], index: 0, step: 0, builds: false, paused: false, ready: false, scale: 1 };
  const listeners = {};
  const bindings = [];
  const readyQueue = [];
  let stage = null, host = null, progressEl = null, helpEl = null, instance = 0;
  const config = readConfig();

  function readConfig() {
    const el = doc.getElementById("sw-deck");
    if (!el) return {};
    try { return JSON.parse(el.textContent) || {}; } catch (e) { console.warn("slideware: #sw-deck isn't valid JSON", e); return {}; }
  }
  function emit(type, detail) {
    (listeners[type] || []).slice().forEach((fn) => { try { fn(detail); } catch (e) { console.error(e); } });
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const typing = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  // The capital letter a key event types, or null: an upper-case character (Shift or Caps Lock),
  // or a letter with Shift held (synthetic events can send the lowercase character with shiftKey).
  const capitalOf = (e) => e.key && e.key.length === 1 && /[a-z]/i.test(e.key) && (e.shiftKey || e.key !== e.key.toLowerCase()) ? e.key.toUpperCase() : null;

  // ── Assets and figures ─────────────────────────────────────────────
  function assetsRoot() {
    const t = doc.getElementById("sw-assets");
    return t ? (t.content || t) : null;
  }
  function asset(name) {
    const r = assetsRoot();
    if (!r || !name) return null;
    const esc = window.CSS && CSS.escape ? CSS.escape(name) : name;
    return r.querySelector(`[data-figure="${esc}"], [data-asset="${esc}"]`);
  }
  // Suffix every id in a cloned figure and rewrite the references to them, so copies never collide.
  function rewriteIds(node, suffix) {
    const ids = new Map();
    const all = [node, ...node.querySelectorAll("*")];
    all.forEach((el) => { if (el.id) ids.set(el.id, el.id + suffix); });
    if (!ids.size) return;
    const fixRefs = (v) => v.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, q, id) => ids.has(id) ? `url(${q}#${ids.get(id)}${q})` : m);
    all.forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        let v = a.value;
        if (a.name === "id" && ids.has(v)) v = ids.get(v);
        else if ((a.name === "href" || a.name === "xlink:href") && v[0] === "#" && ids.has(v.slice(1))) v = "#" + ids.get(v.slice(1));
        else if (/^aria-(labelledby|describedby|controls)$/.test(a.name)) v = v.split(/\s+/).map((t) => ids.get(t) || t).join(" ");
        else if (v.indexOf("url(") >= 0) v = fixRefs(v);
        if (v !== a.value) el.setAttribute(a.name, v);
      }
      if (el.tagName.toLowerCase() === "style") {
        let css = fixRefs(el.textContent);
        ids.forEach((to, from) => { css = css.replace(new RegExp("#" + from.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&") + "(?![\\w-])", "g"), "#" + to); });
        el.textContent = css;
      }
    });
  }
  // Fill <svg data-figure-ref> (or any element with it) and <img data-asset-ref> from the asset block.
  function expand(root) {
    (root || stage).querySelectorAll("[data-figure-ref]:not([data-sw-expanded])").forEach((ph) => {
      const fig = asset(ph.getAttribute("data-figure-ref"));
      if (!fig) { console.warn("slideware: no figure named", ph.getAttribute("data-figure-ref")); return; }
      const clone = fig.cloneNode(true);
      rewriteIds(clone, "--sw" + (++instance));
      const added = [];
      if (ph.namespaceURI === clone.namespaceURI && ph.localName === clone.localName) {
        for (const a of Array.from(clone.attributes)) {
          if (a.name === "data-figure" || a.name === "id" || ph.hasAttribute(a.name)) continue;
          ph.setAttribute(a.name, a.value);
          added.push(a.name);
        }
        while (clone.firstChild) ph.appendChild(clone.firstChild);
      } else {
        clone.removeAttribute("data-figure");
        ph.appendChild(clone);
      }
      ph.setAttribute("data-sw-expanded", added.join(" "));
    });
    (root || stage).querySelectorAll("img[data-asset-ref]:not([data-sw-expanded])").forEach((img) => {
      const a = asset(img.getAttribute("data-asset-ref"));
      const src = a && (a.getAttribute("src") || a.getAttribute("href"));
      if (!src) { console.warn("slideware: no image asset named", img.getAttribute("data-asset-ref")); return; }
      img.setAttribute("src", src);
      img.setAttribute("data-sw-expanded", "src");
    });
  }

  // ── Slides and builds ──────────────────────────────────────────────
  function readSlides() {
    state.all = Array.from(stage.children).filter((el) => el.localName === "section");
    state.slides = state.all.filter((s) => !s.hidden);
  }
  // Builds on a slide: every .fragment / [data-step] element with its step number. An explicit
  // data-step or data-fragment-index wins; the rest take their position among the slide's builds.
  function buildsOf(sec) {
    if (!sec) return [];
    return Array.from(sec.querySelectorAll(".fragment, [data-step]")).map((el, i) => {
      const raw = el.getAttribute("data-step") ?? el.getAttribute("data-fragment-index");
      const n = raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : i;
      return { el, n };
    });
  }
  function stepsOf(sec) { return [...new Set(buildsOf(sec).map((b) => b.n))].sort((a, b) => a - b); }
  // Within each step its elements stagger from zero (--sw-k).
  function staggerBuilds(sec) {
    const seen = {};
    buildsOf(sec).forEach(({ el, n }) => {
      const k = (seen[n] = (seen[n] || 0) + 1) - 1;
      if (k) el.style.setProperty("--sw-k", k); else el.style.removeProperty("--sw-k");
    });
  }
  function applyBuilds(sec, step) {   // step: how many steps of this slide are shown
    const steps = stepsOf(sec), upTo = step > 0 ? steps[step - 1] : -Infinity;
    buildsOf(sec).forEach(({ el, n }) => {
      el.classList.toggle("sw-visible", n <= upTo);
      el.classList.toggle("sw-current", step > 0 && n === upTo);
    });
  }

  function go(i, step, opts = {}) {
    const n = state.slides.length;
    if (!n) return;
    i = clamp(Math.round(Number(i) || 0), 0, n - 1);
    const sec = state.slides[i], total = stepsOf(sec).length;
    let s = step === "end" ? total : Number(step) || 0;
    s = state.builds ? clamp(s, 0, total) : total;
    const moved = i !== state.index || !state.slides[state.index] || !state.slides[state.index].classList.contains("sw-present");
    state.index = i;
    state.step = s;
    state.all.forEach((el) => {
      const j = state.slides.indexOf(el);
      const present = el === sec;
      el.classList.toggle("sw-present", present);
      el.classList.toggle("sw-past", j >= 0 && j < i);
      el.classList.toggle("sw-future", j > i);
      if (present) { el.removeAttribute("aria-hidden"); el.inert = false; }
      else { el.setAttribute("aria-hidden", "true"); el.inert = true; }
      if (!present && j >= 0) applyBuilds(el, j < i ? Infinity : 0);
    });
    applyBuilds(sec, s);
    if (progressEl) progressEl.style.setProperty("--sw-progress", n > 1 ? i / (n - 1) : 1);
    if (!opts.silentHash) writeHash();
    emit("change", { index: i, step: s, moved, slide: sec });
  }
  function next() {
    const sec = state.slides[state.index];
    if (state.builds && state.step < stepsOf(sec).length) go(state.index, state.step + 1);
    else if (state.index < state.slides.length - 1) go(state.index + 1, 0);
  }
  function prev() {
    if (state.builds && state.step > 0) go(state.index, state.step - 1);
    else if (state.index > 0) go(state.index - 1, "end");
  }
  function builds(on) {
    if (on === undefined) return state.builds;
    on = !!on;
    if (on === state.builds) return on;
    state.builds = on;
    html.classList.toggle("sw-builds", on);
    if (state.ready) go(state.index, stepsOf(state.slides[state.index]).length, { silentHash: true });   // nothing vanishes mid-talk
    return on;
  }
  function pause(on) {
    on = on === undefined ? !state.paused : !!on;
    if (on === state.paused) return on;
    state.paused = on;
    html.classList.toggle("sw-paused", on);
    emit("pause", { paused: on });
    return on;
  }

  // ── URL ────────────────────────────────────────────────────────────
  function writeHash() {
    const sec = state.slides[state.index];
    if (!sec) return;
    const h = "#/" + encodeURIComponent(sec.getAttribute("data-key") || String(state.index)) + (state.builds && state.step ? "/" + state.step : "");
    if (location.hash !== h) try { history.replaceState(null, "", h); } catch (e) { /* sandboxed */ }
  }
  function readHash() {
    const m = /^#\/([^/]+)(?:\/(\d+))?/.exec(location.hash);
    if (!m) return null;
    const key = decodeURIComponent(m[1]);
    let i = state.slides.findIndex((s) => s.getAttribute("data-key") === key);
    if (i < 0 && /^\d+$/.test(key)) i = Number(key);   // an old Reveal link, #/3
    return i < 0 ? null : { index: i, step: m[2] ? Number(m[2]) : 0 };
  }

  // ── Layout ─────────────────────────────────────────────────────────
  function layout() {
    if (!stage) return;
    const h = stage.parentElement;
    const isBody = h === doc.body;
    const r = isBody ? { width: window.innerWidth, height: window.innerHeight } : h.getBoundingClientRect();
    const reserve = isBody ? parseFloat(getComputedStyle(html).getPropertyValue("--sw-reserve-bottom")) || 0 : 0;
    const availH = Math.max(0, r.height - reserve);
    const s = Math.max(0.01, Math.min(r.width / W, availH / H));
    state.scale = s;
    stage.style.setProperty("--sw-scale", s);
    stage.style.setProperty("--sw-x", (r.width - W * s) / 2 + "px");
    stage.style.setProperty("--sw-y", (hostAlign === "bottom" ? availH - H * s : (availH - H * s) / 2) + "px");
    emit("layout", { scale: s });
  }
  let hostObserver = null, hostAlign = "center";
  function setHost(el, opts = {}) {
    host = el || doc.body;
    hostAlign = opts.align || "center";
    if (stage.parentElement !== host) host.appendChild(stage);
    if (hostObserver) hostObserver.disconnect();
    if (host !== doc.body && window.ResizeObserver) { hostObserver = new ResizeObserver(layout); hostObserver.observe(host); }
    layout();
  }

  // A fully built, inert copy of a slide for thumbnails: runtime state cleared, ids suffixed.
  function cloneSlide(sec) {
    const copy = sec.cloneNode(true);
    copy.classList.remove("sw-past", "sw-future");
    copy.classList.add("sw-present");
    copy.removeAttribute("hidden");
    copy.removeAttribute("aria-hidden");
    copy.removeAttribute("id");
    copy.querySelectorAll("[autoplay]").forEach((m) => m.removeAttribute("autoplay"));
    copy.querySelectorAll("script").forEach((s) => s.remove());
    copy.querySelectorAll(".fragment, [data-step]").forEach((f) => f.classList.add("sw-visible"));
    rewriteIds(copy, "--swc" + (++instance));
    return copy;
  }

  // ── Running footer ─────────────────────────────────────────────────
  function chrome() {
    stage.querySelectorAll(".sw-chrome[data-sw-gen]").forEach((el) => el.remove());
    const texts = [].concat(config.footer || []).filter((t) => typeof t === "string" && t.trim());
    const logo = config.logo === false ? null : asset(config.logo || "logo");
    const numbers = config.pageNumbers !== undefined ? !!config.pageNumbers : texts.length > 0;
    if (!texts.length && !logo && !numbers) return;
    const total = state.slides.length;
    state.slides.forEach((sec, i) => {
      if (sec.getAttribute("data-chrome") === "none") return;
      const f = doc.createElement("footer");
      f.className = "sw-chrome";
      f.setAttribute("data-sw-gen", "");
      f.setAttribute("aria-hidden", "true");
      const l = doc.createElement("span");
      l.className = "sw-chrome-l";
      texts.forEach((t) => { const s = doc.createElement("span"); s.textContent = t; l.appendChild(s); });
      const r = doc.createElement("span");
      r.className = "sw-chrome-r";
      if (logo) { const c = logo.cloneNode(true); c.removeAttribute("data-asset"); c.removeAttribute("data-figure"); c.classList.add("sw-chrome-logo"); rewriteIds(c, "--swl" + (++instance)); r.appendChild(c); }
      if (numbers) { const p = doc.createElement("span"); p.className = "sw-chrome-pg"; p.textContent = String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0"); r.appendChild(p); }
      f.append(l, r);
      sec.appendChild(f);
    });
  }

  // ── Keys ───────────────────────────────────────────────────────────
  // spec.key: a capital letter ("P", fires only as a capital), or an exact KeyboardEvent.key
  // ("f", "?", "ArrowRight", " "); spec.keys: several of those. spec.label is what help shows.
  function key(spec, fn) {
    const keys = [].concat(spec.keys || spec.key);
    bindings.push({ keys, label: spec.label || keys.map((k) => k === " " ? "Space" : k).join(" "), desc: spec.desc || "", when: spec.when, hidden: !!spec.hidden, fn });
  }
  function keyList() { return bindings.filter((b) => b.desc && !b.hidden).map((b) => ({ label: b.label, desc: b.desc })); }
  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const cap = capitalOf(e);
    for (let i = bindings.length - 1; i >= 0; i--) {   // later bindings win, so modules can take a key over
      const b = bindings[i];
      const hit = b.keys.some((k) => (k.length === 1 && /[A-Z]/.test(k)) ? cap === k : (cap === null && e.key === k) || (k.length > 1 && e.key === k));
      if (!hit || (b.when && !b.when())) continue;
      e.preventDefault();
      b.fn(e);
      return;
    }
  }
  function toggleHelp(open) {
    if (!helpEl) {
      helpEl = doc.createElement("div");
      helpEl.className = "sw-help";
      helpEl.setAttribute("role", "dialog");
      helpEl.setAttribute("aria-label", "Keyboard shortcuts");
      doc.body.appendChild(helpEl);
    }
    open = open === undefined ? !html.classList.contains("sw-help-on") : open;
    if (open) helpEl.innerHTML = "<h3>Keys</h3><dl>" + keyList().map((k) => `<dt>${escHtml(k.label)}</dt><dd>${escHtml(k.desc)}</dd>`).join("") +
      "</dl><p>Capital letters need Shift (or Caps Lock). Esc closes this.</p>";
    html.classList.toggle("sw-help-on", open);
  }
  function escHtml(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function toggleFullscreen() {
    if (doc.fullscreenElement) doc.exitFullscreen();
    else if (html.requestFullscreen) html.requestFullscreen();
  }

  // ── Measurement, for the engine's checks and exports ───────────────
  // Geometry of the current slide in stage pixels: text runs, images, SVG figures, boxes.
  function measure(sec) {
    sec = sec || state.slides[state.index];
    if (!sec) return null;
    const base = sec.getBoundingClientRect(), s = base.width / W || 1;
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - base.left) / s, y: (r.top - base.top) / s, w: r.width / s, h: r.height / s }; };
    const out = { key: sec.getAttribute("data-key"), width: W, height: H, overflow: [], texts: [], images: [], svgs: [] };
    const walker = doc.createTreeWalker(sec, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.currentNode; el; el = walker.nextNode()) {
      if (el === sec || el.closest("aside.notes")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const b = box(el);
      if (b.w > 0 && b.h > 0 && (b.x < -1 || b.y < -1 || b.x + b.w > W + 1 || b.y + b.h > H + 1) && !el.closest("svg")) out.overflow.push({ tag: el.localName, cls: el.getAttribute("class") || "", ...b });
      if (el.localName === "svg" && !el.parentElement.closest("svg")) out.svgs.push({ ...b, id: el.getAttribute("data-figure-ref") || el.id || "" });
      else if (el.localName === "img") out.images.push({ ...b, src: (el.currentSrc || el.src || "").slice(0, 64) });
      if (el.closest("svg")) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (own.length) out.texts.push({ tag: el.localName, text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 200), font: cs.fontFamily, size: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color, ...b });
    }
    return out;
  }

  // ── Start ──────────────────────────────────────────────────────────
  function refresh() {
    const current = state.slides[state.index];
    readSlides();
    state.slides.forEach(staggerBuilds);
    chrome();
    let i = state.slides.indexOf(current);
    if (i < 0) i = Math.min(state.index, state.slides.length - 1);
    go(i, state.step, { silentHash: false });
    emit("refresh", {});
  }
  function start() {
    stage = doc.getElementById("sw-slides");
    if (!stage) { console.warn("slideware: no #sw-slides element"); return; }
    html.classList.add("sw-deck");
    // ?print lays every slide out for print; ?still turns motion off; ?capture (headless exports)
    // is still with no transitions and no navigation chrome.
    const capture = query.has("capture");
    if (query.has("print")) html.classList.add("sw-print");
    if (query.has("still") || capture) html.classList.add("sw-quiet");
    if (capture) html.classList.add("sw-capture");
    expand(stage);
    readSlides();
    state.slides.forEach(staggerBuilds);
    chrome();
    if (config.progress !== false && !query.has("presenter") && !capture) {
      progressEl = doc.createElement("div");
      progressEl.className = "sw-progress";
      doc.body.appendChild(progressEl);
    }
    state.builds = config.builds === "always";
    html.classList.toggle("sw-builds", state.builds);
    // Navigation keys. Modules add theirs (P, N, O, E) through SW.key.
    key({ keys: ["ArrowRight", "ArrowDown", " ", "PageDown"], label: "→ ↓ Space", desc: "Next build or slide" }, next);
    key({ keys: ["ArrowLeft", "ArrowUp", "PageUp"], label: "← ↑", desc: "Previous build or slide" }, prev);
    key({ keys: ["Home"], desc: "First slide" }, () => go(0, 0));
    key({ keys: ["End"], desc: "Last slide" }, () => go(state.slides.length - 1, "end"));
    key({ keys: ["f"], desc: "Fullscreen" }, toggleFullscreen);
    key({ keys: ["b", "."], label: "b or .", desc: "Black out the screen" }, () => pause());
    key({ keys: ["?"], desc: "This list of keys" }, () => toggleHelp());
    key({ keys: ["Escape"], hidden: true, when: () => html.classList.contains("sw-help-on") }, () => toggleHelp(false));
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("click", (e) => { if (html.classList.contains("sw-help-on") && helpEl && !helpEl.contains(e.target)) toggleHelp(false); });
    window.addEventListener("hashchange", () => { const h = readHash(); if (h && (h.index !== state.index || h.step !== state.step)) go(h.index, h.step, { silentHash: true }); });
    window.addEventListener("resize", layout);
    // Touch: a horizontal swipe on the stage moves a step.
    let sx = null, sy = null;
    stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") { sx = e.clientX; sy = e.clientY; } });
    stage.addEventListener("pointerup", (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = sy = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && !html.classList.contains("sw-editing")) (dx < 0 ? next : prev)();
    });
    html.classList.add("sw-still");
    setHost(stage.parentElement);
    const h = readHash();
    go(h ? h.index : 0, h ? h.step : 0);
    if (!capture) requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("sw-still")));
    state.ready = true;
    readyQueue.splice(0).forEach((fn) => { try { fn(SW); } catch (e) { console.error(e); } });
    emit("ready", {});
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout);
  }

  const SW = {
    version: VERSION, width: W, height: H, config,
    get stage() { return stage; },
    slides: () => state.slides.slice(),
    allSlides: () => state.all.slice(),
    current: () => state.slides[state.index] || null,
    index: () => state.index,
    step: () => state.step,
    steps: (sec) => stepsOf(sec || state.slides[state.index]).length,
    stepsLeft: () => state.builds ? stepsOf(state.slides[state.index]).length - state.step : 0,
    go, next, prev, builds, pause,
    paused: () => state.paused,
    scale: () => state.scale,
    layout, refresh, expand, asset, measure, cloneSlide,
    host: setHost,
    key, keys: keyList,
    capitalOf, typing,
    help: toggleHelp,
    isReady: () => state.ready,
    ready(fn) { if (state.ready) fn(SW); else readyQueue.push(fn); },
    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); return () => SW.off(type, fn); },
    off(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
  };
  window.SW = SW;

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
})();
