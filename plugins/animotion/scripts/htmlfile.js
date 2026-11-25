// htmlfile.js — the animotion parts of an HTML file: the inlined runtime region and the <am-scene> elements.
//
// The runtime lives in one region, <script id="am-runtime" data-version="…">, placed before </body>. It is the only
// thing animotion writes into a file; everything else (the scenes) is the author's. Splicing it leaves every other
// byte as it was, so it sits safely beside other tools' regions (slideware's #sw-runtime and friends).
"use strict";
const fs = require("fs");
const path = require("path");

const RUNTIME = path.join(__dirname, "..", "runtime", "animotion.js");
const runtimeJs = () => fs.readFileSync(RUNTIME, "utf8");
const runtimeVersion = () => (/const VERSION = "([^"]+)"/.exec(runtimeJs()) || [])[1] || "0";
// A script's text must not contain "</script" (it would end the element early).
const safeScript = (js) => js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

// Blank out comments and <script>/<style>/<template> bodies with spaces, so tag searches can't match inside them
// (offsets stay the same). Templates stay open: scenes live inside them in slideware's asset block.
function mask(text, { templates = false } = {}) {
  let out = text.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
  out = out.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, tag, body, close) => open + " ".repeat(body.length) + close);
  if (templates) out = out.replace(/(<template\b[^>]*>)([\s\S]*?)(<\/template\s*>)/gi, (m, open, body, close) => open + " ".repeat(body.length) + close);
  return out;
}

function runtimeRegion(text) {
  const m = mask(text);
  const open = /<script\b[^>]*\bid=["']am-runtime["'][^>]*>/i.exec(m);
  if (!open) return null;
  const closeStart = m.toLowerCase().indexOf("</script", open.index + open[0].length);
  if (closeStart < 0) throw new Error("the am-runtime script has no closing </script>");
  const end = m.indexOf(">", closeStart) + 1;
  const version = (/data-version=["']([^"']*)["']/.exec(open[0]) || [])[1] || "";
  return { start: open.index, end, version, content: text.slice(open.index + open[0].length, closeStart) };
}

// The page's kit: <template id="am-kit" data-source="…">, shared CSS and SVG symbols stamped into every scene.
function kitRegion(text) {
  const m = mask(text);
  const open = /<template\b[^>]*\bid=["']am-kit["'][^>]*>/i.exec(m);
  if (!open) return null;
  let depth = 1, i = open.index + open[0].length;
  const re = /<template\b|<\/template\s*>/gi;
  re.lastIndex = i;
  let t;
  while ((t = re.exec(m))) { if (t[0][1] === "/") { if (--depth === 0) break; } else depth++; }
  if (!t) throw new Error("the am-kit template has no closing </template>");
  return { start: open.index, end: t.index + t[0].length, content: text.slice(open.index + open[0].length, t.index) };
}
// Insert, refresh or remove the kit from a kit file (HTML: a <style> and any <svg> of <symbol>s).
function setKit(text, kitHtml, source) {
  const r = kitRegion(text);
  if (kitHtml === null) return r ? { text: text.slice(0, r.start) + text.slice(r.end).replace(/^\n/, ""), action: "removed" } : { text, action: "none" };
  const block = `<template id="am-kit" data-source="${String(source).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">\n${kitHtml.trim()}\n</template>`;
  if (r) return r.content.trim() === kitHtml.trim() ? { text, action: "current" } : { text: text.slice(0, r.start) + block + text.slice(r.end), action: "refreshed" };
  const m = mask(text), rt = runtimeRegion(text), close = m.toLowerCase().lastIndexOf("</body");
  const at = rt ? rt.start : close < 0 ? text.length : close;
  return { text: text.slice(0, at) + block + "\n" + text.slice(at), action: "added" };
}

// Insert or refresh the runtime; remove it when the file has no scene. Returns { text, action }.
function inline(text, { remove = false } = {}) {
  const r = runtimeRegion(text);
  const hasScene = scenes(text).length > 0;
  if (remove || !hasScene) {
    if (!r) return { text, action: "none" };
    let s = r.start, e = r.end;
    while (s > 0 && text[s - 1] === " ") s--;
    if (text[e] === "\n") e++;
    return { text: text.slice(0, s) + text.slice(e), action: "removed" };
  }
  const block = `<script id="am-runtime" data-version="${runtimeVersion()}">\n${safeScript(runtimeJs()).trimEnd()}\n</script>`;
  if (r) {
    if (r.version === runtimeVersion() && r.content.trim() === safeScript(runtimeJs()).trim()) return { text, action: "current" };
    return { text: text.slice(0, r.start) + block + text.slice(r.end), action: "refreshed" };
  }
  const m = mask(text);
  const close = m.toLowerCase().lastIndexOf("</body");
  if (close < 0) return { text: text.replace(/\s*$/, "\n") + block + "\n", action: "added" };
  return { text: text.slice(0, close) + block + "\n" + text.slice(close), action: "added" };
}

function attrs(openTag) {
  const out = {};
  const body = openTag.replace(/^<[\w-]+/, "").replace(/\/?>$/, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(body))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}
const lineOf = (text, i) => text.slice(0, i).split("\n").length;

// Every <am-scene> in the file (also inside templates, such as slideware's asset block), with its parts.
function scenes(text) {
  const m = mask(text);
  const out = [];
  const re = /<am-scene\b[^>]*>/gi;
  let o;
  while ((o = re.exec(m))) {
    const close = m.toLowerCase().indexOf("</am-scene", o.index);
    if (close < 0) { out.push({ index: out.length, line: lineOf(text, o.index), attrs: attrs(text.slice(o.index, o.index + o[0].length)), error: "no closing </am-scene>" }); continue; }
    const inner = text.slice(o.index + o[0].length, close);
    const tpl = /<template\b[^>]*>([\s\S]*)<\/template\s*>/i.exec(inner);
    const code = [];
    const codeRe = /<script\b[^>]*type=["']text\/animotion["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
    let c;
    while ((c = codeRe.exec(tpl ? tpl[1] : ""))) code.push(c[1]);
    const cues = [...inner.replace(/<template\b[\s\S]*<\/template\s*>/i, "").matchAll(/<am-cue\b[^>]*>/gi)].map((x) => attrs(x[0]));
    out.push({
      index: out.length, line: lineOf(text, o.index), start: o.index, attrs: attrs(text.slice(o.index, o.index + o[0].length)),
      template: tpl ? tpl[1] : null, code: code.join("\n"), cues,
    });
  }
  return out;
}

// AM.scene("name", …) definitions anywhere in the file's scripts.
function namedDefinitions(text) {
  return new Set([...text.matchAll(/AM\.scene\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]));
}

const isSlideware = (text) => /<main\b[^>]*\bid=["']sw-slides["']/i.test(text);

module.exports = { kitRegion, setKit, RUNTIME, runtimeJs, runtimeVersion, safeScript, mask, runtimeRegion, inline, scenes, namedDefinitions, attrs, isSlideware, lineOf };
