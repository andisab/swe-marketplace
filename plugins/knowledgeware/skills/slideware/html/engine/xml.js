// xml.js — a small, tolerant XML reader for OOXML parts (well-formed by construction).
//
//   parse(text) → { name, attrs, children: [nodes | strings] }   (the document element)
//   helpers: kids(n, name), kid(n, name), find(n, name) (deep), text(n), attr(n, name)
// Names keep their prefixes (a:p, p:sp). Entities are decoded; CDATA is kept as text.
"use strict";

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[k];
  });
}

function parse(text) {
  const root = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.children.push(m[1]);
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const attrs = {};
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
      const node = { name: m[3], attrs, children: [] };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined && m[6].trim()) top.children.push(decode(m[6]));
    else if (m[6] !== undefined && stack.length > 1 && /^(a:t|t)$/.test(top.name)) top.children.push(decode(m[6]));   // spaces inside <a:t>
  }
  return root.children.find((c) => typeof c === "object") || null;
}
const isNode = (c) => c && typeof c === "object";
const kids = (n, name) => (n ? n.children.filter((c) => isNode(c) && (!name || c.name === name)) : []);
const kid = (n, name) => kids(n, name)[0] || null;
function find(n, name, out = []) {
  if (!n) return out;
  for (const c of n.children) if (isNode(c)) { if (c.name === name) out.push(c); find(c, name, out); }
  return out;
}
const first = (n, name) => find(n, name)[0] || null;
function text(n) { return !n ? "" : n.children.map((c) => (typeof c === "string" ? c : text(c))).join(""); }
const attr = (n, name, def) => (n && n.attrs[name] !== undefined ? n.attrs[name] : def);

module.exports = { parse, kids, kid, find, first, text, attr, decode };
