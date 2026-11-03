// editor.js — the slideware editor. Lives in the plugin; the deck's loader brings it in on E.
//
// What it edits: text on any element, the position and size of any element (figures included),
// speaker notes, comments for Claude, and the deck's structure (hide, delete, reorder, duplicate
// slides). Never the theme, the runtime or the figures' insides.
//
// How it saves (S, and autosave after each committed edit): every edit is recorded as an operation
// addressed by slide key plus element id (or its path of element children when it has no id), and
// applied to the live page at once. Saving re-reads index.html from the deck folder (Chrome's
// folder permission, asked once per browser session), replays the operations onto that text, and
// splices back only the sections they changed; every other byte stays as it was. If Claude changed
// the file meanwhile, the operations are replayed onto Claude's version, not written over it. The
// live page is never serialized, so runtime state can't reach the file.
//
// Lanes: the bar's lane picker shows a lane (base + its overlay). Edits made there go to that lane's
// overlay (lanes/<id>.json), never to the base. Saving the base rebuilds every lane file; saving in
// a lane rebuilds that lane's file. B rebuilds all lane files and runs the in-browser checks.
// Keys (capital letters): E done, S save, B build; Esc leaves a field or the selection; Del deletes
// the selected element; arrows nudge it (Shift ×10); Cmd/Ctrl+Z undoes; Alt+click selects the parent.
(function () {
  "use strict";
  const SW = window.SW, S = window.SWSerialize, L = window.SWLanes;
  if (!SW || !S || !L) { console.warn("slideware editor: runtime or helpers missing"); return; }
  if (window.SWEditor) return;
  const doc = document, html = doc.documentElement;
  const VERSION = "2.0.0";
  const FILE = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
  const DRAFT_KEY = "sw-editor:draft:" + location.pathname;
  const SNAP = 6;   // px on the slide

  // ── State ─────────────────────────────────────────────────────────
  let on = false, dir = null, fileText = null, fileStamp = 0, lastWriteStamp = 0;
  let ops = [], undo = [], selected = null, textEl = null, textBefore = null;
  let laneId = new URLSearchParams(location.search).get("lane") || null, overlay = null, overlayText = null;
  let saving = false, autosaveTimer = 0, watchTimer = 0, notesTimer = 0;
  const deleted = new Map();   // key → { el, index } for slides deleted this session
  let bar, panel, overlayEl, box, toastEl, guides;

  // ── UI ────────────────────────────────────────────────────────────
  const MONO = "ui-monospace, Menlo, monospace", SANS = "system-ui, -apple-system, sans-serif";
  const CSS = `
html.sw-editing { --sw-reserve-top: 46px; }
html.sw-editing #sw-slides > section [data-a] { animation: none !important; }
html.sw-editing #sw-slides > section { transition: none !important; }
html.sw-editing #sw-slides > section.sw-present *:not(aside):hover { outline: 1px dashed rgba(47,125,225,.55); outline-offset: 2px; cursor: default; }
html.sw-editing #sw-slides [contenteditable] { outline: 2px solid #2F7DE1 !important; outline-offset: 3px; cursor: text !important; }
.swe-bar { position: fixed; left: 0; right: 0; top: 0; z-index: 70; height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
  background: #1F1F1D; color: #EDEDEA; font: 13px/1 ${SANS}; box-sizing: border-box; }
.swe-bar .swe-label { font: 600 11px ${MONO}; letter-spacing: .12em; text-transform: uppercase; color: #9FC3FF; margin-right: 4px; }
.swe-bar .swe-status { margin-right: auto; color: #B9B9B2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.swe-bar .swe-status.swe-warn { color: #F2C08E; }
.swe-bar button, .swe-panel button { all: unset; cursor: pointer; padding: 6px 10px; border: 1px solid rgba(255,255,255,.22); border-radius: 7px; font: 500 12px ${SANS}; white-space: nowrap; }
.swe-bar button:hover { background: rgba(255,255,255,.08); }
.swe-bar button kbd { margin-left: 6px; font: 500 10px ${MONO}; opacity: .7; }
.swe-bar button.swe-primary { background: #2F7DE1; border-color: #2F7DE1; color: #FFF; }
.swe-bar select { font: 13px ${SANS}; padding: 5px 6px; border-radius: 7px; border: 1px solid rgba(255,255,255,.22); background: #2A2A27; color: #EDEDEA; }
.swe-bar .swe-lane-note { font-size: 12px; color: #F2C08E; }
.swe-panel { position: fixed; left: 0; right: 0; bottom: 0; z-index: 70; display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; padding: 10px 14px;
  background: #FAFAF8; border-top: 1px solid #DDDDD8; box-shadow: 0 -6px 20px rgba(0,0,0,.08); font: 13px/1.4 ${SANS}; color: #1A1A18; box-sizing: border-box; }
.swe-panel h4 { margin: 0 0 5px; font: 600 10.5px ${MONO}; letter-spacing: .12em; text-transform: uppercase; color: #6B6B63; }
.swe-panel textarea { width: 100%; box-sizing: border-box; height: 92px; resize: vertical; padding: 7px 9px; border: 1px solid #DDDDD8; border-radius: 7px; font: 13px/1.45 ${SANS}; background: #FFF; }
.swe-panel input[type=text] { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid #DDDDD8; border-radius: 7px; font: 13px ${SANS}; }
.swe-panel button { border-color: #CFCFC9; color: #1A1A18; }
.swe-panel button:hover { background: #EFEFEC; }
.swe-row { display: flex; gap: 6px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
.swe-comments { margin: 4px 0 0; padding: 0; list-style: none; max-height: 44px; overflow: auto; font-size: 12px; color: #4A4A43; }
.swe-sel { font: 12px ${MONO}; color: #4A4A43; }
.swe-checks { margin: 6px 0 0; max-height: 60px; overflow: auto; font: 12px ${MONO}; color: #8A4B14; }
.swe-overlay { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
.swe-box { position: absolute; display: none; border: 1.5px solid #2F7DE1; box-shadow: 0 0 0 1px rgba(255,255,255,.7); pointer-events: none; }
.swe-box.swe-show { display: block; }
.swe-h { position: absolute; width: 10px; height: 10px; margin: -6px 0 0 -6px; background: #FFF; border: 1.5px solid #2F7DE1; border-radius: 2px; pointer-events: auto; }
.swe-h[data-h=nw] { left: 0; top: 0; cursor: nwse-resize; } .swe-h[data-h=ne] { left: 100%; top: 0; cursor: nesw-resize; }
.swe-h[data-h=sw] { left: 0; top: 100%; cursor: nesw-resize; } .swe-h[data-h=se] { left: 100%; top: 100%; cursor: nwse-resize; }
.swe-tag { position: absolute; left: 0; top: -22px; padding: 2px 6px; border-radius: 4px; background: #2F7DE1; color: #FFF; font: 11px ${MONO}; white-space: nowrap; }
.swe-guide { position: absolute; background: #E2366F; pointer-events: none; }
.swe-toast { position: fixed; left: 50%; top: 56px; transform: translateX(-50%); z-index: 80; max-width: min(620px, 90vw); padding: 9px 14px; border-radius: 9px;
  background: #1A1A18; color: #FAFAF8; font: 13px/1.45 ${SANS}; box-shadow: 0 8px 26px rgba(0,0,0,.28); display: none; }
.swe-toast.swe-show { display: block; }
.swe-toast button { all: unset; cursor: pointer; margin-left: 10px; text-decoration: underline; }
.swe-bar [hidden], .swe-panel [hidden] { display: none !important; }
html:not(.sw-editing) .swe-bar, html:not(.sw-editing) .swe-panel, html:not(.sw-editing) .swe-overlay { display: none; }
@media print { .swe-bar, .swe-panel, .swe-overlay, .swe-toast { display: none !important; } }
`;
  function el(tag, attrs, inner) {
    const e = doc.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (inner !== undefined) e.innerHTML = inner;
    return e;
  }
  function buildUi() {
    const style = el("style", { id: "swe-css" }); style.textContent = CSS; doc.head.appendChild(style);
    bar = el("div", { class: "swe-bar", role: "toolbar", "aria-label": "Editor" }, `
<span class="swe-label">Editing</span><span class="swe-lane"></span><span class="swe-status"></span>
<button type="button" data-a="connect" hidden>Connect folder</button>
<button type="button" data-a="save" class="swe-primary">Save<kbd>S</kbd></button>
<button type="button" data-a="build" title="Rebuild every lane file and run the checks">Build<kbd>B</kbd></button>
<button type="button" data-a="dup" title="Duplicate this slide">Duplicate slide</button>
<button type="button" data-a="copy" title="Copy the unsaved edits as JSON, for Claude">Copy</button>
<button type="button" data-a="discard" title="Drop every unsaved edit">Discard</button>
<button type="button" data-a="done">Done<kbd>E</kbd></button>`);
    panel = el("div", { class: "swe-panel" }, `
<div><h4>Speaker notes</h4><textarea class="swe-notes" spellcheck="true" placeholder="Notes for this slide"></textarea></div>
<div><h4>Comment for Claude</h4><div class="swe-row" style="margin-top:0"><input type="text" class="swe-comment" placeholder="e.g. tighten this to one line"><button type="button" data-a="comment">Add</button></div>
<ul class="swe-comments"></ul>
<h4 style="margin-top:8px">Selection</h4><div class="swe-row"><span class="swe-sel">Click an element on the slide.</span>
<button type="button" data-a="pin" hidden>Pin in place</button><button type="button" data-a="reset" hidden>Reset position</button><button type="button" data-a="parent" hidden>Parent</button><button type="button" data-a="remove" hidden>Delete</button></div>
<div class="swe-checks"></div></div>`);
    overlayEl = el("div", { class: "swe-overlay" });
    box = el("div", { class: "swe-box" }, '<span class="swe-tag"></span>' + ["nw", "ne", "sw", "se"].map((h) => `<span class="swe-h" data-h="${h}"></span>`).join(""));
    guides = el("div");
    overlayEl.append(box, guides);
    toastEl = el("div", { class: "swe-toast", role: "status" });
    doc.body.append(bar, panel, overlayEl, toastEl);
    bar.addEventListener("click", onBarClick);
    panel.addEventListener("click", onBarClick);
    panel.querySelector(".swe-notes").addEventListener("input", onNotesInput);
    panel.querySelector(".swe-comment").addEventListener("keydown", (e) => { if (e.key === "Enter") addComment(); });
    box.addEventListener("pointerdown", onHandleDown);
    new ResizeObserver(reservePanel).observe(panel);
    renderLanePicker();
  }
  function reservePanel() {
    if (!on) return;
    html.style.setProperty("--sw-reserve-bottom", panel.offsetHeight + "px");
    SW.layout();
    drawBox();
  }
  let toastTimer = 0;
  function toast(text, actions) {
    toastEl.textContent = text;
    (actions || []).forEach(([label, fn]) => { const b = el("button", { type: "button" }); b.textContent = label; b.onclick = () => { toastEl.classList.remove("swe-show"); fn(); }; toastEl.appendChild(b); });
    toastEl.classList.add("swe-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("swe-show"), actions ? 15000 : 4500);
  }
  function status(text, warn) {
    const s = bar.querySelector(".swe-status");
    s.textContent = text;
    s.classList.toggle("swe-warn", !!warn);
  }
  function renderStatus() {
    if (!bar) return;
    const n = ops.length;
    if (!dir) status(n ? `${n} unsaved edit${n === 1 ? "" : "s"} · connect the deck folder to save` : "Connect the deck folder to save edits (Chrome asks once per session)", true);
    else status(n ? `${n} unsaved edit${n === 1 ? "" : "s"}${laneId ? ` · lane ${laneName()}` : ""}` : `Saved${laneId ? ` · lane ${laneName()}` : ""}`, false);
    bar.querySelector("[data-a=connect]").hidden = !!dir;
    try { if (n) localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), lane: laneId, ops })); else localStorage.removeItem(DRAFT_KEY); } catch (e) { /* blocked */ }
  }
  function laneName() { const l = (SW.config.lanes || []).find((x) => (x.id || "") === (laneId || "")); return l ? l.name : laneId; }
  function renderLanePicker() {
    const lanes = (SW.config.lanes || []).filter((l) => l && l.file);
    const holder = bar.querySelector(".swe-lane");
    holder.innerHTML = "";
    if (lanes.length < 2) return;
    const sel = el("select", { "aria-label": "Lane" });
    lanes.forEach((l) => { const o = el("option", { value: l.id || "" }); o.textContent = l.name; o.selected = (l.id || "") === (laneId || ""); sel.appendChild(o); });
    sel.addEventListener("change", () => switchLane(sel.value || null));
    holder.appendChild(sel);
    if (laneId) holder.appendChild(Object.assign(el("span", { class: "swe-lane-note" }), { textContent: "Edits apply to this lane only" }));
  }

  // ── Folder access ─────────────────────────────────────────────────
  function idb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open("sw-editor", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("folders");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function idbGet(k) { const db = await idb(); return new Promise((res) => { const t = db.transaction("folders").objectStore("folders").get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); }
  async function idbPut(k, v) { const db = await idb(); return new Promise((res) => { const t = db.transaction("folders", "readwrite").objectStore("folders").put(v, k); t.onsuccess = () => res(true); t.onerror = () => res(false); }); }
  async function restoreFolder(prompt) {
    if (!window.showDirectoryPicker) return false;
    const h = await idbGet(location.pathname).catch(() => null);
    if (!h) return false;
    let p = await h.queryPermission({ mode: "readwrite" });
    if (p !== "granted" && prompt) { try { p = await h.requestPermission({ mode: "readwrite" }); } catch (e) { p = "denied"; } }
    if (p !== "granted") return false;
    return useFolder(h);
  }
  async function connect() {
    if (!window.showDirectoryPicker) { toast("This browser can't save files. Use Chrome, Edge or Brave, or Copy the edits and give them to Claude."); return; }
    let h;
    try { h = await window.showDirectoryPicker({ mode: "readwrite", id: "slideware-deck" }); } catch (e) { return; }
    if (!(await useFolder(h))) toast(`That folder doesn't hold ${FILE}. Pick the folder this deck is in.`);
    else { await idbPut(location.pathname, h); toast("Folder connected. Edits save into the deck."); if (ops.length) scheduleSave(); }
  }
  async function useFolder(h) {
    try {
      const f = await (await h.getFileHandle(FILE)).getFile();
      dir = h;
      fileText = await f.text();
      fileStamp = f.lastModified;
      renderStatus();
      startWatch();
      return true;
    } catch (e) { return false; }
  }
  async function readFile(name) { const f = await (await dir.getFileHandle(name)).getFile(); return { text: await f.text(), stamp: f.lastModified }; }
  async function writeFile(name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    return (await fh.getFile()).lastModified;
  }
  async function lanesDir() { try { return await dir.getDirectoryHandle("lanes"); } catch (e) { return null; } }
  async function readOverlays() {
    const ld = await lanesDir();
    if (!ld) return [];
    const out = [];
    for await (const [name, h] of ld.entries()) {
      if (h.kind !== "file" || !name.endsWith(".json")) continue;
      const text = await (await h.getFile()).text();
      try { out.push({ id: name.replace(/\.json$/, ""), text, overlay: JSON.parse(text) }); } catch (e) { toast(`lanes/${name} isn't valid JSON; its lane file wasn't rebuilt.`); }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  // Claude (or anyone) changed the file: reload, keeping unsaved edits by saving them on top first.
  function startWatch() {
    clearInterval(watchTimer);
    watchTimer = setInterval(async () => {
      if (!dir || saving) return;
      let f;
      try { f = await (await dir.getFileHandle(FILE)).getFile(); } catch (e) { return; }
      if (f.lastModified === fileStamp || f.lastModified === lastWriteStamp) return;
      if (ops.length) { await save(); }
      toast("The deck changed on disk; reloading.");
      setTimeout(() => location.reload(), 400);
    }, 1500);
  }

  // ── Addressing ────────────────────────────────────────────────────
  const stageSection = (n) => n && n.closest && n.closest("#sw-slides > section");
  const kids = (n) => Array.from(n.children).filter((c) => !c.hasAttribute("data-sw-gen"));
  function addrOf(node) {
    const sec = stageSection(node);
    const key = sec.getAttribute("data-key");
    const path = [];
    for (let n = node; n !== sec; n = n.parentElement) path.unshift(kids(n.parentElement).indexOf(n));
    const id = node !== sec && node.id && !node.closest("[data-sw-expanded]") ? node.id : null;
    return { key, id, path };
  }
  function resolve(root, a) {
    if (a.id) { const byId = root.querySelector(`[id="${a.id.replace(/"/g, '\\"')}"]`); if (byId) return byId; }
    let n = root;
    for (const i of a.path) { n = kids(n)[i]; if (!n) return null; }
    return n;
  }
  const liveSection = (key) => SW.allSlides().find((s) => s.getAttribute("data-key") === key) || null;

  // ── Style helpers ─────────────────────────────────────────────────
  function readStyle(node) {
    const map = new Map();
    (node.getAttribute("style") || "").split(";").forEach((d) => {
      const i = d.indexOf(":");
      if (i > 0) map.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    });
    return map;
  }
  function writeStyle(node, props) {
    const map = readStyle(node);
    for (const [k, v] of Object.entries(props)) { if (v === null || v === "") map.delete(k); else map.set(k, v); }
    const s = [...map].map(([k, v]) => `${k}: ${v}`).join("; ");
    if (s) node.setAttribute("style", s); else node.removeAttribute("style");
  }

  // ── Operations ────────────────────────────────────────────────────
  // record(op, undoFn): op is already applied to the live page by the caller.
  function record(op, undoFn) {
    ops.push(op);   // one operation, one undo step: they stay in lockstep
    undo.push(undoFn);
    renderStatus();
    scheduleSave();
    doc.dispatchEvent(new CustomEvent("sw-edit-change", { detail: { key: op.key || null } }));
  }
  function undoLast() {
    const fn = undo.pop();
    if (!fn) return;
    fn();
    ops.pop();
    renderStatus();
    scheduleSave();
    drawBox();
    doc.dispatchEvent(new CustomEvent("sw-edit-change", { detail: {} }));
  }
  function scheduleSave() {
    clearTimeout(autosaveTimer);
    if (dir && ops.length) autosaveTimer = setTimeout(() => save(), 1200);
  }

  // Apply operations to a parsed copy of the base deck's slides; returns the new file text.
  function applyOpsToText(text, list) {
    const reg = L.slidesRegion(text);
    if (!reg) throw new Error("the deck has no #sw-slides region");
    const content = text.slice(reg.contentStart, reg.contentEnd);
    const d = new DOMParser().parseFromString(`<!doctype html><html><body><main id="sw-slides">${content}</main></body></html>`, "text/html");
    const main = d.getElementById("sw-slides");
    const byKey = () => new Map(Array.from(main.children).filter((c) => c.localName === "section").map((s) => [s.getAttribute("data-key"), s]));
    const touched = new Set(), openOnly = new Set(), failed = [];
    let structural = false;
    for (const op of list) {
      const secs = byKey(), sec = secs.get(op.key);
      if (op.type === "reorder") {
        op.keys.forEach((k) => { const s = secs.get(k); if (s) main.appendChild(s); });
        structural = true; continue;
      }
      if (!sec) { failed.push(op); continue; }
      if (op.type === "delete") { sec.remove(); structural = true; continue; }
      if (op.type === "duplicate") {
        const copy = sec.cloneNode(true);
        copy.setAttribute("data-key", op.newKey);
        sec.after(copy);
        structural = true; continue;
      }
      if (op.type === "hide") { if (op.hidden) sec.setAttribute("hidden", ""); else sec.removeAttribute("hidden"); openOnly.add(op.key); continue; }
      if (op.type === "notes") {
        let aside = Array.from(sec.children).find((c) => c.localName === "aside" && c.classList.contains("notes"));
        if (!aside) { aside = d.createElement("aside"); aside.className = "notes"; sec.appendChild(aside); }
        aside.textContent = op.text;
        touched.add(op.key); continue;
      }
      if (op.type === "comment") {
        const c = d.createComment(` @claude: ${op.text.replace(/--/g, "—")} `);
        const aside = Array.from(sec.children).find((x) => x.localName === "aside");
        sec.insertBefore(c, aside || null);
        if (aside) sec.insertBefore(d.createTextNode("\n  "), aside);
        touched.add(op.key); continue;
      }
      const target = resolve(sec, op);
      if (!target) { failed.push(op); continue; }
      if (op.type === "text") {
        if (op.from !== undefined && target.innerHTML !== op.from && S.serializeChildren(target) !== op.from) { failed.push(op); continue; }
        target.innerHTML = op.html;
      } else if (op.type === "style") writeStyle(target, op.props);
      else if (op.type === "remove") target.remove();
      touched.add(op.key);
    }
    // Rebuild the region: untouched sections keep their exact text.
    const originals = L.sectionsIn(content).reduce((m, s) => m.set(s.key, content.slice(s.start, s.end)), new Map());
    const textOf = (s) => {
      const k = s.getAttribute("data-key");
      if (touched.has(k) || !originals.has(k)) return S.serializeNode(s);
      let t = originals.get(k);
      if (openOnly.has(k)) { const open = /^<section\b[^>]*>/i.exec(t)[0]; t = L.setAttrs(open, { hidden: s.hasAttribute("hidden") ? true : null }) + t.slice(open.length); }
      return t;
    };
    let region;
    if (structural) {
      region = "\n" + Array.from(main.children).filter((c) => c.localName === "section").map((s) => {
        const title = (s.querySelector("h1, h2, h3") || {}).textContent || "";
        return `<!-- ${s.getAttribute("data-key")}${title.trim() ? " · " + title.replace(/\s+/g, " ").trim().replace(/--/g, "—") : ""} -->\n${textOf(s)}`;
      }).join("\n\n") + "\n";
    } else {
      region = content;
      const secs = L.sectionsIn(content).slice().reverse();
      for (const s of secs) {
        if (!touched.has(s.key) && !openOnly.has(s.key)) continue;
        const node = byKey().get(s.key);
        region = region.slice(0, s.start) + textOf(node) + region.slice(s.end);
      }
    }
    return { text: text.slice(0, reg.contentStart) + region + text.slice(reg.contentEnd), failed };
  }

  // Lane edits become overrides in the lane's overlay.
  function applyOpsToOverlay(baseText, ov, list) {
    ov = JSON.parse(JSON.stringify(ov || {}));
    ov.overrides = ov.overrides || [];
    const reg = L.slidesRegion(baseText);
    const d = new DOMParser().parseFromString(`<!doctype html><html><body><main>${baseText.slice(reg.contentStart, reg.contentEnd)}</main></body></html>`, "text/html");
    const failed = [];
    for (const op of list) {
      const sec = Array.from(d.body.firstChild.children).find((s) => s.getAttribute("data-key") === op.key);
      if (op.type === "hide") {
        ov.hidden = (ov.hidden || []).filter((k) => k !== op.key);
        ov.shown = (ov.shown || []).filter((k) => k !== op.key);
        const baseHidden = sec && sec.hasAttribute("hidden");
        if (op.hidden && !baseHidden) ov.hidden.push(op.key);
        if (!op.hidden && baseHidden) ov.shown.push(op.key);
        continue;
      }
      if (op.type !== "text" && op.type !== "style") { failed.push(op); continue; }
      const target = sec && resolve(sec, op);
      const entry = ov.overrides.find((o) => o.key === op.key && (op.id ? o.id === op.id : JSON.stringify(o.path) === JSON.stringify(op.path)));
      const e = entry || { key: op.key, ...(op.id ? { id: op.id } : { path: op.path }) };
      if (op.type === "text") { e.html = op.html; if (target) e.from = S.serializeChildren(target); }
      else {
        const base = target ? readStyle(target) : new Map();
        const cur = new Map(Object.entries(Object.fromEntries(base)));
        const prev = e.attrs && e.attrs.style ? e.attrs.style : null;
        if (prev) prev.split(";").forEach((x) => { const i = x.indexOf(":"); if (i > 0) cur.set(x.slice(0, i).trim(), x.slice(i + 1).trim()); });
        for (const [k, v] of Object.entries(op.props)) { if (v === null || v === "") cur.delete(k); else cur.set(k, v); }
        e.attrs = Object.assign({}, e.attrs, { style: [...cur].map(([k, v]) => `${k}: ${v}`).join("; ") || null });
      }
      if (!entry) ov.overrides.push(e);
    }
    return { overlay: ov, failed };
  }

  async function save() {
    if (saving) return;
    if (!ops.length) { toast("Nothing to save."); return; }
    if (!dir) { if (!(await restoreFolder(true))) { toast("Connect the deck folder first (the button in the bar)."); renderStatus(); return; } }
    saving = true;
    clearTimeout(autosaveTimer);
    const batch = ops.slice();
    try {
      const disk = await readFile(FILE);
      if (laneId) {
        const oname = `lanes/${laneId}.json`;
        const ld = await lanesDir();
        const cur = JSON.parse(await (await (await ld.getFileHandle(`${laneId}.json`)).getFile()).text());
        const r = applyOpsToOverlay(disk.text, cur, batch);
        const ovText = JSON.stringify(r.overlay, null, 2) + "\n";
        const fh = await ld.getFileHandle(`${laneId}.json`);
        const w = await fh.createWritable(); await w.write(ovText); await w.close();
        overlay = r.overlay; overlayText = ovText;
        await writeLane(disk.text, { id: laneId, text: ovText, overlay: r.overlay });
        finishSave(batch, r.failed, `Saved to ${oname} and rebuilt its lane file`);
      } else {
        const r = applyOpsToText(disk.text, batch);
        lastWriteStamp = await writeFile(FILE, r.text);
        fileText = r.text; fileStamp = lastWriteStamp;
        const n = await rebuildLanes(r.text);
        finishSave(batch, r.failed, `Saved${n ? ` and rebuilt ${n} lane file${n === 1 ? "" : "s"}` : ""}`);
      }
    } catch (e) {
      console.error(e);
      toast("Saving failed: " + e.message);
    } finally { saving = false; renderStatus(); }
  }
  function finishSave(batch, failed, msg) {
    ops = ops.slice(batch.length).concat(failed);
    undo = failed.length ? undo.slice(-failed.length) : [];
    if (failed.length) toast(`${msg}. ${failed.length} edit${failed.length === 1 ? "" : "s"} didn't match the file (it changed under them); they're still pending. Copy them for Claude, or Discard.`);
    else status(msg);
  }
  async function writeLane(baseText, l, list) {
    const lanes = list || SW.config.lanes || null;
    const r = L.applyLane(baseText, l.overlay, l.id, lanes, L.sourceStamp(baseText, l.text));
    await writeFile(`index-${l.id}.html`, r.text);
  }
  async function rebuildLanes(baseText) {
    const all = await readOverlays();
    for (const l of all) await writeLane(baseText, l);
    return all.length;
  }

  // ── Live operations ───────────────────────────────────────────────
  function snapshot(node) { return { node, html: node.innerHTML, style: node.getAttribute("style") }; }
  function editText(node, newHtml, oldHtml) {
    const a = addrOf(node);
    record({ type: "text", key: a.key, id: a.id, path: a.path, html: newHtml, from: oldHtml }, () => { node.innerHTML = oldHtml; SW.expand(node); });
  }
  function setStyle(node, props, before) {
    const a = addrOf(node);
    const prev = before !== undefined ? before : node.getAttribute("style");
    writeStyle(node, props);
    record({ type: "style", key: a.key, id: a.id, path: a.path, props: { ...props } }, () => { if (prev === null) node.removeAttribute("style"); else node.setAttribute("style", prev); });
  }
  function removeElement(node) {
    if (!node || node === stageSection(node)) return;
    if (laneId) { toast("Elements can't be deleted in a lane view; hide them in the base, or edit their text."); return; }
    const a = addrOf(node), parent = node.parentNode, next = node.nextSibling;
    node.remove();
    select(null);
    record({ type: "remove", key: a.key, id: a.id, path: a.path }, () => parent.insertBefore(node, next));
  }

  // ── Text editing ──────────────────────────────────────────────────
  const INLINE = /^(inline|inline-block|inline-flex|contents)$/;
  function textBlock(node) {
    let n = node;
    while (n && !n.matches("#sw-slides > section") && INLINE.test(getComputedStyle(n).display) && n.parentElement && !n.parentElement.matches("#sw-slides > section")) n = n.parentElement;
    if (!n || n.matches("#sw-slides > section") || n.closest("svg") || n.closest("[data-sw-expanded]") || n.closest("aside.notes")) return null;
    const blockKids = Array.from(n.children).some((c) => !INLINE.test(getComputedStyle(c).display) && c.localName !== "br");
    if (blockKids || !n.textContent.trim()) return null;
    return n;
  }
  function startText(node) {
    const t = textBlock(node);
    if (!t) { toast("That element holds other blocks; double-click a line of text inside it."); return; }
    endText(true);
    textEl = t;
    textBefore = S.cleanInner(t);
    t.setAttribute("contenteditable", "true");
    t.setAttribute("data-sw-ce", "");
    t.focus();
    select(t, true);
  }
  function endText(commit) {
    if (!textEl) return;
    const t = textEl;
    textEl = null;
    t.removeAttribute("contenteditable");
    t.removeAttribute("data-sw-ce");
    if (commit) {
      const now = S.cleanInner(t);
      if (now !== textBefore) editText(t, now, textBefore);
    } else t.innerHTML = textBefore;
    drawBox();
  }
  function onPaste(e) {
    if (!textEl || !textEl.contains(e.target)) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    doc.execCommand("insertText", false, text);
  }

  // ── Selection, move and resize ────────────────────────────────────
  function selectable(target) {
    if (!target || !target.closest) return null;
    const sec = stageSection(target);
    if (!sec || !sec.classList.contains("sw-present")) return null;
    if (target.closest("[data-sw-gen]") || target.closest("aside.notes")) return null;
    const fig = target.closest("[data-sw-expanded]");
    if (fig) return fig;   // a figure moves and resizes as one; its insides are Claude's
    let svg = target.closest("svg");
    while (svg && svg.parentElement && svg.parentElement.closest("svg")) svg = svg.parentElement.closest("svg");
    if (svg) return svg;
    return target === sec ? null : target;
  }
  function select(node, quiet) {
    selected = node;
    const info = panel.querySelector(".swe-sel");
    ["pin", "reset", "parent", "remove"].forEach((a) => { panel.querySelector(`[data-a=${a}]`).hidden = !node; });
    if (!node) { info.textContent = "Click an element on the slide."; box.classList.remove("swe-show"); return; }
    const a = addrOf(node);
    const cls = (node.getAttribute("class") || "").split(/\s+/).filter((c) => c && !/^sw-/.test(c))[0];
    info.textContent = `${node.localName}${a.id ? "#" + a.id : cls ? "." + cls : ""}${node.hasAttribute("data-figure-ref") ? " (figure " + node.getAttribute("data-figure-ref") + ")" : ""} · double-click to edit text · drag to move · corners resize`;
    panel.querySelector("[data-a=pin]").hidden = getComputedStyle(node).position === "absolute";
    box.querySelector(".swe-tag").textContent = node.localName + (a.id ? "#" + a.id : "");
    drawBox();
    if (!quiet) node.blur && node.blur();
  }
  function drawBox() {
    if (!selected || !selected.isConnected || !on) { box.classList.remove("swe-show"); return; }
    const r = selected.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    box.classList.add("swe-show");
    box.querySelectorAll(".swe-h").forEach((h) => { h.style.display = textEl ? "none" : ""; });
  }
  function stageBox(node) {   // the element's box in slide pixels
    const sec = stageSection(node), base = sec.getBoundingClientRect(), r = node.getBoundingClientRect(), s = SW.scale();
    return { x: (r.left - base.left) / s, y: (r.top - base.top) / s, w: r.width / s, h: r.height / s };
  }
  function translateOf(node) {
    const t = readStyle(node).get("translate");
    if (!t) return [0, 0];
    const m = t.split(/\s+/).map((v) => parseFloat(v) || 0);
    return [m[0] || 0, m[1] || 0];
  }
  function snapTargets(node) {
    const sec = stageSection(node);
    const xs = [0, SW.width / 2, SW.width], ys = [0, SW.height / 2, SW.height];
    sec.querySelectorAll("*").forEach((o) => {
      if (o === node || node.contains(o) || o.contains(node) || o.closest("[data-sw-gen]") || o.closest("aside") || o.closest("svg") && o.localName !== "svg") return;
      const b = stageBox(o);
      if (!b.w || !b.h) return;
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    });
    return { xs, ys };
  }
  function snap(value, size, targets) {   // nearest of value (edge), value+size/2, value+size within SNAP
    let best = null;
    for (const [off] of [[0], [size / 2], [size]]) for (const t of targets) {
      const d = t - (value + off);
      if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
    }
    return best;
  }
  function showGuides(gx, gy) {
    guides.innerHTML = "";
    const sec = SW.current(), base = sec.getBoundingClientRect(), s = SW.scale();
    if (gx !== null) guides.appendChild(Object.assign(el("div", { class: "swe-guide" }), { style: `left:${base.left + gx * s}px;top:${base.top}px;width:1px;height:${base.height}px` }));
    if (gy !== null) guides.appendChild(Object.assign(el("div", { class: "swe-guide" }), { style: `left:${base.left}px;top:${base.top + gy * s}px;width:${base.width}px;height:1px` }));
  }
  let drag = null;
  function onStageDown(e) {
    if (!on || e.button !== 0) return;
    if (textEl && textEl.contains(e.target)) return;   // caret placement inside the field being edited
    const node = selectable(e.target);
    if (textEl) endText(true);
    if (!node) { select(null); return; }
    e.preventDefault();
    if (e.altKey && selected && selected.parentElement && !selected.parentElement.matches("#sw-slides > section")) { select(selected.parentElement); return; }
    select(node);
    const absolute = getComputedStyle(node).position === "absolute";
    drag = { node, x: e.clientX, y: e.clientY, moved: false, absolute, start: stageBox(node), t0: translateOf(node),
      left0: parseFloat(readStyle(node).get("left")) || node.offsetLeft, top0: parseFloat(readStyle(node).get("top")) || node.offsetTop,
      before: node.getAttribute("style"), targets: null };
    doc.addEventListener("pointermove", onDragMove);
    doc.addEventListener("pointerup", onDragEnd, { once: true });
  }
  function onDragMove(e) {
    if (!drag) return;
    const s = SW.scale();
    let dx = (e.clientX - drag.x) / s, dy = (e.clientY - drag.y) / s;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    if (!drag.moved) { drag.moved = true; drag.targets = snapTargets(drag.node); }
    let gx = null, gy = null;
    if (!e.altKey) {
      const sx = snap(drag.start.x + dx, drag.start.w, drag.targets.xs), sy = snap(drag.start.y + dy, drag.start.h, drag.targets.ys);
      if (sx) { dx += sx.d; gx = sx.at; }
      if (sy) { dy += sy.d; gy = sy.at; }
    }
    showGuides(gx, gy);
    if (drag.absolute) writeStyle(drag.node, { left: Math.round(drag.left0 + dx) + "px", top: Math.round(drag.top0 + dy) + "px" });
    else writeStyle(drag.node, { translate: `${Math.round(drag.t0[0] + dx)}px ${Math.round(drag.t0[1] + dy)}px` });
    drawBox();
  }
  function onDragEnd() {
    doc.removeEventListener("pointermove", onDragMove);
    guides.innerHTML = "";
    const d = drag;
    drag = null;
    if (!d || !d.moved) return;
    const st = readStyle(d.node);
    const props = d.absolute ? { left: st.get("left"), top: st.get("top") } : { translate: st.get("translate") };
    setStyle(d.node, props, d.before);
  }
  function onHandleDown(e) {
    const h = e.target.closest(".swe-h");
    if (!h || !selected) return;
    e.preventDefault(); e.stopPropagation();
    const node = selected, start = stageBox(node), t0 = translateOf(node), before = node.getAttribute("style"), absolute = getComputedStyle(node).position === "absolute";
    const left0 = parseFloat(readStyle(node).get("left")) || node.offsetLeft, top0 = parseFloat(readStyle(node).get("top")) || node.offsetTop;
    const media = /^(img|svg|video|canvas)$/.test(node.localName);
    const x0 = e.clientX, y0 = e.clientY, corner = h.dataset.h, s0 = parseFloat(readStyle(node).get("scale")) || 1;
    const move = (ev) => {
      const s = SW.scale();
      const dx = (ev.clientX - x0) / s, dy = (ev.clientY - y0) / s;
      const sx = corner.includes("w") ? -1 : 1, sy = corner.includes("n") ? -1 : 1;
      if (ev.shiftKey) {   // uniform scale
        const k = Math.max(0.1, (start.w + sx * dx) / start.w);
        writeStyle(node, { scale: String(+(s0 * k).toFixed(3)), "transform-origin": `${corner.includes("w") ? "right" : "left"} ${corner.includes("n") ? "bottom" : "top"}` });
      } else {
        const w = Math.max(8, Math.round(start.w + sx * dx));
        const props = { width: w + "px" };
        if (media) props.height = "auto";
        else if (ev.altKey) props.height = Math.max(8, Math.round(start.h + sy * dy)) + "px";
        const shiftX = corner.includes("w") ? start.w - w : 0;
        const shiftY = corner.includes("n") && props.height && props.height !== "auto" ? start.h - parseFloat(props.height) : 0;
        if (shiftX || shiftY) {
          if (absolute) { props.left = Math.round(left0 + shiftX) + "px"; props.top = Math.round(top0 + shiftY) + "px"; }
          else props.translate = `${Math.round(t0[0] + shiftX)}px ${Math.round(t0[1] + shiftY)}px`;
        }
        writeStyle(node, props);
      }
      drawBox();
    };
    const up = () => {
      doc.removeEventListener("pointermove", move);
      const st = readStyle(node), props = {};
      ["width", "height", "scale", "transform-origin", "translate", "left", "top"].forEach((k) => { if (st.has(k)) props[k] = st.get(k); });
      setStyle(node, props, before);
    };
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", up, { once: true });
  }
  function nudge(dx, dy) {
    if (!selected) return;
    const before = selected.getAttribute("style");
    if (getComputedStyle(selected).position === "absolute") {
      const st = readStyle(selected);
      const l = (parseFloat(st.get("left")) || selected.offsetLeft) + dx, t = (parseFloat(st.get("top")) || selected.offsetTop) + dy;
      writeStyle(selected, { left: l + "px", top: t + "px" });
      setStyle(selected, { left: l + "px", top: t + "px" }, before);
    } else {
      const [x, y] = translateOf(selected);
      setStyle(selected, { translate: `${x + dx}px ${y + dy}px` }, before);
    }
    drawBox();
  }
  function pin() {
    if (!selected) return;
    const sec = stageSection(selected), b = stageBox(selected), sb = { x: 0, y: 0 };
    void sec; void sb;
    const before = selected.getAttribute("style");
    setStyle(selected, { position: "absolute", left: Math.round(b.x) + "px", top: Math.round(b.y) + "px", width: Math.round(b.w) + "px", translate: null, margin: "0" }, before);
    select(selected);
  }
  function resetPosition() {
    if (!selected) return;
    setStyle(selected, { translate: null, scale: null, "transform-origin": null, position: null, left: null, top: null, width: null, height: null, margin: null });
    select(selected);
  }

  // ── Notes and comments ────────────────────────────────────────────
  function notesOf(sec) { const a = sec && Array.from(sec.children).find((c) => c.localName === "aside" && c.classList.contains("notes")); return a ? a.textContent : ""; }
  function renderPanel() {
    const sec = SW.current();
    const ta = panel.querySelector(".swe-notes");
    if (doc.activeElement !== ta) ta.value = notesOf(sec);
    const list = panel.querySelector(".swe-comments");
    list.innerHTML = "";
    if (sec) Array.from(sec.childNodes).filter((n) => n.nodeType === 8 && /^\s*@claude:/.test(n.data)).forEach((n) => {
      const li = el("li"); li.textContent = "• " + n.data.replace(/^\s*@claude:\s*/, "").trim(); list.appendChild(li);
    });
  }
  function onNotesInput(e) {
    clearTimeout(notesTimer);
    const sec = SW.current(), text = e.target.value;
    if (!sec) return;
    if (laneId) { toast("Notes are edited in the base deck; switch the lane picker to the base."); e.target.value = notesOf(sec); return; }
    notesTimer = setTimeout(() => {
      let aside = Array.from(sec.children).find((c) => c.localName === "aside" && c.classList.contains("notes"));
      const before = aside ? aside.textContent : null;
      if (!aside) { aside = el("aside", { class: "notes" }); sec.appendChild(aside); }
      aside.textContent = text;
      record({ type: "notes", key: sec.getAttribute("data-key"), text }, () => { if (before === null) aside.remove(); else aside.textContent = before; renderPanel(); });
    }, 400);
  }
  function addComment() {
    const input = panel.querySelector(".swe-comment"), text = input.value.trim(), sec = SW.current();
    if (!text || !sec) return;
    if (laneId) { toast("Comments go into the base deck; switch the lane picker to the base."); return; }
    const c = doc.createComment(` @claude: ${text.replace(/--/g, "—")} `);
    const aside = Array.from(sec.children).find((x) => x.localName === "aside");
    sec.insertBefore(c, aside || null);
    input.value = "";
    record({ type: "comment", key: sec.getAttribute("data-key"), text }, () => { c.remove(); renderPanel(); });
    renderPanel();
  }

  // ── Structure (the overview calls these) ──────────────────────────
  function slidesForOverview() {
    const live = SW.allSlides().map((s) => ({ key: s.getAttribute("data-key"), el: s, hidden: s.hidden, deleted: false }));
    for (const [key, d] of deleted) live.splice(Math.min(d.index, live.length), 0, { key, el: d.el, hidden: d.el.hidden, deleted: true });
    return live;
  }
  function changed(key) { doc.dispatchEvent(new CustomEvent("sw-edit-change", { detail: { key } })); }
  function setHidden(key, hidden) {
    const sec = liveSection(key) || (deleted.get(key) || {}).el;
    if (!sec) return;
    sec.hidden = hidden;
    SW.refresh();
    record({ type: "hide", key, hidden }, () => { sec.hidden = !hidden; SW.refresh(); changed(key); });
    changed(key);
  }
  function setDeleted(key, del) {
    if (laneId) { toast("Slides are deleted in the base deck; in a lane, hide them instead."); return; }
    if (del) {
      const sec = liveSection(key);
      if (!sec) return;
      const index = SW.allSlides().indexOf(sec);
      sec.remove();
      deleted.set(key, { el: sec, index });
      SW.refresh();
      record({ type: "delete", key }, () => { restoreSlide(key); });
    } else {
      // Undo of a delete from the overview: drop the delete operation itself.
      const i = ops.findIndex((o) => o.type === "delete" && o.key === key);
      if (i >= 0) { ops.splice(i, 1); undo.splice(i, 1); }
      restoreSlide(key);
      renderStatus();
    }
    changed(key);
  }
  function restoreSlide(key) {
    const d = deleted.get(key);
    if (!d) return;
    const all = SW.allSlides();
    SW.stage.insertBefore(d.el, all[d.index] || null);
    deleted.delete(key);
    SW.refresh();
    changed(key);
  }
  function reorder(keys) {
    if (laneId) { toast("Slide order is shared by every lane; reorder in the base view."); return; }
    const before = SW.allSlides().map((s) => s.getAttribute("data-key"));
    const apply = (order) => { order.forEach((k) => { const s = liveSection(k); if (s) SW.stage.appendChild(s); }); SW.refresh(); };
    apply(keys);
    record({ type: "reorder", keys: keys.slice() }, () => { apply(before); changed(null); });
    changed(null);
  }
  function duplicateSlide() {
    if (laneId) { toast("Slides are duplicated in the base deck."); return; }
    const sec = SW.current();
    if (!sec) return;
    const key = sec.getAttribute("data-key");
    const existing = new Set(SW.allSlides().map((s) => s.getAttribute("data-key")));
    let n = 2, newKey = `${key}-${n}`;
    while (existing.has(newKey)) newKey = `${key}-${++n}`;
    const copy = doc.createElement("div");
    copy.innerHTML = S.cleanOuter(sec);
    const fresh = copy.firstElementChild;
    fresh.setAttribute("data-key", newKey);
    sec.after(fresh);
    SW.expand(fresh);
    SW.refresh();
    SW.go(SW.slides().indexOf(fresh));
    record({ type: "duplicate", key, newKey }, () => { fresh.remove(); SW.refresh(); changed(null); });
    changed(newKey);
  }

  // ── Lanes ─────────────────────────────────────────────────────────
  async function switchLane(id) {
    if (ops.length) { toast("Save or discard the edits first, then switch lanes."); renderLanePicker(); return; }
    const u = new URL(location.href);
    u.searchParams.set("edit", "");
    if (id) u.searchParams.set("lane", id); else u.searchParams.delete("lane");
    location.href = u.href.replace(/edit=(&|$|#)/, "edit$1");
  }
  async function showLane() {
    if (!laneId) return;
    if (!dir && !(await restoreFolder(false))) { toast("Connect the deck folder to see this lane (its overlay lives in lanes/)."); return; }
    try {
      const ld = await lanesDir();
      overlayText = await (await (await ld.getFileHandle(`${laneId}.json`)).getFile()).text();
      overlay = JSON.parse(overlayText);
      const r = L.applyLane(fileText, overlay, laneId);
      const reg = L.slidesRegion(r.text);
      const key = SW.current() && SW.current().getAttribute("data-key");
      SW.stage.innerHTML = r.text.slice(reg.contentStart, reg.contentEnd);
      SW.expand(SW.stage);
      SW.refresh();
      const i = SW.slides().findIndex((s) => s.getAttribute("data-key") === key);
      if (i >= 0) SW.go(i);
      renderLanePicker();
      renderStatus();
    } catch (e) { toast(`Couldn't open lane ${laneId}: ${e.message}`); laneId = null; renderLanePicker(); }
  }

  // ── Build: every lane file, then the in-browser checks ───────────
  async function buildAll() {
    if (ops.length) await save();
    if (!dir) { toast("Connect the deck folder to build."); return; }
    try {
      const disk = await readFile(FILE);
      const n = await rebuildLanes(disk.text);
      const findings = await checks();
      panel.querySelector(".swe-checks").textContent = findings.length ? findings.join("\n") : "Checks: no content past the slide edges, nothing in the footer band.";
      status(`Built${n ? ` ${n} lane file${n === 1 ? "" : "s"}` : ""} · ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
    } catch (e) { toast("Build failed: " + e.message); }
  }
  async function checks() {
    const out = [], here = SW.index(), step = SW.step();
    for (let i = 0; i < SW.slides().length; i++) {
      SW.go(i, "end");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const m = SW.measure();
      if (m.overflow.length) out.push(`${m.key}: content past the slide edge (${m.overflow.slice(0, 2).map((o) => o.tag).join(", ")})`);
      const chrome = SW.current().querySelector(".sw-chrome");
      if (chrome) {
        const cr = chrome.getBoundingClientRect();
        const hit = Array.from(SW.current().querySelectorAll("p, li, h1, h2, h3, h4, span, td, th, div")).some((n) => {
          if (chrome.contains(n) || n.closest("aside") || n.closest("svg")) return false;
          if (!Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim())) return false;
          const r = n.getBoundingClientRect();
          return r.bottom > cr.top && r.top < cr.bottom && r.right > cr.left && r.left < cr.right;
        });
        if (hit) out.push(`${m.key}: text runs into the footer band`);
      }
    }
    SW.go(here, step);
    return out;
  }

  // ── Keys and clicks ───────────────────────────────────────────────
  function onKey(e) {
    if (!on) return;
    if (textEl) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); endText(false); }
      else if (e.key === "Enter" && !e.shiftKey && !/^(li|p|div|td|th|blockquote)$/.test(textEl.localName)) { e.preventDefault(); endText(true); }
      else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); doc.execCommand("insertLineBreak"); }
      e.stopPropagation();
      return;
    }
    if (SW.typing(e.target)) return;
    const cap = SW.capitalOf(e), mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); undoLast(); return; }
    if (mod || e.altKey) return;
    if (cap === "S") { e.preventDefault(); e.stopPropagation(); save(); return; }
    if (cap === "B") { e.preventDefault(); e.stopPropagation(); buildAll(); return; }
    if (cap === "E") { e.preventDefault(); e.stopPropagation(); toggle(false); return; }
    if (selected) {
      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) { e.preventDefault(); e.stopPropagation(); nudge(...moves[e.key]); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); removeElement(selected); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); select(null); return; }
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); startText(selected); return; }
    }
  }
  function onDblClick(e) {
    if (!on) return;
    const node = selectable(e.target);
    if (!node) return;
    e.preventDefault();
    startText(e.target.closest("svg") ? node : e.target);
  }
  function onClickCapture(e) { if (on && stageSection(e.target) && !(textEl && textEl.contains(e.target))) e.preventDefault(); }   // links don't navigate while editing
  async function onBarClick(e) {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    if (a === "connect") connect();
    else if (a === "save") save();
    else if (a === "build") buildAll();
    else if (a === "dup") duplicateSlide();
    else if (a === "copy") {
      const payload = JSON.stringify({ deck: FILE, lane: laneId, ops }, null, 2);
      try { await navigator.clipboard.writeText(payload); toast("Copied the unsaved edits. Paste them to Claude to apply."); } catch (err) { toast("Copy failed; the edits are in the console."); console.log(payload); }
    } else if (a === "discard") {
      if (!ops.length) { toast("Nothing to discard."); return; }
      ops = []; undo = []; try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* blocked */ }
      location.reload();
    } else if (a === "done") toggle(false);
    else if (a === "comment") addComment();
    else if (a === "pin") pin();
    else if (a === "reset") resetPosition();
    else if (a === "parent") { if (selected && selected.parentElement && !selected.parentElement.matches("#sw-slides > section")) select(selected.parentElement); }
    else if (a === "remove") removeElement(selected);
  }

  // ── On and off ────────────────────────────────────────────────────
  let built = false;
  function wire() {
    buildUi();
    SW.stage.addEventListener("pointerdown", onStageDown, true);
    SW.stage.addEventListener("dblclick", onDblClick, true);
    SW.stage.addEventListener("click", onClickCapture, true);
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("paste", onPaste, true);
    window.addEventListener("resize", drawBox);
    SW.on("layout", drawBox);
    SW.on("change", () => { if (on) { if (textEl) endText(true); select(null); renderPanel(); } });
    doc.addEventListener("sw-edit-toggle", () => toggle());
    window.addEventListener("beforeunload", (e) => { if (ops.length && !dir) { e.preventDefault(); e.returnValue = ""; } });
    built = true;
  }
  async function toggle(force) {
    const next = force === undefined ? !on : !!force;
    if (!built) wire();
    if (next === on) return;
    on = next;
    html.classList.toggle("sw-editing", on);
    if (on) {
      SW.builds(false);
      html.style.removeProperty("--sw-reserve-bottom");
      reservePanel();
      renderPanel();
      renderStatus();
      if (!dir) await restoreFolder(true);
      if (laneId) await showLane();
      offerDraft();
    } else {
      if (textEl) endText(true);
      select(null);
      html.style.removeProperty("--sw-reserve-bottom");
      SW.layout();
      doc.dispatchEvent(new CustomEvent("sw-reserve"));
      if (ops.length && dir) save();
    }
    doc.dispatchEvent(new CustomEvent("sw-edit-change", { detail: {} }));
  }
  function offerDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { d = null; }
    if (!d || !d.ops || !d.ops.length || ops.length || (d.lane || null) !== (laneId || null)) return;
    toast(`${d.ops.length} unsaved edit${d.ops.length === 1 ? "" : "s"} from ${new Date(d.at).toLocaleString()} weren't saved.`, [
      ["Save them now", async () => { ops = d.ops; undo = d.ops.map(() => () => {}); renderStatus(); await save(); if (!ops.length) location.reload(); }],
      ["Drop them", () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* blocked */ } }],
    ]);
  }

  window.SWEditor = {
    version: VERSION,
    toggle, isOn: () => on,
    slides: slidesForOverview, setHidden, setDeleted, reorder,
    lane: () => laneId,
    rebuild: buildAll,
    _test: { applyOpsToText, applyOpsToOverlay, addrOf, resolve, ops: () => ops, useFolder },
  };
  // A deck opened with ?edit (from a lane file, or after switching lanes) starts in the editor.
})();
