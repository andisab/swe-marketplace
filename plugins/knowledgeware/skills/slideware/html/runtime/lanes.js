// lanes.js — derive a lane's deck file from the base deck file and the lane's overlay.
//
// Runs in Node (the engine's `lanes` command) and in the browser (the editor rebuilds lane files
// on save), so it works on HTML text, never a DOM. A lane overlay (lanes/<id>.json):
//   {
//     "name": "Acme Investments",           shown in the lane switcher
//     "color": "#2F7DE1",                   optional; the lane's colour in the overview
//     "replace": [["Acme Corp", "Acme Investments"]],   text replacements: text in slides only,
//                                           never attributes, the assets or other regions
//     "overrides": [                        per element, by slide key and element id:
//       { "key": "s1-07", "id": "company", "html": "…", "from": "…" },     inner HTML
//       { "key": "s1-07", "id": "company", "attrs": { "style": "…" } },     attributes
//       { "key": "s1-09", "slide": "<section data-key=\"s1-09\">…</section>" }   a whole slide
//     ],
//     "figures": { "company-map": "company-map@acme-investments" },   figure swaps
//     "hidden": ["s1-12"], "shown": ["s1-40"]                         per-lane visibility
//   }
// `from` is the base's inner HTML when the override was made: if the base has changed since,
// the result lists the override as drifted so `check` can say so; it still applies.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SWLanes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Find an element's open tag and the end of its matching close tag inside html, from a match index.
  function elementAt(html, openIndex) {
    const open = /^<([\w:-]+)\b[^>]*?(\/?)>/.exec(html.slice(openIndex));
    if (!open) return null;
    const tag = open[1].toLowerCase(), openEnd = openIndex + open[0].length;
    const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/;
    if (open[2] === "/" || VOID.test(tag)) return { tag, start: openIndex, openEnd, closeStart: openEnd, end: openEnd, selfClosing: true };
    const re = new RegExp(`<${tag.replace(/[-:]/g, "\\$&")}\\b[^>]*?(/?)>|</${tag.replace(/[-:]/g, "\\$&")}\\s*>`, "gi");
    re.lastIndex = openEnd;
    let depth = 1, m;
    while ((m = re.exec(html))) {
      if (m[0][1] === "/") { if (--depth === 0) return { tag, start: openIndex, openEnd, closeStart: m.index, end: re.lastIndex }; }
      else if (m[1] !== "/") depth++;
    }
    return null;
  }
  function findById(html, id) {
    const re = new RegExp(`<[\\w:-]+\\b[^>]*\\sid=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
    const m = re.exec(html);
    return m ? elementAt(html, m.index) : null;
  }
  // The element at a path of element-child indices under the element starting at 0 (a section).
  // Comments, text and the contents of script and style don't count, as in the editor.
  function findByPath(html, path) {
    const scan = maskCode(html);
    let el = elementAt(scan, 0);
    for (const i of path || []) {
      if (!el || el.selfClosing) return null;
      const re = /<!--[\s\S]*?-->|<\/[^>]*>|<([a-zA-Z][\w:-]*)\b[^>]*>/g;
      re.lastIndex = el.openEnd;
      let n = -1, m, found = null;
      while ((m = re.exec(scan)) && m.index < el.closeStart) {
        if (!m[1]) continue;
        const child = elementAt(scan, m.index);
        if (!child) return null;
        if (++n === i) { found = child; break; }
        re.lastIndex = child.end;
      }
      el = found;
    }
    return el;
  }
  function setAttrs(openTag, attrs) {
    let t = openTag;
    for (const [k, v] of Object.entries(attrs)) {
      const re = new RegExp(`\\s${k.replace(/[-:]/g, "\\$&")}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, "i");
      const val = v === null || v === false ? "" : v === true ? ` ${k}` : ` ${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
      if (re.test(t)) t = t.replace(re, val);
      else if (val) t = t.replace(/\s*(\/?)>$/, `${val}$1>`);
    }
    return t;
  }
  // Apply text replacements to text outside tags (and outside <script>/<style>) only.
  function replaceText(html, pairs) {
    if (!pairs || !pairs.length) return html;
    const out = [];
    const re = /<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->|<[^>]*>/gi;
    let last = 0, m;
    const fix = (text) => pairs.reduce((t, [from, to]) => (from ? t.split(from).join(to) : t), text);
    while ((m = re.exec(html))) {
      out.push(fix(html.slice(last, m.index)), m[0]);
      last = re.lastIndex;
    }
    out.push(fix(html.slice(last)));
    return out.join("");
  }
  // The text with the contents of <script>, <style> and comments blanked out (same length, newlines
  // kept), so tag searches never match code or CSS that happens to mention a tag.
  function maskCode(text) {
    return text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)|(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)|<!--[\s\S]*?-->/gi,
      (m, so, sc, sx, to, tc, tx) => {
        const blank = (s) => s.replace(/[^\n]/g, " ");
        if (so) return so + blank(sc) + sx;
        if (to) return to + blank(tc) + tx;
        return blank(m);
      });
  }
  // The <main id="sw-slides"> region's content bounds.
  function slidesRegion(text) {
    const masked = maskCode(text);
    const open = /<main\b[^>]*\bid=["']sw-slides["'][^>]*>/i.exec(masked);
    if (!open) return null;
    const el = elementAt(masked, open.index);
    return el ? { contentStart: el.openEnd, contentEnd: el.closeStart } : null;
  }
  function sectionsIn(html) {
    const out = [];
    const re = /<section\b[^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
      const el = elementAt(html, m.index);
      if (!el) break;
      const key = (/\sdata-key=["']([^"']+)["']/i.exec(m[0]) || [])[1] || null;
      out.push({ key, ...el, open: m[0] });
      re.lastIndex = el.end;
    }
    return out;
  }

  // Build a lane's file text from the base text. Returns { text, changed: [keys], drifted: [...], missing: [...] }.
  function applyLane(baseText, overlay, laneId, lanesList, stamp) {
    overlay = overlay || {};
    const changed = new Set(), drifted = [], missing = [];
    const reg = slidesRegion(baseText);
    if (!reg) throw new Error("the deck has no #sw-slides region");
    let slidesHtml = baseText.slice(reg.contentStart, reg.contentEnd);
    // 1. Whole-slide and element overrides, per section, before replacements (so `from` matches the base).
    const bySlide = {};
    (overlay.overrides || []).forEach((o) => { if (o && o.key) (bySlide[o.key] = bySlide[o.key] || []).push(o); });
    const secs = sectionsIn(slidesHtml);
    let rebuilt = "", cursor = 0;
    const seenKeys = new Set();
    secs.forEach((s) => {
      rebuilt += slidesHtml.slice(cursor, s.start);
      let sec = slidesHtml.slice(s.start, s.end);
      const before = sec;
      seenKeys.add(s.key);
      for (const o of bySlide[s.key] || []) {
        if (o.slide) { sec = o.slide; continue; }
        const el = o.id ? findById(sec, o.id) : o.path ? findByPath(sec, o.path) : null;
        if (!el) { missing.push({ key: s.key, id: o.id || (o.path ? o.path.join("/") : null) }); continue; }
        if (o.from !== undefined && sec.slice(el.openEnd, el.closeStart) !== o.from) drifted.push({ key: s.key, id: o.id });
        let open = sec.slice(el.start, el.openEnd), inner = sec.slice(el.openEnd, el.closeStart);
        if (o.attrs) open = setAttrs(open, o.attrs);
        if (o.html !== undefined) inner = o.html;
        else if (o.text !== undefined) inner = String(o.text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
        sec = sec.slice(0, el.start) + open + (el.selfClosing ? "" : inner) + sec.slice(el.closeStart);
      }
      // 2. Text replacements, inside the slide only.
      sec = replaceText(sec, overlay.replace);
      // 3. Figure swaps.
      for (const [from, to] of Object.entries(overlay.figures || {})) {
        sec = sec.replace(new RegExp(`(\\sdata-figure-ref=["'])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(["'])`, "g"), `$1${to}$2`);
      }
      // 4. Visibility.
      let open = /^<section\b[^>]*>/i.exec(sec)[0];
      const newOpen0 = open;
      if ((overlay.hidden || []).includes(s.key)) open = setAttrs(open, { hidden: true });
      if ((overlay.shown || []).includes(s.key)) open = setAttrs(open, { hidden: null });
      if (sec !== before || open !== newOpen0) { changed.add(s.key); open = setAttrs(open, { "data-lane-changed": true }); }
      sec = open + sec.slice(newOpen0.length);
      rebuilt += sec;
      cursor = s.end;
    });
    rebuilt += slidesHtml.slice(cursor);
    Object.keys(bySlide).forEach((k) => { if (!seenKeys.has(k)) missing.push({ key: k, id: null }); });
    let text = baseText.slice(0, reg.contentStart) + rebuilt + baseText.slice(reg.contentEnd);
    // 5. Settings: which lane this file is, and the switcher's list.
    text = text.replace(/(<script\b[^>]*\bid=["']sw-deck["'][^>]*>)([\s\S]*?)(<\/script>)/i, (m, a, json, c) => {
      let cfg = {};
      try { cfg = JSON.parse(json || "{}"); } catch (e) { /* keep as is */ return m; }
      cfg.lane = laneId;
      if (lanesList) cfg.lanes = lanesList;
      if (overlay.name) cfg.laneName = overlay.name;
      if (stamp) cfg.laneSource = stamp;
      return a + "\n" + JSON.stringify(cfg, null, 2) + "\n" + c;
    });
    // 6. The page title names the lane.
    if (overlay.name) text = text.replace(/<title>([\s\S]*?)<\/title>/i, (m, t) => `<title>${t.trim()} · ${overlay.name.replace(/</g, "&lt;")}</title>`);
    text = text.replace(/(<html\b[^>]*?)(\s*>)/i, (m, a, b) => /\sdata-lane=/.test(a) ? m : `${a} data-lane="${laneId}"${b}`);
    return { text, changed: [...changed], drifted, missing };
  }

  // FNV-1a, 32 bits, as hex: the same in Node and the browser. Stamps a lane file with its sources.
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  }
  // The stamp for a lane file: the base deck's slides and settings plus the overlay.
  function sourceStamp(baseText, overlayText) {
    const reg = slidesRegion(baseText);
    const slides = reg ? baseText.slice(reg.contentStart, reg.contentEnd) : baseText;
    return hash(slides + "\u0000" + (overlayText || ""));
  }

  return { applyLane, replaceText, elementAt, findById, findByPath, setAttrs, sectionsIn, slidesRegion, maskCode, hash, sourceStamp };
});
