// loader.js — loads the slideware editor from the plugin when E is pressed.
//
// The engine writes this file into every deck as <script id="sw-loader" data-editor="…">, where
// data-editor is the editor's file:// URL in the plugin's persistent data folder, stamped by
// `new` and `refresh`. Nothing loads until E:
//   - a deck served from this machine (http://127.0.0.1 or localhost, e.g. by the plugin's server)
//     loads /__sw/editor.js from that server;
//   - a deck opened as a file loads the stamped editor file;
//   - anywhere else, or when the file isn't there (a recipient's machine), E shows a short note.
// A lane file (<html data-lane>) is derived from index.html, so E opens index.html in that lane.
(function () {
  "use strict";
  const SW = window.SW;
  if (!SW) return;
  const me = document.currentScript;
  const stamped = me && me.getAttribute("data-editor");
  let loading = false;

  function note(text) {
    let el = document.querySelector(".sw-loader-note");
    if (!el) {
      el = document.createElement("div");
      el.className = "sw-loader-note";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99;max-width:min(560px,90vw);padding:10px 16px;" +
        "border-radius:10px;background:#1A1A18;color:#FAFAF8;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)";
      document.body.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.remove(), 6000);
  }
  function load() {
    if (window.SWEditor) { window.SWEditor.toggle(); return; }
    const lane = document.documentElement.getAttribute("data-lane");
    if (lane) {   // a derived lane file: edit the base deck in this lane's view
      const u = new URL("index.html", location.href);
      u.searchParams.set("edit", "");
      u.searchParams.set("lane", lane);
      u.hash = location.hash;
      location.href = u.href.replace(/edit=(&|$)/, "edit$1");
      return;
    }
    if (loading) return;
    const local = /^https?:$/.test(location.protocol) && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
    const src = local ? "/__sw/editor.js" : location.protocol === "file:" ? stamped : null;
    if (!src) { note("This deck can be viewed and presented here. Editing needs the knowledgeware plugin on the deck owner's machine."); return; }
    loading = true;
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { loading = false; if (window.SWEditor) window.SWEditor.toggle(true); };
    s.onerror = () => { loading = false; note("The editor wasn't found. With the knowledgeware plugin installed, ask Claude to refresh this deck, then press E again."); };
    document.head.appendChild(s);
  }
  SW.key({ key: "E", desc: "Edit the deck", last: true, note: "Edit requires knowledgeware plugin install.",
    href: "https://github.com/andisab/swe-marketplace/blob/main/plugins/knowledgeware/README.md", linkText: "github.com/andisab/swe-marketplace" }, load);
  SW.ready(() => { if (new URLSearchParams(location.search).has("edit")) load(); });
})();
