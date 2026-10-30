// review.js — review mode for slideware HTML decks: edit text and speaker notes in the browser,
// save the edits as ./edits.json, and have the next build fold them into slides.js.
//
// A Reveal.js 5 plugin. build-deck.js inlines it after presenter.js when slides.js sets
// `review: true` (or the build runs with --review) and registers it:
//   Reveal.initialize({ ..., plugins: [RevealPresenter, RevealReview], review: { built, lane, file } })
// Decks built without it carry none of this code.
//
// Keys (audience window only; nothing here runs in the presenter window or in print):
//   E        toggle review mode. Every text field the builder marked with data-f becomes
//            editable in place (plain text; the light-HTML fields keep <strong>, <em>, <code>,
//            <br>, <a>, lists). A panel along the bottom edits the slide's speaker notes and
//            takes a comment for whoever edits the deck next. The arrows still move slides
//            while no field has focus; Enter or Esc leaves a field.
//   shift+b  rebuild the deck: a confirm bar, then (through serve-deck.js) the edits are saved,
//            `node build-deck.js .` runs, and the page reloads on the same slide. Over file://
//            or a plain static server there is nothing to run, so the bar says how to save.
//
// The overview (o) gains structural edits while review mode is on: an eye on each thumbnail
// hides or shows the slide (in the lane being viewed), an X deletes it (Undo brings it back),
// thumbnails drag and drop into a new order, and a Rebuild deck button beside Close turns solid
// when anything is queued. Keys on a focused thumbnail: h, del, shift+arrows. Every such edit is
// applied to the live deck at once (applyLive: sections re-appended in the pending order, hidden
// and deleted ones detached, Reveal re-synced), so the deck and the overview agree; slides.js
// catches up at the rebuild. presenter.js draws the overview through window.RevealReviewAPI,
// which this plugin provides, and learns of changes through the rp-review-change event.
//
// Edits live in this browser (localStorage, per deck file and per build) until saved, so a
// closed tab loses nothing; a draft from an older build is dropped, since its text may be gone.
// Save writes edits.json next to the deck: through serve-deck.js when the deck is served by
// it, else with the browser's save dialog (Chrome, Edge; the file is remembered for the
// session), else as a download. Copy puts the same JSON on the clipboard, to paste to Claude.
//
// The file (see build-deck.js §Review edits for how it is folded):
//   { built, lane, file, saved, keys: [every key, built order],
//     slides: { "<key>": { "<field>": { from, to }, comment } },
//     deck: { hidden: { "<key>": bool }, deleted: ["<key>"], order: ["<key>"] } }
// A field's `from` is the text as built, so the fold can find and replace the exact literal.

(function (root) {
  "use strict";

  const NS = "reveal-review";
  const SANS = "var(--font-sans, system-ui, sans-serif)";
  const MONO = "var(--font-mono, ui-monospace, Menlo, monospace)";
  const ACCENT = "var(--color-accent, #3B5249)";
  const INK = "var(--color-ink, #1A1A18)";
  const MUTED = "var(--color-ink-muted, #6B6B63)";
  const SURFACE = "color-mix(in srgb, var(--color-surface, #FFFFFF) 94%, transparent)";
  const BORDER = "var(--color-border, #E3E3DF)";
  const ALLOWED = { STRONG: 1, EM: 1, CODE: 1, BR: 1, A: 1, UL: 1, OL: 1, LI: 1, SPAN: 1, SUP: 1, SUB: 1 };
  const RENAME = { B: "strong", I: "em" };
  const PANEL_H = "min(34vh, 320px)";

  const CSS = `
.rv-bar, .rv-confirm, .rv-toast { position: fixed; left: 50%; transform: translateX(-50%); z-index: 60; font-family: ${SANS}; font-size: 12px; color: ${INK};
  border: 1px solid ${BORDER}; border-radius: 12px; background: ${SURFACE}; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, .18); text-align: left; }
.rv-bar { display: none; top: 14px; align-items: center; gap: 4px; padding: 5px 5px 5px 12px; white-space: nowrap; }
html.rv-on .rv-bar { display: flex; }
.rv-bar .rv-label { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; margin-right: 6px; }
.rv-bar .rv-count { color: ${MUTED}; margin-right: 8px; min-width: 60px; }
.rv-bar button, .rv-confirm button { all: unset; cursor: pointer; height: 30px; padding: 0 10px; border-radius: 8px; display: inline-flex; align-items: center; color: ${INK}; }
.rv-bar button:hover, .rv-confirm button:hover { background: color-mix(in srgb, ${INK} 7%, transparent); }
.rv-bar button:focus-visible, .rv-confirm button:focus-visible, .rv-panel :focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
.rv-bar button[data-rv=done] { font-weight: 600; }
.rv-bar kbd, .rv-confirm kbd { font-family: ${MONO}; font-size: 10px; color: ${MUTED}; margin-left: 5px; }

.rv-toast { display: none; top: 60px; padding: 8px 14px; max-width: 70vw; white-space: pre-wrap; }
.rv-toast.rv-show { display: block; }

.rv-confirm { display: none; top: 50%; transform: translate(-50%, -50%); padding: 18px 20px; width: min(560px, 90vw); line-height: 1.5; }
.rv-confirm.rv-show { display: block; }
.rv-confirm h2 { margin: 0 0 6px; font: 600 15px ${SANS}; color: ${INK}; }
.rv-confirm p { margin: 0 0 10px; color: ${MUTED}; }
.rv-confirm pre { margin: 0 0 10px; max-height: 40vh; overflow: auto; padding: 10px; border-radius: 8px; font: 11px/1.45 ${MONO};
  background: color-mix(in srgb, ${INK} 6%, transparent); color: ${INK}; white-space: pre-wrap; }
.rv-confirm code { font-family: ${MONO}; font-size: 11px; }
.rv-confirm .rv-actions { display: flex; justify-content: flex-end; gap: 6px; }
.rv-confirm button[data-rv=go] { background: ${ACCENT}; color: var(--color-bg, #FFFFFF); font-weight: 600; }
.rv-confirm button[data-rv=go]:hover { filter: brightness(1.08); }

.rv-panel { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 44; height: ${PANEL_H}; box-sizing: border-box;
  padding: 10px 28px 64px; background: ${SURFACE}; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-top: 1px solid ${BORDER};
  box-shadow: 0 -8px 24px rgba(0, 0, 0, .10); color: ${INK}; font-family: ${SANS}; font-size: 14px; text-align: left;
  grid-template-rows: auto minmax(0, 1fr) auto; gap: 8px; }
html.rv-on .rv-panel { display: grid; }
html.rv-on .rp-drawer { display: none !important; }   /* the panel holds the notes while editing */
.rv-panel-head { display: flex; align-items: baseline; gap: 12px; font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rv-panel-head .rv-panel-title { color: ${MUTED}; letter-spacing: 0; text-transform: none; font-family: ${SANS}; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rv-panel textarea, .rv-panel input { all: unset; box-sizing: border-box; width: 100%; padding: 8px 10px; border: 1px solid ${BORDER}; border-radius: 8px;
  background: var(--color-surface, #FFFFFF); color: ${INK}; font: 14px/1.5 ${SANS}; white-space: pre-wrap; }
.rv-panel textarea { height: 100%; resize: none; overflow: auto; }
.rv-panel input { font-size: 13px; }
.rv-panel ::placeholder { color: ${MUTED}; }

html.rv-on .reveal [data-f]:not(aside) { cursor: text; outline: 1px dashed color-mix(in srgb, ${ACCENT} 45%, transparent); outline-offset: 3px; border-radius: 2px; min-width: 1ch; }
html.rv-on .reveal [data-f]:hover { outline-color: ${ACCENT}; }
html.rv-on .reveal [data-f]:focus { outline: 2px solid ${ACCENT}; background: color-mix(in srgb, ${ACCENT} 6%, transparent); }
html.rv-on .reveal [data-f].rv-edited { outline-style: solid; outline-color: color-mix(in srgb, ${ACCENT} 70%, transparent); }
html.rv-on .reveal [data-a] { animation: none !important; }   /* nothing moves under the caret */
html.rv-on body > .reveal { height: calc(100% - var(--rp-reserve-bottom, 0px)); }   /* the deck re-fits above the panel (presenter.js declares the same rule) */
@media print { .rv-bar, .rv-panel, .rv-confirm, .rv-toast { display: none !important; } }
`;

  const BAR_HTML = `<span class="rv-label">Review</span><span class="rv-count"></span>
<button type="button" data-rv="save" title="Save edits.json">Save</button>
<button type="button" data-rv="copy" title="Copy the edits as JSON">Copy</button>
<button type="button" data-rv="build" title="Save, rebuild the deck and reload (shift+b)">Rebuild<kbd>shift+b</kbd></button>
<button type="button" data-rv="discard" title="Drop every unsaved edit">Discard</button>
<button type="button" data-rv="done" title="Leave review mode (e)">Done<kbd>e</kbd></button>`;
  const PANEL_HTML = `<div class="rv-panel-head"><span class="rv-panel-num"></span><span>Speaker notes</span><span class="rv-panel-title"></span></div>
<textarea class="rv-notes" aria-label="Speaker notes" placeholder="Notes for this slide. A blank line splits paragraphs, lines starting with - form a list, **bold**, *italic*, [pause]."></textarea>
<input class="rv-comment" aria-label="Comment" placeholder="Comment for whoever edits the deck next (optional)"/>`;

  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function isHtml(el) { return el.hasAttribute("data-html"); }
  function valueOf(el) { return isHtml(el) ? el.innerHTML : el.textContent; }
  function setValue(el, v) { if (isHtml(el)) el.innerHTML = v; else el.textContent = v; }
  function typing(t) { return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))); }

  // Light HTML as the deck allows it. Browsers add <div> on Enter and <b>/<i> on shortcuts,
  // so blocks become line breaks, those tags get their semantic names, the rest unwraps.
  function sanitize(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== 1) continue;
        walk(child);
        const tag = child.tagName;
        if (RENAME[tag]) {
          const el = document.createElement(RENAME[tag]);
          while (child.firstChild) el.appendChild(child.firstChild);
          child.replaceWith(el);
        } else if (tag === "DIV" || tag === "P") {
          const frag = document.createDocumentFragment();
          if (child.previousSibling && !(child.previousSibling.nodeType === 1 && child.previousSibling.tagName === "BR")) frag.appendChild(document.createElement("br"));
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
        } else if (!ALLOWED[tag]) {
          const frag = document.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
        } else {
          for (const a of Array.from(child.attributes)) if (/^on/i.test(a.name) || (a.name === "href" && /^\s*javascript:/i.test(a.value))) child.removeAttribute(a.name);
        }
      }
    };
    walk(tpl.content);
    let out = tpl.innerHTML.replace(/&nbsp;/g, " ");
    while (/<br\s*\/?>\s*$/i.test(out)) out = out.replace(/<br\s*\/?>\s*$/i, "");
    return out;
  }

  root.RevealReview = function () {
    let deck, cfg = {}, slides = [], bar, panel, confirmEl, toastEl, on = false;
    let server = null, handle = null, toastTimer = 0, confirmAction = null;
    const edits = {};                 // key → { <field>: { from, to }, comment }
    const originals = new Map();      // element → the text as built
    let all = [];                     // every slide as built, in order: { key, el, hidden } (hidden ones leave the DOM at start-up)
    const ops = { hidden: {}, deleted: [], order: null };   // the overview's structural edits, by key
    const STORE = () => NS + ":" + location.pathname;
    const q = (el, sel) => el.querySelector(sel);

    // ── Edits ──────────────────────────────────────────────────────
    function count() {
      let n = 0, c = 0;
      for (const s of Object.values(edits)) for (const k of Object.keys(s)) k === "comment" ? c++ : n++;
      const d = Object.keys(ops.hidden).length + ops.deleted.length + (ops.order ? 1 : 0);
      return { n, c, d, any: n + c + d > 0 };
    }
    function opsOut() {   // the deck section of the file, or null when nothing structural is queued
      const o = {};
      if (Object.keys(ops.hidden).length) o.hidden = { ...ops.hidden };
      if (ops.deleted.length) o.deleted = ops.deleted.slice();
      if (ops.order) o.order = ops.order.slice();
      return Object.keys(o).length ? o : null;
    }
    function keyOf(el) { const s = el.closest("section[data-key]"); return s ? s.dataset.key : null; }
    function fieldEl(key, field) { return deck.getSlidesElement().querySelector(`section[data-key="${cssEscape(key)}"] [data-f="${cssEscape(field)}"]`); }
    function cssEscape(s) { return root.CSS && root.CSS.escape ? root.CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"); }
    function set(key, field, from, to) {
      const s = edits[key] || (edits[key] = {});
      if (to === from) delete s[field]; else s[field] = { from, to };
      if (!Object.keys(s).length) delete edits[key];
      persist();
      renderBar();
    }
    // `settle` writes the cleaned HTML back into the field; only on blur, since rewriting a
    // field while it's being typed in moves the caret and undoes a browser-inserted line break.
    function record(el, settle) {
      const key = keyOf(el);
      if (!key) return;
      let to = valueOf(el);
      if (isHtml(el)) { const clean = sanitize(to); if (settle && clean !== to) setValue(el, clean); to = clean; }
      set(key, el.dataset.f, originals.get(el), to);
      el.classList.toggle("rv-edited", to !== originals.get(el));
    }
    function persist() {
      try {
        const deck = opsOut();
        if (Object.keys(edits).length || deck) localStorage.setItem(STORE(), JSON.stringify({ built: cfg.built, slides: edits, deck }));
        else localStorage.removeItem(STORE());
      } catch (e) { /* storage blocked: the edits live in the page until saved */ }
    }
    function restore() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(STORE())); } catch (e) { saved = null; }
      if (!saved || !saved.slides) return;
      if (saved.built !== cfg.built) { try { localStorage.removeItem(STORE()); } catch (e) { /* ignore */ } console.warn("RevealReview: dropped a draft made on an earlier build of this deck."); return; }
      const known = new Set(all.map((s) => s.key));
      if (saved.deck) {
        for (const [k, v] of Object.entries(saved.deck.hidden || {})) if (known.has(k) && typeof v === "boolean") ops.hidden[k] = v;
        ops.deleted = (saved.deck.deleted || []).filter((k) => known.has(k));
        if (Array.isArray(saved.deck.order) && saved.deck.order.length === all.length && saved.deck.order.every((k) => known.has(k))) ops.order = saved.deck.order.slice();
      }
      for (const [key, fields] of Object.entries(saved.slides || {})) {
        for (const [field, v] of Object.entries(fields)) {
          if (field === "comment") { (edits[key] = edits[key] || {}).comment = v; continue; }
          const el = fieldEl(key, field);
          if (!el || originals.get(el) !== v.from) continue;   // the text changed under the draft
          setValue(el, v.to);
          el.classList.add("rv-edited");
          (edits[key] = edits[key] || {})[field] = v;
        }
      }
    }
    function payload() {
      const deck = opsOut();
      return JSON.stringify({ built: cfg.built, lane: cfg.lane || null, file: cfg.file || location.pathname.split("/").pop() || "index.html",
        saved: new Date().toISOString(), keys: all.map((s) => s.key), slides: edits, ...(deck ? { deck } : {}) }, null, 2) + "\n";
    }
    function discard() {
      for (const [el, from] of originals) { if (valueOf(el) !== from) setValue(el, from); el.classList.remove("rv-edited"); }
      for (const k of Object.keys(edits)) delete edits[k];
      for (const k of Object.keys(ops.hidden)) delete ops.hidden[k];
      ops.deleted = [];
      ops.order = null;
      persist();
      renderBar();
      renderPanel();
      applyLive();
      changed();
      toast("Edits dropped");
    }

    // ── The overview's structural edits (drawn by presenter.js through this API) ──
    function builtOrder() { return all.map((s) => s.key); }
    function pending() {   // every slide in the pending order, with its pending state
      const byKey = new Map(all.map((s) => [s.key, s]));
      return (ops.order || builtOrder()).map((key) => {
        const s = byKey.get(key);
        return { key, el: s.el, builtHidden: s.hidden, hidden: key in ops.hidden ? ops.hidden[key] : s.hidden, deleted: ops.deleted.includes(key) };
      });
    }
    // A lane overlay addresses slides by their own `key`; a slide with a positional key can't be
    // hidden from a lane. Refuse, and say what to do.
    function laneNeedsKey(key) {
      const s = all.find((x) => x.key === key);
      if (!cfg.lane || !s || !s.el.hasAttribute("data-key-auto")) return false;
      const n = all.indexOf(s) + 1;
      showConfirm(`<h2>Slide ${n} has no key</h2><p>A lane hides or deletes a slide through its overlay, which names slides by their own <code>key</code>, and slide ${n} has none in slides.js. Add <code>key: "…"</code> to that slide (or ask Claude to key the slides), rebuild, then try again. Reordering still works, and so does hiding it in the base deck.</p>`,
        [["cancel", "Close", "esc"]], null);
      return true;
    }
    // Make the live deck match the pending state: the sections Reveal shows are the pending
    // order minus hidden and deleted ones, re-appended in that order, then Reveal re-synced and
    // kept on the same slide. The built order comes back the same way (discard), and the source
    // is rewritten at the rebuild.
    function applyLive() {
      const stage = deck.getSlidesElement(), current = deck.getCurrentSlide();
      const keep = pending().filter((s) => !s.deleted && !s.hidden).map((s) => s.el);
      for (const s of all) { if (s.el.parentNode === stage) stage.removeChild(s.el); }
      for (const el of keep) { el.removeAttribute("data-visibility"); stage.appendChild(el); }
      for (const s of all) if (!keep.includes(s.el)) s.el.setAttribute("data-visibility", "hidden");
      deck.sync();
      const at = keep.indexOf(current);
      deck.slide(at >= 0 ? at : Math.min(deck.getIndices().h, Math.max(keep.length - 1, 0)));
    }
    function mutated(key) { persist(); renderBar(); applyLive(); changed(key); }
    const api = {
      lane: () => cfg.lane || null,
      slides: pending,
      setHidden(key, hidden) {
        const s = all.find((x) => x.key === key);
        if (!s) return false;
        if (laneNeedsKey(key)) return false;
        if (hidden === s.hidden) delete ops.hidden[key]; else ops.hidden[key] = hidden;
        mutated(key);
        return true;
      },
      setDeleted(key, deleted) {
        if (deleted && laneNeedsKey(key)) return false;
        ops.deleted = ops.deleted.filter((k) => k !== key);
        if (deleted) ops.deleted.push(key);
        mutated(key);
        return true;
      },
      reorder(keys) {
        const built = builtOrder();
        if (keys.length !== built.length || new Set(keys).size !== built.length || keys.some((k) => !built.includes(k))) return;
        ops.order = keys.join("\n") === built.join("\n") ? null : keys.slice();
        mutated(keys.find((k, i) => (ops.order || built)[i] !== built[i]) || null);
      },
      queued: () => count().any,
      rebuild: askRebuild,
    };

    // ── Saving ─────────────────────────────────────────────────────
    async function detectServer() {
      if (!/^https?:$/.test(location.protocol)) return;
      try {
        const r = await fetch("/__status", { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (j && j.slideware) server = j;
      } catch (e) { server = null; }
    }
    async function save(quiet) {
      if (!count().any) { if (!quiet) toast("Nothing to save"); return true; }
      const json = payload();
      try {
        if (server) {
          const r = await fetch("/__edits", { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok) throw new Error(j.error || r.statusText);
          if (!quiet) toast(`Saved ${j.path || "edits.json"}`);
          return true;
        }
        if (root.showSaveFilePicker) {
          if (!handle) handle = await root.showSaveFilePicker({ suggestedName: "edits.json", types: [{ description: "Deck edits", accept: { "application/json": [".json"] } }] });
          const w = await handle.createWritable();
          await w.write(json);
          await w.close();
          if (!quiet) toast(`Saved ${handle.name}. The next build folds it into slides.js.`);
          return true;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = "edits.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        if (!quiet) toast("Downloaded edits.json. Move it next to the deck; the next build folds it in.");
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
        toast("Save failed: " + (e && e.message ? e.message : e));
        return false;
      }
    }
    async function copy() {
      try { await navigator.clipboard.writeText(payload()); toast("Edits copied as JSON"); }
      catch (e) { toast("Copy failed: " + (e && e.message ? e.message : e)); }
    }

    // ── Rebuild (shift+b) ──────────────────────────────────────────
    function askRebuild() {
      const { n, c, d } = count();
      const what = [n ? `${n} edit${n === 1 ? "" : "s"}` : "", c ? `${c} comment${c === 1 ? "" : "s"}` : "", d ? `${d} slide change${d === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ") || "no edits";
      if (server) {
        showConfirm(`<h2>Rebuild the deck?</h2><p>Saves ${what} to edits.json, folds them into slides.js, runs <code>node build-deck.js .</code> and reloads this page on the same slide.</p>`,
          [["go", "Rebuild", "enter"], ["cancel", "Cancel", "esc"]], doRebuild);
      } else {
        showConfirm(`<h2>No local server to rebuild with</h2><p>shift+b rebuilds through <code>serve-deck.js</code> (in the slideware skill's <code>html/scripts/</code> folder). Start it in the deck folder, then open the address it prints:</p>
<pre>node &lt;plugin&gt;/skills/slideware/html/scripts/serve-deck.js .</pre><p>For now, save ${what} as edits.json next to the deck and run <code>node build-deck.js .</code>, or ask Claude to apply your edits.</p>`,
          [["save", "Save edits.json", "enter"], ["cancel", "Close", "esc"]], () => { closeConfirm(); save(); });
      }
    }
    async function doRebuild() {
      setConfirmBusy("Saving and rebuilding…");
      if (!(await save(true))) { closeConfirm(); return; }
      try {
        // The deck was built with review mode (this code is running), so the rebuild keeps it.
        const r = await fetch("/__build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review: true }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          showConfirm(`<h2>The build failed</h2><pre>${esc((j.output || j.error || r.statusText || "").trim() || "no output")}</pre><p>Fix slides.js (or ask Claude to), then press shift+b again.</p>`,
            [["cancel", "Close", "esc"]], null);
          return;
        }
        try { localStorage.removeItem(STORE()); } catch (e) { /* ignore */ }
        setConfirmBusy("Rebuilt. Reloading…\n\n" + (j.output || "").trim());
        setTimeout(() => location.reload(), 400);
      } catch (e) {
        showConfirm(`<h2>Couldn't reach the server</h2><p>${esc(e && e.message ? e.message : String(e))}. Is serve-deck.js still running?</p>`, [["cancel", "Close", "esc"]], null);
      }
    }
    function showConfirm(html, buttons, go) {
      confirmAction = go;
      confirmEl.innerHTML = html + '<div class="rv-actions">' + buttons.map(([act, label, key]) => `<button type="button" data-rv="${act}">${label}${key ? `<kbd>${key}</kbd>` : ""}</button>`).join("") + "</div>";
      confirmEl.classList.add("rv-show");
      const first = q(confirmEl, "button[data-rv=go], button[data-rv=save], button");
      if (first) first.focus();
    }
    function setConfirmBusy(text) { confirmEl.innerHTML = `<pre>${esc(text)}</pre>`; confirmAction = null; }
    function closeConfirm() { confirmEl.classList.remove("rv-show"); confirmEl.innerHTML = ""; confirmAction = null; }
    function confirmOpen() { return confirmEl.classList.contains("rv-show"); }

    // ── UI ─────────────────────────────────────────────────────────
    function toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add("rv-show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("rv-show"), 3200);
    }
    function renderBar() {
      const { n, c, d } = count();
      q(bar, ".rv-count").textContent = [n ? `${n} edit${n === 1 ? "" : "s"}` : d ? "" : "no edits", c ? `${c} comment${c === 1 ? "" : "s"}` : "", d ? `${d} slide change${d === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
      document.documentElement.classList.toggle("rv-queued", count().any);
    }
    function current() { return deck.getCurrentSlide(); }
    function renderPanel() {
      if (!on) return;
      const slide = current(), key = slide && slide.dataset.key;
      const aside = slide && slide.querySelector('aside[data-f="notes"]');
      const e = (key && edits[key]) || {};
      const h = slide && slide.querySelector("h1, h2, h3");
      q(panel, ".rv-panel-num").textContent = String(slides.indexOf(slide) + 1).padStart(2, "0") + " / " + slides.length;
      q(panel, ".rv-panel-title").textContent = h ? h.textContent.replace(/\s+/g, " ").trim() : "";
      q(panel, ".rv-notes").value = e.notes ? e.notes.to : aside ? aside.textContent : "";
      q(panel, ".rv-comment").value = e.comment || "";
    }
    function onNotesInput() {
      const slide = current(), key = slide && slide.dataset.key;
      if (!key) return;
      let aside = slide.querySelector('aside[data-f="notes"]');
      if (!aside) {   // a slide without notes gets an empty aside, so the edit has a place to live
        aside = document.createElement("aside");
        aside.className = "notes";
        aside.setAttribute("data-f", "notes");
        slide.appendChild(aside);
        originals.set(aside, "");
      }
      const to = q(panel, ".rv-notes").value;
      aside.textContent = to;
      set(key, "notes", originals.get(aside), to);
    }
    function onCommentInput() {
      const slide = current(), key = slide && slide.dataset.key;
      if (!key) return;
      const v = q(panel, ".rv-comment").value.trim();
      const s = edits[key] || (edits[key] = {});
      if (v) s.comment = v; else delete s.comment;
      if (!Object.keys(s).length) delete edits[key];
      persist();
      renderBar();
    }
    let stale = false;   // the deck's slides carry no keys: built before review mode, or hand-written
    function staleDeck() {
      showConfirm(`<h2>Rebuild this deck first</h2><p>Its slides carry no keys, so review mode has nothing to address: it was built before review mode, or by hand. Run <code>node build-deck.js . --review</code> in the deck folder (or ask Claude to rebuild the deck), then reload.</p>`,
        [["cancel", "Close", "esc"]], null);
    }
    function toggle() {
      if (stale) { staleDeck(); return; }
      on = !on;
      document.documentElement.classList.toggle("rv-on", on);
      for (const el of originals.keys()) {
        if (el.tagName === "ASIDE") continue;
        if (on) el.setAttribute("contenteditable", isHtml(el) ? "true" : "plaintext-only");
        else el.removeAttribute("contenteditable");
      }
      if (on) { renderBar(); renderPanel(); } else if (document.activeElement && typing(document.activeElement)) document.activeElement.blur();
      // The deck gives up the panel's height while editing; afterwards the presenter's drawer reclaims its own.
      if (on) document.documentElement.style.setProperty("--rp-reserve-bottom", panel.offsetHeight + "px");
      else document.documentElement.style.removeProperty("--rp-reserve-bottom");
      deck.layout();
      if (!on) document.dispatchEvent(new CustomEvent("rp-reserve-recompute"));
      changed();   // the overview's tools appear and disappear with the mode
    }
    function build() {
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
      bar = document.createElement("div"); bar.className = "rv-bar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Review mode"); bar.innerHTML = BAR_HTML;
      panel = document.createElement("div"); panel.className = "rv-panel"; panel.innerHTML = PANEL_HTML;
      confirmEl = document.createElement("div"); confirmEl.className = "rv-confirm"; confirmEl.setAttribute("role", "dialog");
      toastEl = document.createElement("div"); toastEl.className = "rv-toast"; toastEl.setAttribute("aria-live", "polite");
      document.body.append(bar, panel, confirmEl, toastEl);
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-rv]");
        if (!b) return;
        b.blur();
        const act = b.dataset.rv;
        if (act === "save") save(); else if (act === "copy") copy(); else if (act === "build") askRebuild();
        else if (act === "discard") discard(); else if (act === "done") toggle();
      });
      confirmEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-rv]");
        if (!b) return;
        if (b.dataset.rv === "cancel") closeConfirm(); else if (confirmAction) confirmAction();
      });
      q(panel, ".rv-notes").addEventListener("input", onNotesInput);
      q(panel, ".rv-comment").addEventListener("input", onCommentInput);
      const stage = deck.getSlidesElement();
      stage.addEventListener("input", (e) => { const el = e.target.closest && e.target.closest("[data-f]"); if (el && on) record(el, false); });
      stage.addEventListener("focusout", (e) => { const el = e.target.closest && e.target.closest("[data-f]"); if (el && on) record(el, true); });
      stage.addEventListener("keydown", (e) => {
        const el = e.target.closest && e.target.closest("[data-f]");
        if (!el || !on) return;
        if (e.key === "Escape" || (e.key === "Enter" && !isHtml(el))) { e.preventDefault(); el.blur(); }
        e.stopPropagation();   // Reveal ignores keys in editable fields, and so should the presenter's bindings
      });
      // shift+b before Reveal sees it (B alone stays its blackout); Enter / Esc drive the confirm bar.
      window.addEventListener("keydown", (e) => {
        if (confirmOpen()) {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeConfirm(); }
          else if (e.key === "Enter" && confirmAction) { e.preventDefault(); e.stopPropagation(); confirmAction(); }
          return;
        }
        if (typing(e.target)) { if (e.key === "Escape" && !e.target.closest("[data-f]")) e.target.blur(); return; }
        if (e.key === "B" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); askRebuild(); }
      }, true);
    }

    function onReady() {
      slides = Array.from(deck.getSlidesElement().querySelectorAll("section")).filter((s) => !s.querySelector("section"));
      if (stale) { staleDeck(); return; }
      for (const el of deck.getSlidesElement().querySelectorAll("section[data-key] [data-f]")) originals.set(el, valueOf(el));
      restore();
      if (opsOut()) applyLive();   // the draft's hidden, deleted and reordered slides, as the deck
      renderBar();
      deck.on("slidechanged", renderPanel);
      detectServer();
      document.addEventListener("rp-review-toggle", toggle);   // the overview's Edit button and its e key
      changed();   // an overview opened before the draft was restored redraws
    }
    function changed(key) { document.dispatchEvent(new CustomEvent("rp-review-change", { detail: { key: key || null } })); }

    function init(reveal) {
      deck = reveal;
      if (/print-pdf/i.test(location.search) || /[?&]presenter(?:[=&]|$)/.test(location.search)) return;
      cfg = deck.getConfig().review || {};
      // Every section as built, before Reveal drops the hidden ones at start-up: the overview
      // draws hidden slides from these elements, which stay usable once detached.
      const sections = Array.from(deck.getSlidesElement().querySelectorAll("section")).filter((s) => !s.querySelector("section"));
      all = sections.filter((el) => el.dataset.key).map((el) => ({ key: el.dataset.key, el, hidden: el.getAttribute("data-visibility") === "hidden" }));
      stale = sections.length > 0 && all.length < sections.length;
      if (!stale) root.RevealReviewAPI = api;   // before the presenter's overview can fill (?overview opens it at ready)
      build();
      deck.addKeyBinding({ keyCode: 69, key: "E", description: "Review mode: edit text and notes" }, toggle);
      if (deck.isReady()) onReady(); else deck.on("ready", onReady);
    }

    return { id: "review", init };
  };
})(window);
