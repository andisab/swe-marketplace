// loader.js — loads the slideware editor from the plugin when E is pressed.
//
// The engine writes this file into every deck as <script id="sw-loader" data-editor="…">, where
// data-editor is the editor's file:// URL in the plugin's persistent data folder, stamped by
// `new` and `refresh`. Nothing loads until E:
//   - a deck served from this machine (http://127.0.0.1 or localhost, e.g. by the plugin's server)
//     loads /__sw/editor.js from that server;
//   - a deck opened as a file loads the stamped editor file;
//   - anywhere else, or when the file isn't there (a recipient's machine), E shows how to install
//     the plugin and what to do next, until closed.
// A lane file (<html data-lane>) is derived from index.html, so E opens index.html in that lane.
(function () {
  "use strict";
  const SW = window.SW;
  if (!SW) return;
  const me = document.currentScript;
  const stamped = me && me.getAttribute("data-editor");
  let loading = false;

  // Shown when E can't load the editor: what to install and what to do next. Stays until closed.
  const GUIDE = "https://github.com/andisab/swe-marketplace/blob/main/plugins/knowledgeware/README.md";
  const INSTALL = "/plugin install knowledgeware --marketplace andisab/swe-marketplace";
  function installCard(hosted) {
    let el = document.querySelector(".sw-install");
    if (el) { el.remove(); return; }
    el = document.createElement("div");
    el.className = "sw-install";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Editing needs the knowledgeware plugin");
    el.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99;width:min(520px,92vw);box-sizing:border-box;padding:16px 18px 14px;" +
      "border-radius:12px;background:#1A1A18;color:#FAFAF8;font:13px/1.5 system-ui,sans-serif;box-shadow:0 10px 32px rgba(0,0,0,.32);text-align:left";
    const h = (tag, text, css) => { const e = document.createElement(tag); if (text) e.textContent = text; if (css) e.style.cssText = css; return e; };
    const close = h("button", "×", "all:unset;position:absolute;right:12px;top:8px;cursor:pointer;font-size:20px;line-height:1;color:#B9B9B2");
    close.setAttribute("aria-label", "Close");
    const title = h("div", "Editing needs the knowledgeware plugin", "font-weight:600;font-size:14px;margin:0 22px 6px 0");
    const line = h("div", null, "color:#D4D2CC");
    if (hosted) line.append(document.createTextNode("Open the file on a computer with the plugin to edit it. "));
    const code = h("code", INSTALL, "display:block;width:fit-content;max-width:100%;margin:5px 0;padding:3px 8px;border-radius:5px;background:#2A2A27;font:12px ui-monospace,Menlo,monospace;color:#FAFAF8;white-space:nowrap;overflow-x:auto");
    const a = h("a", "README", "color:#9FC3FF");
    a.href = GUIDE; a.target = "_blank"; a.rel = "noopener";
    line.append(document.createTextNode("Install it in Claude Code:"), code, document.createTextNode("See the "), a, document.createTextNode(" for details."));
    el.append(close, title, line);
    const dismiss = () => { el.remove(); document.removeEventListener("keydown", onEsc, true); };
    const onEsc = (e) => { if (e.key === "Escape") { e.stopPropagation(); dismiss(); } };
    close.addEventListener("click", dismiss);
    document.addEventListener("keydown", onEsc, true);
    document.body.appendChild(el);
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
    if (!src) { installCard(true); return; }
    loading = true;
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { loading = false; if (window.SWEditor) window.SWEditor.toggle(true); };
    s.onerror = () => { loading = false; s.remove(); installCard(false); };
    document.head.appendChild(s);
  }
  SW.key({ key: "E", desc: "Edit the deck", last: true, note: "Edit requires knowledgeware plugin install.", href: GUIDE, linkWord: "knowledgeware" }, load);
  SW.ready(() => { if (new URLSearchParams(location.search).has("edit")) load(); });
})();
