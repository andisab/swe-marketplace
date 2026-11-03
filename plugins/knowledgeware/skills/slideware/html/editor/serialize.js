// serialize.js — the editor's HTML serializer and runtime-state cleaner.
//
// The browser's own serializer rewrites markup it didn't need to: <path/> becomes <path></path>,
// entities are expanded, quotes change. This one is canonical and stable: run it twice and nothing
// changes. Rules: attributes keep their order and use double quotes; an empty value is written as a
// bare name (hidden, data-divider); void HTML elements have no closing tag; an SVG or MathML element
// with no children closes itself (<path …/>); text escapes only &, < and > (and NBSP as &nbsp;).
//
// clean(el) strips what the runtime adds to the live page, so it never reaches the file: classes
// starting sw-, data-sw-* attributes, --sw-* custom properties, contenteditable, generated footers
// ([data-sw-gen]), and expanded figures (collapsed back to their empty placeholder).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SWSerialize = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const XHTML = "http://www.w3.org/1999/xhtml";
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const RAW = new Set(["script", "style"]);

  const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
  const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/ /g, "&nbsp;");

  function serializeNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode;
      return p && p.nodeType === 1 && RAW.has(p.localName) ? n.data : escText(n.data);
    }
    if (n.nodeType === 8) return `<!--${n.data}-->`;
    if (n.nodeType === 11) return serializeChildren(n);
    if (n.nodeType !== 1) return "";
    const tag = n.namespaceURI === XHTML ? n.localName : n.tagName;
    let s = "<" + tag;
    for (const a of Array.from(n.attributes)) s += a.value === "" ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`;
    if (n.namespaceURI === XHTML && VOID.has(n.localName)) return s + ">";
    const kids = n.localName === "template" && n.content ? n.content : n;
    if (n.namespaceURI !== XHTML && !kids.firstChild) return s + "/>";
    return s + ">" + serializeChildren(kids) + `</${tag}>`;
  }
  function serializeChildren(n) {
    let s = "";
    for (let c = n.firstChild; c; c = c.nextSibling) s += serializeNode(c);
    return s;
  }

  function cleanStyle(el) {
    const st = el.getAttribute("style");
    if (st === null) return;
    const kept = st.split(";").map((d) => d.trim()).filter((d) => d && !/^--sw-/.test(d));
    if (kept.length) el.setAttribute("style", kept.join("; ")); else el.removeAttribute("style");
  }
  function cleanOne(el) {
    if (el.classList && el.classList.length) {
      Array.from(el.classList).filter((c) => /^sw-/.test(c)).forEach((c) => el.classList.remove(c));
      if (!el.classList.length) el.removeAttribute("class");
    }
    const expanded = el.getAttribute("data-sw-expanded");
    if (expanded !== null) {
      if (el.localName === "img") { if (/\bsrc\b/.test(expanded)) el.removeAttribute("src"); }
      else { while (el.firstChild) el.removeChild(el.firstChild); expanded.split(/\s+/).filter(Boolean).forEach((a) => el.removeAttribute(a)); }
    }
    for (const a of Array.from(el.attributes)) if (/^data-sw-/.test(a.name) || a.name === "contenteditable") el.removeAttribute(a.name);
    cleanStyle(el);
  }
  // Strip runtime state from an element and everything inside it (in place; pass a clone).
  function clean(el) {
    el.querySelectorAll("[data-sw-gen]").forEach((g) => g.remove());
    cleanOne(el);
    el.querySelectorAll("*").forEach((d) => { if (d.isConnected || d.parentNode) cleanOne(d); });
    return el;
  }
  // The clean inner HTML of a live element.
  function cleanInner(el) { return serializeChildren(clean(el.cloneNode(true))); }
  function cleanOuter(el) { return serializeNode(clean(el.cloneNode(true))); }

  return { serializeNode, serializeChildren, clean, cleanInner, cleanOuter, escText, escAttr };
});
