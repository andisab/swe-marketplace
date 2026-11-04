// serve.js — an optional local server for editing a deck in any browser.
//
//   node cli.js serve <deck-dir> [--port 47100] [--open]
//
// Serves the deck folder on http://127.0.0.1:<port>/ and gives the editor file access through
// /__sw/ (so Safari and Firefox can save, and Chrome needs no folder permission):
//   GET  /__sw/ping                  {"slideware": version}
//   GET  /__sw/editor.js             the editor bundle from the plugin
//   GET  /__sw/fs?path=<rel>         a file's text, with X-Last-Modified (&stat: only {lastModified})
//   PUT  /__sw/fs?path=<rel>         write a file (index.html, index-<lane>.html, lanes/*.json only)
//   GET  /__sw/ls?path=lanes         the folder's .json files
// Writes need the X-Slideware header (a cross-site page can't send it without a CORS preflight,
// which this server never answers), the Host must be this machine, and paths stay in the folder.
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const build = require("./build");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf", ".woff2": "font/woff2" };
const WRITABLE = /^(index(-[\w.-]+)?\.html|lanes\/[\w.-]+\.json)$/;

function serve(dir, { port = 47100, quiet = false } = {}) {
  dir = path.resolve(dir);
  const inside = (rel) => {
    const p = path.resolve(dir, rel || "");
    return p === dir || p.startsWith(dir + path.sep) ? p : null;
  };
  const server = http.createServer((req, res) => {
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(host)) { res.writeHead(403); return res.end("slideware: this server answers only on this machine"); }
    const u = new URL(req.url, `http://${req.headers.host}`);
    const send = (code, body, headers = {}) => { res.writeHead(code, { "cache-control": "no-store", ...headers }); res.end(body); };
    if (u.pathname === "/__sw/ping") return send(200, JSON.stringify({ slideware: build.RUNTIME_VERSION, dir }), { "content-type": "application/json" });
    if (u.pathname === "/__sw/editor.js") return send(200, build.editorBundle() || "", { "content-type": "text/javascript" });
    if (u.pathname === "/__sw/fs" || u.pathname === "/__sw/ls") {
      const rel = (u.searchParams.get("path") || "").replace(/\\/g, "/");
      const p = inside(rel);
      if (!p) return send(400, "bad path");
      if (u.pathname === "/__sw/ls") {
        if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return send(404, "[]", { "content-type": "application/json" });
        return send(200, JSON.stringify(fs.readdirSync(p).filter((f) => fs.statSync(path.join(p, f)).isFile())), { "content-type": "application/json" });
      }
      if (req.method === "GET") {
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return send(404, "not found");
        if (u.searchParams.has("stat")) return send(200, JSON.stringify({ lastModified: Math.round(fs.statSync(p).mtimeMs) }), { "content-type": "application/json" });
        return send(200, fs.readFileSync(p), { "content-type": "text/plain; charset=utf-8", "x-last-modified": String(Math.round(fs.statSync(p).mtimeMs)) });
      }
      if (req.method === "PUT") {
        if (req.headers["x-slideware"] !== "1") return send(403, "missing X-Slideware");
        if (!WRITABLE.test(rel)) return send(403, `slideware: ${rel} isn't a file the editor writes`);
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, Buffer.concat(chunks));
          send(200, JSON.stringify({ ok: true, lastModified: Math.round(fs.statSync(p).mtimeMs) }), { "content-type": "application/json" });
          if (!quiet) console.log(`saved ${rel}`);
        });
        return;
      }
      return send(405, "method not allowed");
    }
    // Static files from the deck folder.
    const p = inside(decodeURIComponent(u.pathname === "/" ? "index.html" : u.pathname.slice(1)));
    if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) return send(404, "not found");
    send(200, fs.readFileSync(p), { "content-type": TYPES[path.extname(p).toLowerCase()] || "application/octet-stream" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

module.exports = { serve };
