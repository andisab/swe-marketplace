// cdp.js — a zero-dependency headless Chrome driver over the DevTools protocol.
//
// Used by the slideware engine for screenshots, PDFs, measurement and checks. It needs Node 22+
// (global WebSocket) and a Chromium browser: the CHROME env var, then Google Chrome, Chromium,
// Edge or Brave in their usual places, then Chrome for Testing from the Playwright cache.
//
//   const { launch } = require("./cdp");
//   const browser = await launch();
//   const page = await browser.newPage({ width: 1280, height: 720 });
//   await page.goto("file:///…/index.html");
//   const png = await page.screenshot();            // Buffer
//   const value = await page.evaluate("document.title");
//   await browser.close();
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const home = os.homedir();
  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"],
    win32: [
      path.join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    ],
  }[process.platform] || [];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Chrome for Testing from the Playwright cache, newest first.
  const cache = process.platform === "darwin" ? path.join(home, "Library/Caches/ms-playwright")
    : process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "ms-playwright") : path.join(home, ".cache/ms-playwright");
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const d of dirs) {
      const bin = [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome", "chrome-linux64/chrome", "chrome-win/chrome.exe", "chrome-win64/chrome.exe",
      ].map((p) => path.join(cache, d, p)).find((p) => fs.existsSync(p));
      if (bin) return bin;
    }
  }
  return null;
}

async function launch({ executable = findChrome(), args = [] } = {}) {
  if (!executable) throw new Error("No Chromium browser found. Install Google Chrome, or set CHROME to a Chromium binary.");
  if (typeof WebSocket !== "function") throw new Error("Node 22 or newer is needed (global WebSocket).");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "slideware-chrome-"));
  const proc = spawn(executable, [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
    "--force-color-profile=srgb", "--font-render-hinting=none", ...args,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = "";
    const timer = setTimeout(() => reject(new Error(`Chrome didn't start in time.\n${err.slice(-500)}`)), 20000);
    proc.stderr.on("data", (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code}).\n${err.slice(-500)}`)); });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("Couldn't connect to Chrome.")); });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? `: ${msg.error.data}` : ""}`)); else resolve(msg.result);
    } else for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const waitFor = (sessionId, method, predicate = () => true, timeout = 30000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { listeners.delete(fn); reject(new Error(`Timed out waiting for ${method}`)); }, timeout);
    const fn = (msg) => {
      if (msg.method === method && msg.sessionId === sessionId && predicate(msg.params)) { clearTimeout(timer); listeners.delete(fn); resolve(msg.params); }
    };
    listeners.add(fn);
  });

  async function newPage({ width = 1280, height = 720, scale = 1 } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    await s("Page.enable");
    await s("Runtime.enable");
    const consoleMessages = [];
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Runtime.consoleAPICalled") consoleMessages.push({ type: msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ") });
      if (msg.method === "Runtime.exceptionThrown") consoleMessages.push({ type: "exception", text: msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text });
    });
    const setViewport = (w, h, sc = scale) => s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: sc, mobile: false });
    await setViewport(width, height, scale);
    const page = {
      send: s,
      console: consoleMessages,
      setViewport,
      async goto(url, { waitUntil = "load", timeout = 30000 } = {}) {
        const loaded = waitFor(sessionId, waitUntil === "load" ? "Page.loadEventFired" : "Page.domContentEventFired", () => true, timeout);
        const res = await s("Page.navigate", { url });
        if (res.errorText) throw new Error(`Navigation to ${url} failed: ${res.errorText}`);
        await loaded;
        await page.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
      },
      async evaluate(expression, { awaitPromise = true } = {}) {
        const src = typeof expression === "function" ? `(${expression})()` : expression;
        const r = await s("Runtime.evaluate", { expression: src, awaitPromise, returnByValue: true, userGesture: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async screenshot({ clip, format = "png", quality } = {}) {
        const r = await s("Page.captureScreenshot", { format, ...(quality ? { quality } : {}), ...(clip ? { clip: { ...clip, scale: clip.scale || 1 } } : {}), captureBeyondViewport: !!clip });
        return Buffer.from(r.data, "base64");
      },
      async pdf(options = {}) {
        const r = await s("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, ...options });
        return Buffer.from(r.data, "base64");
      },
      async close() { await send("Target.closeTarget", { targetId }).catch(() => {}); },
    };
    return page;
  }

  return {
    executable,
    newPage,
    async close() {
      try { await send("Browser.close"); } catch (e) { /* already gone */ }
      ws.close();
      await new Promise((r) => { if (proc.exitCode !== null) r(); else { proc.once("exit", r); setTimeout(() => { proc.kill("SIGKILL"); r(); }, 3000); } });
      fs.rmSync(profile, { recursive: true, force: true });
    },
  };
}

module.exports = { launch, findChrome };
