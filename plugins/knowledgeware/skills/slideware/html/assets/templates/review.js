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
//   Shift+B  rebuild the deck: a confirm bar, then (through serve-deck.js) the edits are saved,
//            `node build-deck.js .` runs, and the page reloads on the same slide. Over file://
//            or a plain static server there is nothing to run, so the bar says how to save.
//
// The overview (O) gains structural edits while review mode is on: an eye on each thumbnail
// hides or shows the slide (in the lane being viewed), an X deletes it (Undo brings it back),
// thumbnails drag and drop into a new order, and a Rebuild deck button beside Close turns solid
// when anything is queued. Keys on a focused thumbnail: H, Del, Shift+arrows. Every such edit is
// applied to the live deck at once (applyLive: sections re-appended in the pending order, hidden
// and deleted ones detached, Reveal re-synced), so the deck and the overview agree; slides.js
// catches up at the rebuild. presenter.js draws the overview through window.RevealReviewAPI,
// which this plugin provides, and learns of changes through the rp-review-change event.
//
// Layout mode (L, inside review mode) edits the shape of a slide within what its layout allows:
// blocks the builder marked (data-b) get dotted outlines by kind (blocks muted ink, list and card
// items green, media the second accent; text fields keep the accent); a click selects; dragging
// nudges a block or media (--dx / --dy, written as the slide's `tweaks`) and reorders a card or
// bullet among its siblings (the slide's `arrays`); Del removes a card or bullet; the panel holds
// the slide's knobs (gap, padding, the column ratio, the image's scale) and the selection's nudge
// and size. Everything applies live and records a delta against the built value. The text
// formatter is a small bar over a focused light-HTML field: bold, italic, code, link, clear,
// colour (the brand's roles) and size.
//
// Edits live in this browser (localStorage, per deck file and per build) until saved, so a
// closed tab loses nothing; a draft from an older build is dropped, since its text may be gone.
// How edits reach disk, in order of preference:
//   1. The connected deck folder (Chrome's directory picker, once per deck; the handle is kept
//      in IndexedDB and needs one "Allow" click per browser session). Then edits.json saves
//      itself after every change, and the page reloads on the same slide when a rebuild lands
//      (it watches its own file's modification time), so "Claude, rebuild the deck" is the loop.
//   2. serve-deck.js, when the deck is served by it: Save posts edits.json, Shift+B rebuilds.
//   3. The browser's save dialog, then a download, and Copy for the clipboard.
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
.rv-bar .rv-folder { color: ${MUTED}; margin: 0 6px 0 2px; }
.rv-bar .rv-folder:empty { display: none; }
.rv-bar button[data-rv=folder] { color: ${ACCENT}; font-weight: 600; }
.rv-bar button[data-rv=folder][hidden] { display: none; }
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
/* Layout mode: blocks by kind, the selection solid, handles on what resizes. */
html.rv-layout .reveal [data-f]:not(aside) { cursor: default; outline-color: color-mix(in srgb, ${ACCENT} 30%, transparent); }
html.rv-layout .reveal [data-b] { cursor: grab; outline: 1px dotted color-mix(in srgb, ${MUTED} 70%, transparent); outline-offset: 4px; }
html.rv-layout .reveal [data-bk=item] { outline-color: color-mix(in srgb, var(--color-success, #3F8A4F) 75%, transparent); }
html.rv-layout .reveal [data-bk=media] { outline-color: color-mix(in srgb, var(--color-accent2, ${ACCENT}) 80%, transparent); }
html.rv-layout .reveal [data-b]:hover { outline-style: dashed; }
html.rv-layout .reveal [data-b].rv-selected { outline: 2px solid ${ACCENT}; outline-offset: 4px; cursor: move; }
html.rv-layout .reveal [data-bk=item].rv-selected { cursor: grab; }
html.rv-layout .reveal [data-b].rv-dragging { opacity: .6; }
html.rv-layout .reveal [data-b].rv-drop-before { box-shadow: -6px 0 0 -3px var(--color-success, #3F8A4F); }
html.rv-layout .reveal [data-b].rv-drop-after { box-shadow: 6px 0 0 -3px var(--color-success, #3F8A4F); }
.rv-handle { position: fixed; z-index: 47; width: 14px; height: 14px; border-radius: 3px; background: ${ACCENT}; border: 2px solid var(--color-bg, #FFFFFF); box-shadow: 0 1px 4px rgba(0,0,0,.3); cursor: nwse-resize; display: none; }
.rv-handle.rv-show { display: block; }
.rv-gutter { position: fixed; z-index: 47; width: 10px; border-radius: 5px; background: color-mix(in srgb, ${ACCENT} 85%, transparent); cursor: col-resize; display: none; }
.rv-gutter.rv-show { display: block; }
html.rv-layout .rv-panel .rv-notes, html.rv-layout .rv-panel .rv-comment, html.rv-layout .rv-panel .rv-panel-head { display: none; }
.rv-layout-panel { display: none; grid-template-columns: 1fr 1fr; gap: 10px 28px; align-content: start; overflow: auto; }
html.rv-layout .rv-panel { grid-template-rows: minmax(0, 1fr); }
html.rv-layout .rv-layout-panel { display: grid; }
.rv-layout-panel h3 { grid-column: 1 / -1; margin: 0; font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rv-layout-panel h3 span { color: ${MUTED}; letter-spacing: 0; text-transform: none; font-family: ${SANS}; font-size: 12px; margin-left: 10px; }
.rv-layout-panel label { display: grid; grid-template-columns: 90px 1fr 52px auto; align-items: center; gap: 10px; font-size: 13px; color: ${INK}; }
.rv-layout-panel input[type=range] { width: 100%; accent-color: ${ACCENT}; }
.rv-layout-panel output { font-family: ${MONO}; font-size: 12px; color: ${MUTED}; text-align: right; }
.rv-layout-panel button { all: unset; cursor: pointer; padding: 4px 9px; border-radius: 6px; font-size: 12px; color: ${INK}; border: 1px solid ${BORDER}; background: var(--color-surface, #FFFFFF); }
.rv-layout-panel button:hover { border-color: ${ACCENT}; color: ${ACCENT}; }
.rv-layout-panel button[data-lp=delete] { color: var(--color-error, #B42318); }
.rv-layout-panel .rv-lp-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.rv-layout-panel .rv-lp-hint { grid-column: 1 / -1; color: ${MUTED}; font-size: 12px; }
/* The text formatter, over a focused light-HTML field. */
.rv-fmt { position: fixed; z-index: 47; display: none; align-items: center; gap: 2px; padding: 4px; border-radius: 10px; border: 1px solid ${BORDER}; background: ${SURFACE};
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 8px 30px rgba(0, 0, 0, .18); font-family: ${SANS}; font-size: 12px; color: ${INK}; }
.rv-fmt.rv-show { display: flex; }
.rv-fmt button, .rv-fmt select { all: unset; cursor: pointer; height: 26px; min-width: 26px; padding: 0 7px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: ${INK}; }
.rv-fmt button:hover, .rv-fmt select:hover { background: color-mix(in srgb, ${INK} 8%, transparent); }
.rv-fmt button[data-fmt=bold] { font-weight: 700; }
.rv-fmt button[data-fmt=italic] { font-style: italic; }
.rv-fmt button[data-fmt=code] { font-family: ${MONO}; font-size: 11px; }
.rv-fmt .rv-fmt-sep { width: 1px; height: 16px; background: ${BORDER}; margin: 0 3px; }
.rv-fmt select { font-size: 12px; appearance: auto; -webkit-appearance: menulist; padding-right: 2px; }
.rv-fmt input { all: unset; width: 180px; padding: 0 8px; height: 26px; font-size: 12px; border-radius: 6px; border: 1px solid ${BORDER}; background: var(--color-surface, #FFFFFF); color: ${INK}; }
.rv-fmt .rv-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; border: 1px solid ${BORDER}; vertical-align: -2px; }
html.rv-on .reveal [data-f]:hover { outline-color: ${ACCENT}; }
html.rv-on .reveal [data-f]:focus { outline: 2px solid ${ACCENT}; background: color-mix(in srgb, ${ACCENT} 6%, transparent); }
html.rv-on .reveal [data-f].rv-edited { outline-style: solid; outline-color: color-mix(in srgb, ${ACCENT} 70%, transparent); }
html.rv-on .reveal [data-a] { animation: none !important; }   /* nothing moves under the caret */
html.rv-on body > .reveal { height: calc(100% - var(--rp-reserve-bottom, 0px)); }   /* the deck re-fits above the panel (presenter.js declares the same rule) */
@media print { .rv-bar, .rv-panel, .rv-confirm, .rv-toast { display: none !important; } }
`;

  const BAR_HTML = `<span class="rv-label">Review</span><span class="rv-count"></span>
<span class="rv-folder"></span><button type="button" data-rv="folder" title="Connect the deck folder once: edits then save themselves and the page reloads when a rebuild lands">Connect folder</button>
<button type="button" data-rv="save" title="Save edits.json">Save</button>
<button type="button" data-rv="copy" title="Copy the edits as JSON">Copy</button>
<button type="button" data-rv="build" title="Save, rebuild the deck and reload (Shift+B)">Rebuild<kbd>Shift+B</kbd></button>
<button type="button" data-rv="discard" title="Drop every unsaved edit">Discard</button>
<button type="button" data-rv="layout" title="Layout mode: select, move, resize, delete and reorder blocks (L)">Layout<kbd>L</kbd></button>
<button type="button" data-rv="done" title="Leave review mode (E)">Done<kbd>E</kbd></button>`;
  const FMT_HTML = `<button type="button" data-fmt="bold" title="Bold (Cmd+B)">B</button><button type="button" data-fmt="italic" title="Italic (Cmd+I)">I</button><button type="button" data-fmt="code" title="Code">&lt;/&gt;</button><button type="button" data-fmt="link" title="Link (Cmd+K)">Link</button><span class="rv-fmt-sep"></span>
<select data-fmt="color" title="Text colour, from the brand's roles"><option value="">Colour</option><option value="accent">Accent</option><option value="accent2">Accent 2</option><option value="ink">Ink</option><option value="ink-muted">Muted</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option><option value="none">Default</option></select>
<select data-fmt="size" title="Text size"><option value="">Size</option><option value="0.85em">Small</option><option value="1em">Normal</option><option value="1.15em">Large</option><option value="1.3em">Larger</option></select><span class="rv-fmt-sep"></span><button type="button" data-fmt="clear" title="Clear formatting">Clear</button>`;
  const PANEL_HTML = `<div class="rv-panel-head"><span class="rv-panel-num"></span><span>Speaker notes</span><span class="rv-panel-title"></span></div>
<textarea class="rv-notes" aria-label="Speaker notes" placeholder="Notes for this slide. A blank line splits paragraphs, lines starting with - form a list, **bold**, *italic*, [pause]."></textarea>
<input class="rv-comment" aria-label="Comment" placeholder="Comment for whoever edits the deck next (optional)"/>
<div class="rv-layout-panel"></div>`;

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
    let folder = null, folderState = "none", saveTimer = 0, lastSaved = null, watchTimer = 0, builtStamp = null;   // the connected deck folder
    const edits = {};                 // key → { <field>: { from, to }, comment }
    const layoutEdits = {};           // key → { knobs: { name: { from, to } }, tweaks: { from, to }, arrays: { name: [kept original indices] } }
    const builtLayout = new Map();    // key → { knobs: { name: value | null }, tweaks: object | null, arrays: { name: count } } as built
    let layout = false, selected = null, sizeHandle, gutter, fmt;   // layout mode, its selection and its handles; the formatter bar
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
      let l = 0;
      for (const o of Object.values(layoutEdits)) l += Object.keys(o.knobs || {}).length + (o.tweaks ? 1 : 0) + Object.keys(o.arrays || {}).length;
      return { n, c, d, l, any: n + c + d + l > 0 };
    }
    function slidesOut() {   // the per-slide section of the file: text edits, comments and layout edits together
      const out = JSON.parse(JSON.stringify(edits));
      for (const [k, o] of Object.entries(layoutEdits)) Object.assign(out[k] = out[k] || {}, JSON.parse(JSON.stringify(o)));
      return out;
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
        if (Object.keys(edits).length || Object.keys(layoutEdits).length || deck) localStorage.setItem(STORE(), JSON.stringify({ built: cfg.built, slides: slidesOut(), deck }));
        else localStorage.removeItem(STORE());
      } catch (e) { /* storage blocked: the edits live in the page until saved */ }
      scheduleSave();
    }

    // ── The connected deck folder ──────────────────────────────────
    const FOLDER_DB = NS + ":folders", FOLDER_KEY = () => location.pathname;
    function idb() {
      return new Promise((res, rej) => {
        const r = indexedDB.open(FOLDER_DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore("handles");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("handles").objectStore("handles").get(key); t.onsuccess = () => res(t.result || null); t.onerror = () => rej(t.error); }); }
    async function idbSet(key, val) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("handles", "readwrite").objectStore("handles").put(val, key); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
    const canPick = () => typeof root.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";
    const reviewFile = () => cfg.file || location.pathname.split("/").pop() || "index.review.html";
    async function hasFile(h, name) { try { await h.getFileHandle(name); return true; } catch (e) { return false; } }
    async function readJson(h, name) { try { return JSON.parse(await (await (await h.getFileHandle(name)).getFile()).text()); } catch (e) { return null; } }
    async function reviewMtime() { try { return (await (await folder.getFileHandle(reviewFile())).getFile()).lastModified; } catch (e) { return null; } }
    async function connectFolder() {   // from a click: the picker needs a user gesture
      if (!canPick()) { toast("This browser can't connect a folder: use Save, or serve the deck with serve-deck.js"); return; }
      try {
        const h = await root.showDirectoryPicker({ mode: "readwrite", id: "slideware-deck" });
        if (!(await hasFile(h, "slides.js")) || !(await hasFile(h, reviewFile()))) {
          showConfirm(`<h2>That isn't this deck's folder</h2><p>Pick the folder that holds <code>slides.js</code> and <code>${esc(reviewFile())}</code>.</p>`, [["cancel", "Close", "Esc"]], null);
          return;
        }
        folder = h; folderState = "ok";
        try { await idbSet(FOLDER_KEY(), h); } catch (e) { /* not remembered; still connected for this page */ }
        await startWatch();
        scheduleSave(0);
        renderBar();
        toast("Deck folder connected: edits save themselves, and the page reloads when a rebuild lands");
      } catch (e) { if (!e || e.name !== "AbortError") toast("Couldn't connect the folder: " + (e && e.message ? e.message : e)); }
    }
    async function restoreFolder() {   // on load: the handle survives, the permission may need a click
      if (!canPick()) { folderState = "unsupported"; renderBar(); return; }
      let h = null;
      try { h = await idbGet(FOLDER_KEY()); } catch (e) { h = null; }
      if (!h) { folderState = "none"; renderBar(); return; }
      folder = h;
      let perm = "prompt";
      try { perm = await h.queryPermission({ mode: "readwrite" }); } catch (e) { perm = "prompt"; }
      folderState = perm === "granted" ? "ok" : "prompt";
      if (folderState === "ok") { await startWatch(); scheduleSave(0); }
      renderBar();
    }
    async function allowFolder() {   // from a click
      if (!folder) return connectFolder();
      let perm = "denied";
      try { perm = await folder.requestPermission({ mode: "readwrite" }); } catch (e) { perm = "denied"; }
      if (perm !== "granted") { toast("Folder access wasn't granted; edits stay in this browser until you Save"); return; }
      folderState = "ok";
      await startWatch();
      scheduleSave(0);
      renderBar();
      toast("Folder access restored");
    }
    async function startWatch() {   // reload when a rebuild replaces this page's file
      if (watchTimer) return;
      builtStamp = await reviewMtime();
      watchTimer = setInterval(async () => {
        if (await buildChanged()) { clearInterval(watchTimer); watchTimer = 0; toast("Rebuilt: reloading"); setTimeout(() => location.reload(), 300); }
      }, 1500);
    }
    async function buildChanged() { const m = await reviewMtime(); return !!(m && builtStamp && m !== builtStamp); }
    function scheduleSave(delay = 600) { if (folderState !== "ok") return; clearTimeout(saveTimer); saveTimer = setTimeout(writeEdits, delay); }
    // Write edits.json into the folder. Never over a newer build (reload instead), and never
    // over another build's leftovers without keeping them: comments and unfoldable edits the
    // build left for Claude stay in the file beside this page's edits.
    async function writeEdits() {
      if (folderState !== "ok") return false;
      try {
        if (await buildChanged()) { location.reload(); return false; }
        const existing = await readJson(folder, "edits.json");
        const ours = existing && existing.built === cfg.built;
        if (!count().any) {
          if (ours) { try { await folder.removeEntry("edits.json"); } catch (e) { /* already gone */ } }
          lastSaved = new Date(); renderBar();
          return true;
        }
        let out = JSON.parse(payload());
        if (existing && !ours && existing.slides) {   // another build's leftovers: keep them under ours
          const merged = { ...existing.slides };
          for (const [k, v] of Object.entries(out.slides)) merged[k] = { ...(merged[k] || {}), ...v };
          out = { ...out, slides: merged, ...(existing.deck && !out.deck ? { deck: existing.deck } : {}) };
        }
        const fh = await folder.getFileHandle("edits.json", { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(out, null, 2) + "\n");
        await w.close();
        lastSaved = new Date(); renderBar();
        return true;
      } catch (e) { toast("Autosave failed: " + (e && e.message ? e.message : e)); return false; }
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
          if (field === "knobs" || field === "tweaks" || field === "arrays") { if (known.has(key)) { (layoutEdits[key] = layoutEdits[key] || {})[field] = v; applyLayoutLive(key); } continue; }
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
        saved: new Date().toISOString(), keys: all.map((s) => s.key), slides: slidesOut(), ...(deck ? { deck } : {}) }, null, 2) + "\n";
    }
    function discard() {
      for (const [el, from] of originals) { if (valueOf(el) !== from) setValue(el, from); el.classList.remove("rv-edited"); }
      for (const k of Object.keys(edits)) delete edits[k];
      for (const k of Object.keys(layoutEdits)) { delete layoutEdits[k]; applyLayoutLive(k); }
      select(null);
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
        [["cancel", "Close", "Esc"]], null);
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
        if (folderState === "ok") {
          clearTimeout(saveTimer);
          const ok = await writeEdits();
          if (ok && !quiet) toast("Saved edits.json in the deck folder");
          return ok;
        }
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

    // ── Rebuild (Shift+B) ──────────────────────────────────────────
    function askRebuild() {
      const { n, c, d } = count();
      const { l } = count();
      const what = [n ? `${n} edit${n === 1 ? "" : "s"}` : "", c ? `${c} comment${c === 1 ? "" : "s"}` : "", d ? `${d} slide change${d === 1 ? "" : "s"}` : "", l ? `${l} layout change${l === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ") || "no edits";
      if (!server && folderState === "ok") {
        showConfirm(`<h2>Ask Claude to rebuild</h2><p>${what.charAt(0).toUpperCase() + what.slice(1)} ${n + c + d + l === 1 ? "is" : "are"} saved in <code>edits.json</code>. Say "rebuild the deck"; every build folds the file into slides.js, and this page reloads on the same slide when the new build lands. For a one-key rebuild, serve the deck with <code>serve-deck.js</code> and press Shift+B there.</p>`,
          [["cancel", "Close", "Esc"]], null);
        return;
      }
      if (server) {
        showConfirm(`<h2>Rebuild the deck?</h2><p>Saves ${what} to edits.json, folds them into slides.js, runs <code>node build-deck.js .</code> and reloads this page on the same slide.</p>`,
          [["go", "Rebuild", "Enter"], ["cancel", "Cancel", "Esc"]], doRebuild);
      } else {
        showConfirm(`<h2>No local server to rebuild with</h2><p>Shift+B rebuilds through <code>serve-deck.js</code> (in the slideware skill's <code>html/scripts/</code> folder). Start it in the deck folder, then open the address it prints:</p>
<pre>node &lt;plugin&gt;/skills/slideware/html/scripts/serve-deck.js .</pre><p>Or connect the deck folder (the button in the review bar): edits then save themselves and this page reloads when Claude rebuilds. For now, save ${what} as edits.json next to the deck and run <code>node build-deck.js .</code>, or ask Claude to apply your edits.</p>`,
          [["save", "Save edits.json", "Enter"], ["cancel", "Close", "Esc"]], () => { closeConfirm(); save(); });
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
          showConfirm(`<h2>The build failed</h2><pre>${esc((j.output || j.error || r.statusText || "").trim() || "no output")}</pre><p>Fix slides.js (or ask Claude to), then press Shift+B again.</p>`,
            [["cancel", "Close", "Esc"]], null);
          return;
        }
        try { localStorage.removeItem(STORE()); } catch (e) { /* ignore */ }
        setConfirmBusy("Rebuilt. Reloading…\n\n" + (j.output || "").trim());
        setTimeout(() => location.reload(), 400);
      } catch (e) {
        showConfirm(`<h2>Couldn't reach the server</h2><p>${esc(e && e.message ? e.message : String(e))}. Is serve-deck.js still running?</p>`, [["cancel", "Close", "Esc"]], null);
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
      const { l } = count();
      q(bar, ".rv-count").textContent = [n ? `${n} edit${n === 1 ? "" : "s"}` : d || l ? "" : "no edits", c ? `${c} comment${c === 1 ? "" : "s"}` : "", d ? `${d} slide change${d === 1 ? "" : "s"}` : "", l ? `${l} layout change${l === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
      document.documentElement.classList.toggle("rv-queued", count().any);
      const fb = q(bar, "button[data-rv=folder]"), fs = q(bar, ".rv-folder"), sv = q(bar, "button[data-rv=save]");
      fb.hidden = folderState === "ok" || folderState === "unsupported";
      fb.textContent = folderState === "prompt" ? "Allow folder access" : "Connect folder";
      fs.textContent = folderState === "ok" ? "Folder connected" + (lastSaved ? " · autosaved " + lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "")
        : folderState === "prompt" ? "Edits stay in this browser until you allow folder access" : "";
      sv.textContent = folderState === "ok" ? "Save now" : "Save";
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
        [["cancel", "Close", "Esc"]], null);
    }
    // ── Layout mode ────────────────────────────────────────────────
    const KNOB_DEFS = {   // what each knob means, its range, and which layouts have it
      gap:   { label: "Gap",       min: 0,  max: 80,  unit: "px", layouts: ["layout-two-column", "layout-card-row", "layout-bullets"] },
      pad:   { label: "Padding",   min: 0,  max: 120, unit: "px", layouts: null },
      ratio: { label: "Columns",   min: 20, max: 80,  unit: "%",  layouts: ["layout-two-column"] },
      scale: { label: "Image",     min: 20, max: 100, unit: "%",  layouts: ["layout-image-caption"] },
    };
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    function readKnobs(sec) {   // the section's current knob values, from its custom properties
      const st = sec.style;
      const ratio = st.getPropertyValue("--ratio").trim();
      return { gap: num(st.getPropertyValue("--gap")), pad: num(st.getPropertyValue("--pad")), scale: num(st.getPropertyValue("--scale")),
        ratio: ratio ? ratio.replace(/fr/g, "").trim().split(/\s+/).join("/") : null };
    }
    function readTweak(el) {
      const t = {};
      for (const k of ["dx", "dy", "w"]) { const v = num(el.style.getPropertyValue("--" + k)); if (v) t[k] = v; }
      return Object.keys(t).length ? t : null;
    }
    function readTweaks(sec) {
      const out = {};
      for (const el of sec.querySelectorAll("[data-b]")) { const t = readTweak(el); if (t) out[el.dataset.b] = t; }
      return Object.keys(out).length ? out : null;
    }
    function arraysOf(sec) {   // list name → number of items the builder emitted
      const out = {};
      for (const el of sec.querySelectorAll("[data-bk=item]")) { const name = el.dataset.b.split(".")[0]; out[name] = (out[name] || 0) + 1; }
      return out;
    }
    function snapshotLayout() {
      for (const s of all) builtLayout.set(s.key, { knobs: readKnobs(s.el), tweaks: readTweaks(s.el), arrays: arraysOf(s.el) });
    }
    const sectionOf = (el) => el.closest("section[data-key]");
    const keyOfSec = (sec) => sec && sec.dataset.key;
    function layoutOf(key) { return layoutEdits[key] || (layoutEdits[key] = {}); }
    function prune(key) {
      const o = layoutEdits[key];
      if (!o) return;
      if (o.knobs && !Object.keys(o.knobs).length) delete o.knobs;
      if (o.arrays && !Object.keys(o.arrays).length) delete o.arrays;
      if (!o.knobs && !o.tweaks && !o.arrays) delete layoutEdits[key];
    }
    function setKnob(sec, name, value) {   // value null = back to the layout's default
      const key = keyOfSec(sec), built = builtLayout.get(key).knobs[name];
      const o = layoutOf(key); o.knobs = o.knobs || {};
      if (value === built || (value == null && built == null)) delete o.knobs[name]; else o.knobs[name] = { from: built, to: value };
      prune(key);
      applyKnobsLive(sec);
      persist(); renderBar();
    }
    function currentKnobs(sec) {
      const key = keyOfSec(sec), out = { ...builtLayout.get(key).knobs };
      for (const [n, v] of Object.entries((layoutEdits[key] || {}).knobs || {})) out[n] = v.to;
      return out;
    }
    function applyKnobsLive(sec) {
      const k = currentKnobs(sec);
      sec.style.setProperty("--gap", k.gap != null ? k.gap + "px" : ""); if (k.gap == null) sec.style.removeProperty("--gap");
      if (k.pad != null) sec.style.setProperty("--pad", k.pad + "px"); else sec.style.removeProperty("--pad");
      if (k.scale != null) sec.style.setProperty("--scale", k.scale + "%"); else sec.style.removeProperty("--scale");
      if (k.ratio) { const [l, r] = k.ratio.split("/"); sec.style.setProperty("--ratio", `${l}fr ${r}fr`); } else sec.style.removeProperty("--ratio");
      placeHandles();
    }
    function currentTweaks(sec) {
      const key = keyOfSec(sec), o = layoutEdits[key];
      return o && o.tweaks ? (o.tweaks.to || {}) : (builtLayout.get(key).tweaks || {});
    }
    function setTweak(el, patch) {   // patch: { dx?, dy?, w? }; a 0 removes that part
      const sec = sectionOf(el), key = keyOfSec(sec), built = builtLayout.get(key).tweaks;
      const next = JSON.parse(JSON.stringify(currentTweaks(sec)));
      const t = { ...(next[el.dataset.b] || {}), ...patch };
      for (const k of Object.keys(t)) if (!t[k]) delete t[k];
      if (Object.keys(t).length) next[el.dataset.b] = t; else delete next[el.dataset.b];
      const o = layoutOf(key);
      if (JSON.stringify(Object.keys(next).length ? next : null) === JSON.stringify(built)) delete o.tweaks; else o.tweaks = { from: built, to: Object.keys(next).length ? next : null };
      prune(key);
      applyTweaksLive(sec);
      persist(); renderBar();
    }
    function applyTweaksLive(sec) {
      const t = currentTweaks(sec);
      for (const el of sec.querySelectorAll("[data-b]")) {
        const v = t[el.dataset.b] || {};
        for (const k of ["dx", "dy", "w"]) { if (v[k]) el.style.setProperty("--" + k, v[k] + (k === "w" ? "%" : "px")); else el.style.removeProperty("--" + k); }
        if (v.w) el.setAttribute("data-w", ""); else el.removeAttribute("data-w");
      }
      placeHandles();
    }
    function currentOrder(sec, name) {   // the kept original indices, in order
      const key = keyOfSec(sec), o = layoutEdits[key];
      if (o && o.arrays && o.arrays[name]) return o.arrays[name].slice();
      return Array.from({ length: builtLayout.get(key).arrays[name] || 0 }, (_, i) => i);
    }
    function setOrder(sec, name, kept) {
      const key = keyOfSec(sec), built = Array.from({ length: builtLayout.get(key).arrays[name] || 0 }, (_, i) => i);
      const o = layoutOf(key); o.arrays = o.arrays || {};
      if (kept.join() === built.join()) delete o.arrays[name]; else o.arrays[name] = kept;
      prune(key);
      applyArraysLive(sec, name);
      persist(); renderBar();
    }
    const itemEls = new Map();   // "key/name" → the built item elements by original index (kept alive when removed)
    function itemsOf(sec, name) {
      const id = keyOfSec(sec) + "/" + name;
      if (!itemEls.has(id)) itemEls.set(id, Array.from(sec.querySelectorAll(`[data-bk=item][data-b^="${name}."]`)).sort((a, b) => +a.dataset.b.split(".")[1] - +b.dataset.b.split(".")[1]));
      return itemEls.get(id);
    }
    function applyArraysLive(sec, name) {
      const els = itemsOf(sec, name), kept = currentOrder(sec, name);
      const parent = els[0] && els[0].parentElement;
      if (!parent) return;
      for (const el of els) if (el.parentElement === parent) parent.removeChild(el);
      for (const i of kept) if (els[i]) parent.appendChild(els[i]);
      if (sec.classList.contains("layout-card-row")) sec.style.setProperty("--card-count", String(kept.length));
      if (selected && !selected.isConnected) select(null);
      placeHandles();
    }
    function applyLayoutLive(key) {
      const s = all.find((x) => x.key === key);
      if (!s) return;
      applyKnobsLive(s.el); applyTweaksLive(s.el);
      for (const name of Object.keys(builtLayout.get(key).arrays)) applyArraysLive(s.el, name);
    }
    function select(el) {
      if (selected) selected.classList.remove("rv-selected");
      selected = el && el.isConnected ? el : null;
      if (selected) selected.classList.add("rv-selected");
      renderLayoutPanel();
      placeHandles();
    }
    function placeHandles() {
      sizeHandle.classList.remove("rv-show"); gutter.classList.remove("rv-show");
      if (!layout || !selected) return;
      const r = selected.getBoundingClientRect();
      if (selected.dataset.bk === "media") { sizeHandle.style.left = (r.right - 7) + "px"; sizeHandle.style.top = (r.bottom - 7) + "px"; sizeHandle.classList.add("rv-show"); }
      const sec = sectionOf(selected);
      if (sec && sec.classList.contains("layout-two-column") && (selected.dataset.b === "columns" || selected.dataset.b === "left" || selected.dataset.b === "right")) {
        const cols = sec.querySelector("[data-b=columns]"), left = sec.querySelector("[data-b=left]");
        if (cols && left) { const cr = cols.getBoundingClientRect(), lr = left.getBoundingClientRect(); gutter.style.left = (lr.right + (cr.width - lr.width - sec.querySelector("[data-b=right]").getBoundingClientRect().width) / 2 - 5) + "px"; gutter.style.top = cr.top + "px"; gutter.style.height = cr.height + "px"; gutter.classList.add("rv-show"); }
      }
    }
    function renderLayoutPanel() {
      const panelEl = q(panel, ".rv-layout-panel");
      if (!layout) { panelEl.innerHTML = ""; return; }
      const sec = selected ? sectionOf(selected) : current();
      if (!sec || !sec.dataset.key) { panelEl.innerHTML = '<p class="rv-lp-hint">No slide.</p>'; return; }
      const k = currentKnobs(sec), key = sec.dataset.key;
      const rows = [];
      rows.push(`<h3>Slide ${pad2(slides.indexOf(sec) + 1)}<span>${esc(titleOf(sec))}</span></h3>`);
      for (const [name, d] of Object.entries(KNOB_DEFS)) {
        if (d.layouts && !d.layouts.some((c) => sec.classList.contains(c))) continue;
        const built = builtLayout.get(key).knobs[name];
        const val = name === "ratio" ? (k.ratio ? +k.ratio.split("/")[0] : 50) : k[name] != null ? k[name] : (name === "scale" ? 80 : name === "pad" ? Math.round(num(getComputedStyle(sec).paddingLeft)) : null);
        const shown = name === "ratio" ? `${val}/${100 - val}` : val != null ? val + d.unit : "layout";
        rows.push(`<label><span>${d.label}</span><input type="range" data-knob="${name}" min="${d.min}" max="${d.max}" value="${val != null ? val : (d.min + d.max) / 2}"/><output>${shown}</output><button type="button" data-knob-reset="${name}" title="Back to ${built == null ? "the layout's default" : "the built value"}">Reset</button></label>`);
      }
      if (selected) {
        const t = (currentTweaks(sec))[selected.dataset.b] || {};
        const kind = selected.dataset.bk, name = selected.dataset.b;
        rows.push(`<h3>Selected<span>${esc(name)} · ${kind}</span></h3>`);
        rows.push(`<div class="rv-lp-row"><span>Nudge ${t.dx || 0}, ${t.dy || 0} px${t.w ? ` · width ${t.w}%` : ""}</span>${t.dx || t.dy || t.w ? '<button type="button" data-lp="reset">Reset nudge</button>' : ""}${kind === "item" ? '<button type="button" data-lp="delete">Delete (Del)</button>' : ""}</div>`);
        rows.push(`<p class="rv-lp-hint">${kind === "item" ? "Drag to reorder among its siblings; arrows nudge (Shift ×10); Del removes it." : kind === "media" ? "Drag to nudge; the corner handle resizes; arrows nudge (Shift ×10)." : "Drag or arrows to nudge (Shift ×10)."}${selected.dataset.b === "left" || selected.dataset.b === "right" || selected.dataset.b === "columns" ? " The bar between the columns sets their ratio." : ""}</p>`);
        const name0 = name.split(".")[0];
        if (kind === "item" && (layoutEdits[key] || {}).arrays && layoutEdits[key].arrays[name0]) rows.push(`<div class="rv-lp-row"><button type="button" data-lp="restore" data-list="${name0}">Restore the ${name0} list as built</button></div>`);
      } else rows.push('<p class="rv-lp-hint">Click a block to select it. Dotted outlines: blocks, green items, the second accent for media. L leaves layout mode.</p>');
      panelEl.innerHTML = rows.join("");
    }
    const pad2 = (n) => String(n).padStart(2, "0");
    function titleOf(sec) { const h = sec.querySelector("h1, h2, h3"); return h ? h.textContent.replace(/\s+/g, " ").trim() : ""; }
    function setLayout(on_) {
      layout = !!on_ && on;
      document.documentElement.classList.toggle("rv-layout", layout);
      for (const el of originals.keys()) { if (el.tagName === "ASIDE") continue; if (layout) el.removeAttribute("contenteditable"); else el.setAttribute("contenteditable", isHtml(el) ? "true" : "plaintext-only"); }
      if (!layout) select(null); else { renderLayoutPanel(); placeHandles(); }
      hideFmt();
      q(bar, "button[data-rv=layout]").style.fontWeight = layout ? "700" : "";
    }
    function nudge(el, dx, dy) { const t = (currentTweaks(sectionOf(el)))[el.dataset.b] || {}; setTweak(el, { dx: (t.dx || 0) + dx, dy: (t.dy || 0) + dy }); }
    function deleteItem(el) {
      const sec = sectionOf(el), name = el.dataset.b.split(".")[0], idx = +el.dataset.b.split(".")[1];
      setOrder(sec, name, currentOrder(sec, name).filter((i) => i !== idx));
      select(null);
    }
    function moveItem(el, targetEl, before) {
      const sec = sectionOf(el), name = el.dataset.b.split(".")[0];
      if (targetEl.dataset.b.split(".")[0] !== name) return;
      const idx = +el.dataset.b.split(".")[1], tIdx = +targetEl.dataset.b.split(".")[1];
      const kept = currentOrder(sec, name).filter((i) => i !== idx);
      const at = kept.indexOf(tIdx);
      if (at < 0) return;
      kept.splice(before ? at : at + 1, 0, idx);
      setOrder(sec, name, kept);
      select(el);
    }
    // Pointer handling in layout mode: a drag on an item reorders it, a drag on anything else nudges
    // it; the corner handle resizes media; the gutter sets the column ratio. Screen pixels become
    // slide pixels through Reveal's scale.
    function bindLayoutPointer() {
      const stage = deck.getSlidesElement();
      const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer (synthetic events); moves still arrive while over the element */ } };
      let drag = null;
      stage.addEventListener("pointerdown", (e) => {
        if (!layout || e.button !== 0) return;
        const el = e.target.closest && e.target.closest("[data-b]");
        if (!el || !stage.contains(el)) { select(null); return; }
        e.preventDefault();
        select(el);
        const t = (currentTweaks(sectionOf(el)))[el.dataset.b] || {};
        drag = { el, x: e.clientX, y: e.clientY, dx: t.dx || 0, dy: t.dy || 0, moved: false, item: el.dataset.bk === "item" };
        capture(el, e);
      });
      stage.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const scale = deck.getScale() || 1, mx = (e.clientX - drag.x) / scale, my = (e.clientY - drag.y) / scale;
        if (!drag.moved && Math.hypot(mx, my) < 3) return;
        drag.moved = true;
        if (drag.item) {
          drag.el.classList.add("rv-dragging");
          const under = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n !== drag.el && n.matches && n.matches("[data-bk=item]") && n.dataset.b.split(".")[0] === drag.el.dataset.b.split(".")[0]);
          stage.querySelectorAll(".rv-drop-before, .rv-drop-after").forEach((n) => n.classList.remove("rv-drop-before", "rv-drop-after"));
          if (under) { const r = under.getBoundingClientRect(); const horizontal = r.width > r.height * 1.2 && under.parentElement && getComputedStyle(under.parentElement).display.includes("grid") === false; const before = horizontal ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2; under.classList.add(before ? "rv-drop-before" : "rv-drop-after"); drag.target = under; drag.before = before; } else drag.target = null;
        } else {
          drag.el.style.setProperty("--dx", Math.round(drag.dx + mx) + "px");
          drag.el.style.setProperty("--dy", Math.round(drag.dy + my) + "px");
          placeHandles();
        }
      });
      const finish = (e) => {
        if (!drag) return;
        const d = drag; drag = null;
        stage.querySelectorAll(".rv-drop-before, .rv-drop-after").forEach((n) => n.classList.remove("rv-drop-before", "rv-drop-after"));
        d.el.classList.remove("rv-dragging");
        if (!d.moved) return;
        if (d.item) { if (d.target) moveItem(d.el, d.target, d.before); }
        else { const scale = deck.getScale() || 1; setTweak(d.el, { dx: Math.round(d.dx + (e.clientX - d.x) / scale), dy: Math.round(d.dy + (e.clientY - d.y) / scale) }); }
      };
      stage.addEventListener("pointerup", finish);
      stage.addEventListener("pointercancel", finish);
      // the corner handle: media width in percent of its container
      let hdrag = null;
      sizeHandle.addEventListener("pointerdown", (e) => { if (!selected) return; e.preventDefault(); capture(sizeHandle, e); hdrag = { x: e.clientX, w0: selected.getBoundingClientRect().width, pw: selected.parentElement.getBoundingClientRect().width }; });
      sizeHandle.addEventListener("pointermove", (e) => { if (!hdrag || !selected) return; const w = Math.max(10, Math.min(100, Math.round((hdrag.w0 + (e.clientX - hdrag.x)) / hdrag.pw * 100))); selected.style.setProperty("--w", w + "%"); selected.setAttribute("data-w", ""); hdrag.w = w; placeHandles(); });
      const hfinish = () => { if (!hdrag) return; const w = hdrag.w; hdrag = null; if (w != null && selected) setTweak(selected, { w }); };
      sizeHandle.addEventListener("pointerup", hfinish); sizeHandle.addEventListener("pointercancel", hfinish);
      // the gutter: the two columns' ratio
      let gdrag = null;
      gutter.addEventListener("pointerdown", (e) => { const sec = selected && sectionOf(selected); if (!sec) return; e.preventDefault(); capture(gutter, e); const cr = sec.querySelector("[data-b=columns]").getBoundingClientRect(); gdrag = { sec, left: cr.left, width: cr.width }; });
      gutter.addEventListener("pointermove", (e) => { if (!gdrag) return; const l = Math.max(20, Math.min(80, Math.round((e.clientX - gdrag.left) / gdrag.width * 100))); gdrag.l = l; gdrag.sec.style.setProperty("--ratio", `${l}fr ${100 - l}fr`); placeHandles(); });
      const gfinish = () => { if (!gdrag) return; const { sec, l } = gdrag; gdrag = null; if (l != null) setKnob(sec, "ratio", `${l}/${100 - l}`); };
      gutter.addEventListener("pointerup", gfinish); gutter.addEventListener("pointercancel", gfinish);
      // the panel's sliders and buttons
      panel.addEventListener("input", (e) => {
        const r = e.target.closest && e.target.closest("input[data-knob]");
        if (!r) return;
        const sec = selected ? sectionOf(selected) : current(), name = r.dataset.knob, v = +r.value;
        if (name === "ratio") sec.style.setProperty("--ratio", `${v}fr ${100 - v}fr`); else sec.style.setProperty("--" + name, v + (KNOB_DEFS[name].unit));
        r.parentElement.querySelector("output").textContent = name === "ratio" ? `${v}/${100 - v}` : v + KNOB_DEFS[name].unit;
        placeHandles();
      });
      panel.addEventListener("change", (e) => {
        const r = e.target.closest && e.target.closest("input[data-knob]");
        if (!r) return;
        const sec = selected ? sectionOf(selected) : current(), name = r.dataset.knob, v = +r.value;
        setKnob(sec, name, name === "ratio" ? `${v}/${100 - v}` : v);
        renderLayoutPanel();
      });
      panel.addEventListener("click", (e) => {
        const b = e.target.closest && e.target.closest("button");
        if (!b) return;
        const sec = selected ? sectionOf(selected) : current();
        if (b.dataset.knobReset) { setKnob(sec, b.dataset.knobReset, builtLayout.get(sec.dataset.key).knobs[b.dataset.knobReset]); renderLayoutPanel(); }
        else if (b.dataset.lp === "reset" && selected) { setTweak(selected, { dx: 0, dy: 0, w: 0 }); renderLayoutPanel(); }
        else if (b.dataset.lp === "delete" && selected) deleteItem(selected);
        else if (b.dataset.lp === "restore") { setOrder(sec, b.dataset.list, Array.from({ length: builtLayout.get(sec.dataset.key).arrays[b.dataset.list] || 0 }, (_, i) => i)); renderLayoutPanel(); }
      });
    }

    // ── The text formatter ─────────────────────────────────────────
    let fmtField = null;
    function showFmt(el) {
      fmtField = el;
      const r = el.getBoundingClientRect();
      fmt.classList.add("rv-show");
      const w = fmt.offsetWidth, h = fmt.offsetHeight;
      fmt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + "px";
      fmt.style.top = Math.max(8, r.top - h - 8) + "px";
    }
    function hideFmt() { fmt.classList.remove("rv-show"); fmtField = null; }
    function wrapSelection(tag, style) {   // wrap the selection in <tag style="…">; the sanitizer keeps span[style]
      const sel = getSelection();
      if (!sel || sel.rangeCount === 0 || !fmtField || !fmtField.contains(sel.anchorNode)) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) return;
      const el = document.createElement(tag);
      if (style) el.setAttribute("style", style);
      el.appendChild(range.extractContents());
      range.insertNode(el);
      sel.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(el); sel.addRange(nr);
      fmtField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function unwrapSpans() {   // clear formatting: strip b/i/strong/em/code/span around the selection, keep the text
      const sel = getSelection();
      if (!sel || sel.rangeCount === 0 || !fmtField) return;
      document.execCommand("removeFormat");
      const range = sel.getRangeAt(0);
      const walker = document.createTreeWalker(fmtField, NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => /^(SPAN|CODE|STRONG|EM|B|I)$/.test(n.tagName) && range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
      const hits = []; let n; while ((n = walker.nextNode())) hits.push(n);
      for (const h of hits) { const frag = document.createDocumentFragment(); while (h.firstChild) frag.appendChild(h.firstChild); h.replaceWith(frag); }
      fmtField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function fmtAction(act, value) {
      if (!fmtField) return;
      fmtField.focus();
      if (act === "bold") document.execCommand("bold");
      else if (act === "italic") document.execCommand("italic");
      else if (act === "code") wrapSelection("code");
      else if (act === "link") { const inp = fmt.querySelector("input"); if (!inp) { const i = document.createElement("input"); i.placeholder = "https://… then Enter"; i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const url = i.value.trim(); fmtField.focus(); if (url) document.execCommand("createLink", false, url); i.remove(); fmtField.dispatchEvent(new Event("input", { bubbles: true })); } else if (e.key === "Escape") i.remove(); e.stopPropagation(); }); fmt.appendChild(i); i.focus(); } else inp.focus(); return; }
      else if (act === "color") { if (value === "none") unwrapSpans(); else if (value) wrapSelection("span", `color: var(--color-${value})`); }
      else if (act === "size") { if (value === "1em") unwrapSpans(); else if (value) wrapSelection("span", `font-size: ${value}`); }
      else if (act === "clear") unwrapSpans();
      fmtField.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function toggle() {
      if (stale) { staleDeck(); return; }
      on = !on;
      if (!on && layout) setLayout(false);
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
      sizeHandle = document.createElement("div"); sizeHandle.className = "rv-handle"; sizeHandle.title = "Drag to resize";
      gutter = document.createElement("div"); gutter.className = "rv-gutter"; gutter.title = "Drag to set the column ratio";
      fmt = document.createElement("div"); fmt.className = "rv-fmt"; fmt.setAttribute("role", "toolbar"); fmt.innerHTML = FMT_HTML;
      document.body.append(bar, panel, confirmEl, toastEl, sizeHandle, gutter, fmt);
      fmt.addEventListener("mousedown", (e) => { if (e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") e.preventDefault(); });   // keep the field's selection
      fmt.addEventListener("click", (e) => { const b = e.target.closest("button[data-fmt]"); if (b) fmtAction(b.dataset.fmt); });
      fmt.addEventListener("change", (e) => { const sel = e.target.closest("select[data-fmt]"); if (sel) { fmtAction(sel.dataset.fmt, sel.value); sel.value = ""; } });
      bindLayoutPointer();
      window.addEventListener("resize", placeHandles);
      deck.on("slidechanged", () => { select(null); hideFmt(); renderLayoutPanel(); });
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-rv]");
        if (!b) return;
        b.blur();
        const act = b.dataset.rv;
        if (act === "save") save(); else if (act === "copy") copy(); else if (act === "build") askRebuild();
        else if (act === "folder") { if (folderState === "prompt") allowFolder(); else connectFolder(); }
        else if (act === "layout") setLayout(!layout);
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
      stage.addEventListener("focusin", (e) => { const el = e.target.closest && e.target.closest("[data-f][data-html]"); if (el && on && !layout) showFmt(el); });
      stage.addEventListener("focusout", (e) => { const el = e.target.closest && e.target.closest("[data-f]"); if (el && on) record(el, true); setTimeout(() => { if (!fmt.contains(document.activeElement) && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-f][data-html]"))) hideFmt(); }, 0); });
      stage.addEventListener("keydown", (e) => {
        const el = e.target.closest && e.target.closest("[data-f]");
        if (!el || !on) return;
        if (e.key === "Escape" || (e.key === "Enter" && !isHtml(el))) { e.preventDefault(); el.blur(); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && isHtml(el)) { e.preventDefault(); showFmt(el); fmtAction("link"); }
        e.stopPropagation();   // Reveal ignores keys in editable fields, and so should the presenter's bindings
      });
      // Shift+B before Reveal sees it (B alone stays its blackout); Enter / Esc drive the confirm bar.
      window.addEventListener("keydown", (e) => {
        if (confirmOpen()) {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeConfirm(); }
          else if (e.key === "Enter" && confirmAction) { e.preventDefault(); e.stopPropagation(); confirmAction(); }
          return;
        }
        if (typing(e.target)) { if (e.key === "Escape" && !e.target.closest("[data-f]")) e.target.blur(); return; }
        if (e.key === "B" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); askRebuild(); }
        if (on && !document.documentElement.classList.contains("rp-ov-on") && (e.key === "l" || e.key === "L") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); setLayout(!layout); return; }
        if (layout && selected) {   // the selection takes the arrows and Del; the deck keeps the rest
          const step = e.shiftKey ? 10 : 1;
          const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[e.key]) { e.preventDefault(); e.stopPropagation(); nudge(selected, ...moves[e.key]); renderLayoutPanel(); return; }
          if ((e.key === "Delete" || e.key === "Backspace") && selected.dataset.bk === "item") { e.preventDefault(); e.stopPropagation(); deleteItem(selected); return; }
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); select(null); return; }
        }
      }, true);
    }

    function onReady() {
      slides = Array.from(deck.getSlidesElement().querySelectorAll("section")).filter((s) => !s.querySelector("section"));
      if (stale) { staleDeck(); return; }
      for (const el of deck.getSlidesElement().querySelectorAll("section[data-key] [data-f]")) originals.set(el, valueOf(el));
      snapshotLayout();
      restore();
      if (opsOut()) applyLive();   // the draft's hidden, deleted and reordered slides, as the deck
      renderBar();
      deck.on("slidechanged", renderPanel);
      detectServer();
      restoreFolder();
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
