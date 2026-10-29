#!/usr/bin/env node
// serve-deck.js — serve a slideware HTML deck locally, with the two calls its review mode
// (review.js, E in the deck) needs to save and rebuild without leaving the browser.
//
//   node serve-deck.js [deck-dir] [--port 8010]
//
// Serves the deck directory on 127.0.0.1 only (it writes files and runs node, so never on
// another interface), and answers:
//   GET  /__status   { ok, slideware: true, dir }   — review.js looks for this to offer Shift+B
//   POST /__edits    body: the edits JSON            — written to <deck-dir>/edits.json
//   POST /__build    runs `node build-deck.js .` in the deck dir (which folds edits.json into
//                    slides.js first); { ok, code, output }. A body of { review: true } adds
//                    --review, so a deck built that way keeps its review mode across rebuilds.
// Anything else is a static file under the deck dir (index.html for /). No dependencies.

const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFile } = require("child_process");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf", ".mp4": "video/mp4", ".webm": "video/webm" };
const MAX_BODY = 5 * 1024 * 1024;
const BUILD_TIMEOUT = 120000;

function parseArgs(argv) {
  const out = { dir: process.cwd(), port: 8010 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" || argv[i] === "-p") out.port = Number(argv[++i]);
    else if (argv[i] === "--help" || argv[i] === "-h") { console.log("node serve-deck.js [deck-dir] [--port 8010]"); process.exit(0); }
    else out.dir = path.resolve(argv[i]);
  }
  if (!Number.isInteger(out.port) || out.port < 0 || out.port > 65535) { console.error("--port must be a port number"); process.exit(2); }
  return out;
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createServer(dir) {
  const editsPath = path.join(dir, "edits.json");
  let building = null;   // one build at a time; a second request waits for it

  function runBuild(review) {
    if (building) return building;
    building = new Promise((resolve) => {
      execFile(process.execPath, ["build-deck.js", ".", ...(review ? ["--review"] : [])], { cwd: dir, timeout: BUILD_TIMEOUT, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: "" } }, (err, stdout, stderr) => {
        building = null;
        const output = [stdout, stderr].filter(Boolean).join("\n");
        if (err) resolve({ ok: false, code: typeof err.code === "number" ? err.code : 1, output: output || err.message });
        else resolve({ ok: true, code: 0, output });
      });
    });
    return building;
  }

  function serveFile(req, res, urlPath) {
    let rel;
    try { rel = decodeURIComponent(urlPath); } catch (e) { return json(res, 400, { ok: false, error: "bad path" }); }
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(dir, rel));
    if (file !== dir && !file.startsWith(dir + path.sep)) return json(res, 403, { ok: false, error: "outside the deck directory" });
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        if (!err && st.isDirectory()) return serveFile(req, res, rel.replace(/\/?$/, "/index.html"));
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("not found: " + rel);
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (url.pathname === "/__status") return json(res, 200, { ok: true, slideware: true, dir, hasEdits: fs.existsSync(editsPath), hasBuilder: fs.existsSync(path.join(dir, "build-deck.js")) });
      if (url.pathname === "/__edits") {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST the edits JSON" });
        const body = await readBody(req, MAX_BODY);
        let edits;
        try { edits = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: "the body isn't JSON" }); }
        if (!edits || typeof edits !== "object" || !edits.slides || typeof edits.slides !== "object") return json(res, 400, { ok: false, error: "expected { slides: { … } }" });
        fs.writeFileSync(editsPath, JSON.stringify(edits, null, 2) + "\n");
        const d = edits.deck || {};
        const n = Object.values(edits.slides).reduce((t, s) => t + Object.keys(s || {}).length, 0) + Object.keys(d.hidden || {}).length + (d.deleted || []).length + (d.order ? 1 : 0);
        console.log(`${new Date().toLocaleTimeString()}  saved edits.json (${n} ${n === 1 ? "entry" : "entries"})`);
        return json(res, 200, { ok: true, path: "edits.json", entries: n });
      }
      if (url.pathname === "/__build") {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST to rebuild" });
        if (!fs.existsSync(path.join(dir, "build-deck.js"))) return json(res, 400, { ok: false, error: "no build-deck.js in " + dir });
        const body = await readBody(req, MAX_BODY);
        let opts = {};
        if (body.trim()) { try { opts = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: "the body isn't JSON" }); } }
        console.log(`${new Date().toLocaleTimeString()}  rebuilding${opts.review ? " (--review)" : ""}…`);
        const result = await runBuild(opts && opts.review === true);
        console.log(result.output.trim().split("\n").map((l) => "    " + l).join("\n"));
        console.log(`${new Date().toLocaleTimeString()}  ${result.ok ? "built" : "build failed (exit " + result.code + ")"}`);
        return json(res, result.ok ? 200 : 500, result);
      }
      if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { ok: false, error: "method not allowed" });
      serveFile(req, res, url.pathname);
    } catch (e) {
      json(res, 500, { ok: false, error: e && e.message ? e.message : String(e) });
    }
  });
}

function main() {
  const { dir, port } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(dir, "index.html"))) console.warn(`note: no index.html in ${dir} yet; build the deck first (node build-deck.js .)`);
  const server = createServer(dir);
  server.listen(port, "127.0.0.1", () => {
    const p = server.address().port;
    console.log(`Serving ${dir}`);
    console.log(`  http://127.0.0.1:${p}/          the deck (E to review, Shift+B to rebuild)`);
    console.log(`  POST /__edits → edits.json · POST /__build → node build-deck.js .  · Ctrl+C to stop`);
  });
  server.on("error", (e) => { console.error(e.code === "EADDRINUSE" ? `port ${port} is taken; pass --port <n>` : e.message); process.exit(1); });
}

if (require.main === module) main();
module.exports = { createServer, parseArgs };
