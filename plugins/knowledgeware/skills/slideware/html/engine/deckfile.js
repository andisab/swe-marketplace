// deckfile.js — read and splice the regions of a slideware deck file (index.html).
//
// A deck is one HTML file with fixed regions, each found by its id:
//   <script type="application/json" id="sw-deck">   deck settings (title, footer, sessions, lanes, spec, …)
//   <style id="sw-theme" data-brand data-brand-hash> the brand, copied from brandware; tools replace it whole
//   <style id="sw-deck-css">                         the deck's own CSS
//   <script id="sw-runtime" data-version>            runtime + presenter, from the plugin
//   <script id="sw-loader" data-editor>              loads the editor on E
//   <main id="sw-slides">                            the slides: <section data-key> … </section>
//   <template id="sw-assets">                        figures (data-figure) and images (data-asset)
// Splicing one region leaves every other byte of the file as it was.
"use strict";

const REGION_TAGS = {
  "sw-deck": "script", "sw-theme": "style", "sw-deck-css": "style", "sw-runtime": "script",
  "sw-loader": "script", "sw-slides": "main", "sw-assets": "template",
};

// The region with this id: { id, tag, start, end, openStart, openEnd, closeStart, attrs, content }.
// start..end spans the whole element; openEnd..closeStart is its content.
const { maskCode } = require("../runtime/lanes");
let maskCache = { text: null, masked: null };
function masked(text) {
  if (maskCache.text !== text) maskCache = { text, masked: maskCode(text) };
  return maskCache.masked;
}

function region(text, id) {
  const tag = REGION_TAGS[id];
  if (!tag) throw new Error(`unknown region ${id}`);
  const src = text;
  text = masked(src);   // search tags outside code and comments; slice content from the real text
  const open = new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i").exec(text);
  if (!open) return null;
  const openStart = open.index, openEnd = open.index + open[0].length;
  let closeStart;
  if (tag === "script" || tag === "style") {
    closeStart = text.toLowerCase().indexOf(`</${tag}`, openEnd);
  } else {
    // count nested tags of the same name
    const re = new RegExp(`<${tag}\\b|</${tag}\\s*>`, "gi");
    re.lastIndex = openEnd;
    let depth = 1, m;
    closeStart = -1;
    while ((m = re.exec(text))) {
      if (m[0][1] === "/") { if (--depth === 0) { closeStart = m.index; break; } } else depth++;
    }
  }
  if (closeStart < 0) throw new Error(`region ${id} has no closing </${tag}>`);
  const end = text.indexOf(">", closeStart) + 1;
  return { id, tag, start: openStart, end, openStart, openEnd, closeStart, attrs: parseAttrs(src.slice(openStart, openEnd)), content: src.slice(openEnd, closeStart) };
}

function parseAttrs(openTag) {
  const attrs = {};
  const body = openTag.replace(/^<[\w-]+/, "").replace(/\/?>$/, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(body))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[k];
  });
}
const escAttr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function openTag(tag, attrs) {
  return `<${tag}` + Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true || v === "" ? ` ${k}` : ` ${k}="${escAttr(v)}"`)).join("") + ">";
}

// Replace a region's content (and optionally its attributes); returns the new text.
function spliceRegion(text, id, content, attrs) {
  const r = region(text, id);
  if (!r) throw new Error(`the deck has no ${id} region`);
  const open = attrs ? openTag(r.tag, { ...attrs, id }) : text.slice(r.openStart, r.openEnd);
  return text.slice(0, r.openStart) + open + content + text.slice(r.closeStart);
}

// Make inline script content safe: a literal "</script" would end the element early.
function safeScript(js) { return js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--"); }

// Top-level <section …>…</section> elements in a piece of HTML, with their positions.
function sections(html, offset = 0) {
  const out = [];
  const re = /<section\b[^>]*>|<\/section\s*>/gi;
  const scan = maskCode(html);
  let depth = 0, start = -1, open = null, m;
  while ((m = re.exec(scan))) {
    if (m[0][1] !== "/") {
      if (depth === 0) { start = m.index; open = html.slice(m.index, m.index + m[0].length); }
      depth++;
    } else if (depth > 0 && --depth === 0) {
      const end = re.lastIndex;
      const attrs = parseAttrs(open);
      out.push({ key: attrs["data-key"] || null, attrs, start: offset + start, end: offset + end, text: html.slice(start, end), openTag: open });
    }
  }
  return out;
}

// The deck at a glance: regions, settings, slides with their line ranges.
function readDeck(text) {
  const regions = {};
  for (const id of Object.keys(REGION_TAGS)) regions[id] = region(text, id);
  let config = {}, configError = null;
  if (regions["sw-deck"]) {
    try { config = JSON.parse(regions["sw-deck"].content || "{}"); } catch (e) { configError = e.message; }
  }
  const lineAt = lineIndex(text);
  const slides = regions["sw-slides"] ? sections(regions["sw-slides"].content, regions["sw-slides"].openEnd).map((s) => ({
    ...s,
    hidden: "hidden" in s.attrs,
    title: titleOf(s.text),
    lines: [lineAt(s.start), lineAt(s.end)],
  })) : [];
  return { text, regions, config, configError, slides };
}
function titleOf(sectionHtml) {
  const m = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(sectionHtml);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
}
function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (pos) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
}

// Named items in the asset template: figures and images.
function assets(text) {
  const r = region(text, "sw-assets");
  if (!r) return [];
  const out = [];
  const re = /<([\w:-]+)\b[^>]*\bdata-(figure|asset)=["']([^"']+)["'][^>]*>/gi;
  const scan = maskCode(r.content);
  let m;
  while ((m = re.exec(scan))) out.push({ kind: m[2], name: m[3], tag: m[1].toLowerCase(), at: r.openEnd + m.index });
  return out;
}

module.exports = { REGION_TAGS, region, spliceRegion, parseAttrs, openTag, escAttr, escText, decodeEntities, safeScript, sections, readDeck, assets, titleOf };
