// check.js — everything worth knowing about a deck before it ships.
//
// check(file) reads the deck and reports, as lines grouped into errors, warnings and info:
//   - the regions, the settings JSON, every slide's key (present, unique), cue values
//   - figure and image references that resolve, assets nothing uses, figures whose <style> leaks
//   - the pacing summary and the hidden slides
//   - the brand tag against brandware (stale or not), the runtime against the plugin
//   - the spec page and how many slides name the section they teach (for the librarian)
//   - deck-plan.md against the deck
//   - lanes: overlays that parse, overrides that still match, lane files that are current
// render(file) adds what only a browser can measure: overflow past the slide, the footer band,
// script errors. Both return { errors, warnings, info }.
"use strict";
const fs = require("fs");
const path = require("path");
const D = require("./deckfile");
const build = require("./build");
const theme = require("./theme");
const Lanes = require("../runtime/lanes");

const RUNS = ["default", "cut-first", "add-back", "backup"];

function minSec(minutes) { const s = Math.round(minutes * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

function readDeckPlan(text) {
  const rows = [];
  let cols = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) { cols = null; continue; }
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (!cols) { cols = cells.map((c) => c.toLowerCase()); continue; }
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    const row = {};
    cols.forEach((c, i) => { row[c] = cells[i] || ""; });
    const key = (row.key || "").replace(/`/g, "") || ((row.slide || "").match(/`([^`]+)`/) || [])[1] || "";
    if (!("status" in row) && !("slide" in row)) continue;
    rows.push({ key, status: (row.status || "").toLowerCase() });
  }
  return rows;
}

function lanesOf(file) {
  const dir = path.join(path.dirname(file), "lanes");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const p = path.join(dir, f), text = fs.readFileSync(p, "utf8");
    let overlay = null, error = null;
    try { overlay = JSON.parse(text); } catch (e) { error = e.message; }
    return { id: f.replace(/\.json$/, ""), path: p, text, overlay, error, out: path.join(path.dirname(file), `index-${f.replace(/\.json$/, "")}.html`) };
  });
}

function check(file) {
  const errors = [], warnings = [], info = [];
  const text = fs.readFileSync(file, "utf8");
  const deck = D.readDeck(text);
  for (const id of Object.keys(D.REGION_TAGS)) if (!deck.regions[id]) (id === "sw-deck-css" ? warnings : errors).push(`missing region ${id}`);
  if (deck.configError) errors.push(`sw-deck settings aren't valid JSON: ${deck.configError}`);
  const cfg = deck.config || {};
  if (!deck.slides.length) errors.push("the deck has no slides (<section data-key> inside <main id=\"sw-slides\">)");

  // Slides
  const keys = new Map();
  deck.slides.forEach((s, i) => {
    const where = `slide ${i + 1} (line ${s.lines[0]})`;
    if (!s.key) errors.push(`${where} has no data-key`);
    else if (keys.has(s.key)) errors.push(`two slides have the key "${s.key}" (lines ${keys.get(s.key)} and ${s.lines[0]})`);
    else keys.set(s.key, s.lines[0]);
    const run = s.attrs["data-run"];
    if (run && !RUNS.includes(run)) errors.push(`${where}: data-run "${run}" isn't one of ${RUNS.join(", ")}`);
    if (!/<aside\b[^>]*class=["'][^"']*\bnotes\b/i.test(s.text)) warnings.push(`${s.key || where} has no speaker notes`);
    const ids = [...s.text.replace(/<svg\b[^>]*data-figure-ref[\s\S]*?<\/svg>/gi, "").matchAll(/\sid=["']([^"']+)["']/gi)].map((m) => m[1]);
    const dup = ids.find((x, j) => ids.indexOf(x) !== j);
    if (dup) warnings.push(`${s.key || where}: the id "${dup}" appears twice on the slide`);
  });

  // Figures and assets
  const assets = D.assets(text);
  const names = new Map(assets.map((a) => [a.name, a]));
  const used = new Set([cfg.logo || "logo"]);
  deck.slides.forEach((s) => {
    for (const m of s.text.matchAll(/\bdata-(figure|asset)-ref=["']([^"']+)["']/gi)) {
      used.add(m[2]);
      if (!names.has(m[2])) errors.push(`${s.key}: ${m[1]} "${m[2]}" isn't in the asset block`);
    }
  });
  lanesOf(file).forEach((l) => Object.values((l.overlay && l.overlay.figures) || {}).forEach((n) => { used.add(n); if (!names.has(n)) errors.push(`lane ${l.id}: figure "${n}" isn't in the asset block`); }));
  const inlineNames = new Set([...(deck.regions["sw-assets"] ? deck.regions["sw-assets"].content : "").matchAll(/<[\w:-]+\b[^>]*\bdata-asset=["']([^"']+)["'][^>]*\bdata-inline\b/gi)].map((m) => m[1]));
  const unused = assets.filter((a) => !used.has(a.name) && !inlineNames.has(a.name) && !/^logo(-light|-dark)?$/.test(a.name)).map((a) => a.name);
  if (unused.length) info.push(`assets no slide uses: ${unused.join(", ")}`);
  for (const a of assets) {
    if (a.kind !== "figure") continue;
    const el = Lanes.elementAt(text, a.at);
    const body = el ? text.slice(el.start, el.end) : "";
    const root = /^<svg\b[^>]*>/i.exec(body);
    const classes = root ? ((/\sclass=["']([^"']*)["']/i.exec(root[0]) || [])[1] || "").split(/\s+/).filter(Boolean) : [];
    for (const m of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      // A selector that starts with a class or an id is scoped (chartware figures use .cw-dg on the
      // slide's placeholder); a bare element or * selector styles the whole page.
      const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[^{]+\{/g, "").split("}").map((r) => r.split("{")[0]).join(",").split(",").map((s) => s.trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
      const loose = selectors.filter((s) => !/^[.#]/.test(s) && !classes.some((c) => s.startsWith(`svg.${c}`)));
      if (loose.length) warnings.push(`figure "${a.name}": its <style> has rules not scoped to the figure (${loose.slice(0, 3).join(", ")}); they apply to the whole page`);
    }
  }

  // Pacing and hidden slides
  const sessions = cfg.sessions || {};
  const groups = new Map();
  deck.slides.forEach((s) => {
    const label = s.attrs["data-session"] || "";
    if (!groups.has(label)) groups.set(label, { run: 0, extra: 0 });
    if (s.hidden) return;
    const run = s.attrs["data-run"];
    if (run === "add-back" || run === "backup") groups.get(label).extra++; else groups.get(label).run++;
  });
  if (Object.keys(sessions).length || deck.slides.some((s) => s.attrs["data-session"])) {
    info.push("Pacing (each slide in the run gets an equal share of its session):");
    for (const [label, g] of groups) {
      const len = sessions[label];
      info.push(`  ${label || "Deck"}: ${len ? `${len} min, ` : ""}${g.run} slide${g.run === 1 ? "" : "s"} in the run${g.extra ? `, ${g.extra} add-back/backup` : ""} → ${len && g.run ? `${minSec(len / g.run)} per slide` : "no length set, so no pace plan"}`);
    }
    for (const label of Object.keys(sessions)) if (!groups.has(label)) warnings.push(`sessions["${label}"]: no slide has data-session="${label}"`);
  }
  const hidden = deck.slides.filter((s) => s.hidden).map((s) => `${s.key} ${s.title}`.trim());
  if (hidden.length) info.push(`Hidden (not shown, not counted): ${hidden.join(" · ")}`);
  info.push(`${deck.slides.length - hidden.length} slides shown${hidden.length ? `, ${hidden.length} hidden` : ""}`);

  // Brand and runtime
  const tr = deck.regions["sw-theme"];
  if (tr) {
    const name = tr.attrs["data-brand"];
    try {
      const h = theme.brandHash(theme.resolveBrand(name));
      if (h !== tr.attrs["data-brand-hash"]) warnings.push(`brand "${name}" has changed in brandware since this deck copied it: run refresh`);
    } catch (e) { info.push(`brand "${name}" isn't on this machine; the deck's copy is used`); }
  }
  const rr = deck.regions["sw-runtime"];
  if (rr && rr.attrs["data-version"] !== build.RUNTIME_VERSION) warnings.push(`runtime ${rr.attrs["data-version"] || "?"} is older than the plugin's ${build.RUNTIME_VERSION}: run refresh`);
  else if (rr && rr.content.trim() !== build.runtimeJs().trim()) warnings.push("the runtime differs from the plugin's copy: run refresh");
  const lr = deck.regions["sw-loader"];
  if (lr && lr.attrs["data-editor"] !== build.editorUrl()) info.push("the editor path is for another machine or install: run refresh to edit here");

  // Spec page and teaches (the librarian follows these)
  if (cfg.spec) {
    const specPath = path.resolve(path.dirname(file), cfg.spec);
    const taught = deck.slides.filter((s) => s.attrs["data-teaches"]).length;
    (fs.existsSync(specPath) ? info : warnings).push(`Spec: ${cfg.spec}${fs.existsSync(specPath) ? "" : " (NOT FOUND next to the deck; the librarian can't follow it)"} · ${taught} of ${deck.slides.length} slides name the section they teach`);
  }

  // deck-plan.md
  const planFile = path.join(path.dirname(file), "deck-plan.md");
  if (fs.existsSync(planFile)) {
    const rows = readDeckPlan(fs.readFileSync(planFile, "utf8"));
    if (!rows.length) info.push("deck-plan.md: no slide tables found (a table needs a Status column)");
    else {
      const done = rows.filter((r) => /^done/.test(r.status));
      const missing = done.filter((r) => r.key && !keys.has(r.key)).map((r) => r.key);
      const planned = new Set(rows.map((r) => r.key).filter(Boolean));
      const unplanned = [...keys.keys()].filter((k) => !planned.has(k));
      info.push(`deck-plan.md: ${rows.length} rows, ${done.length} done, ${rows.length - done.length} to do`);
      if (missing.length) info.push(`  done in the plan but not in the deck: ${missing.join(", ")}`);
      if (planned.size && unplanned.length) info.push(`  in the deck but not in the plan: ${unplanned.join(", ")}`);
    }
  }

  // Lanes
  for (const l of lanesOf(file)) {
    if (l.error) { errors.push(`lanes/${l.id}.json isn't valid JSON: ${l.error}`); continue; }
    let r;
    try { r = Lanes.applyLane(text, l.overlay, l.id); } catch (e) { errors.push(`lane ${l.id}: ${e.message}`); continue; }
    r.missing.forEach((m) => warnings.push(`lane ${l.id}: override for ${m.key}${m.id ? ` #${m.id}` : ""} matches nothing in the deck`));
    r.drifted.forEach((m) => info.push(`lane ${l.id}: the base changed under its override of ${m.key} #${m.id}`));
    const stamp = Lanes.sourceStamp(text, l.text);
    if (!fs.existsSync(l.out)) warnings.push(`lane ${l.id}: ${path.basename(l.out)} hasn't been built: run lanes`);
    else {
      const out = D.readDeck(fs.readFileSync(l.out, "utf8"));
      if ((out.config || {}).laneSource !== stamp) warnings.push(`lane ${l.id}: ${path.basename(l.out)} is out of date with the deck or its overlay: run lanes (the editor's save does this too)`);
    }
  }
  return { errors, warnings, info, deck };
}

// Browser checks: each visible slide shown complete, measured for overflow and the footer band.
async function render(file, { browser } = {}) {
  const { launch } = require("./cdp");
  const errors = [], warnings = [], info = [];
  const own = !browser;
  browser = browser || await launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 720 });
    const { pathToFileURL } = require("url");
    await page.goto(pathToFileURL(path.resolve(file)).href + "?capture");
    const results = await page.evaluate(`(async () => {
      const out = [];
      const slides = SW.slides();
      for (let i = 0; i < slides.length; i++) {
        SW.go(i, "end");
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const m = SW.measure();
        const chrome = slides[i].querySelector(".sw-chrome");
        const band = [];
        if (chrome) {
          const cr = chrome.getBoundingClientRect(), pad = 4 * SW.scale();
          slides[i].querySelectorAll("*").forEach(el => {
            if (chrome.contains(el) || el.closest("aside.notes") || el.closest("svg")) return;
            if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return;
            const r = el.getBoundingClientRect();
            if (r.bottom > cr.top - pad && r.top < cr.bottom && r.right > cr.left && r.left < cr.right) band.push(el.textContent.replace(/\s+/g, " ").trim().slice(0, 40));
          });
        }
        out.push({ key: m.key, overflow: m.overflow.slice(0, 5), band: band.slice(0, 3) });
      }
      return out;
    })()`);
    results.forEach((r) => {
      if (r.overflow.length) warnings.push(`${r.key}: content past the slide's edge (${r.overflow.map((o) => `${o.tag}${o.cls ? "." + o.cls.split(" ")[0] : ""} at ${Math.round(o.x)},${Math.round(o.y)} ${Math.round(o.w)}×${Math.round(o.h)}`).join("; ")})`);
      if (r.band.length) warnings.push(`${r.key}: text runs into the footer band: "${r.band.join('", "')}"`);
    });
    page.console.filter((c) => c.type === "exception" || c.type === "error").forEach((c) => errors.push(`script error: ${c.text.split("\n")[0]}`));
    info.push(`rendered ${results.length} slides in ${path.basename(browser.executable)}`);
    await page.close();
  } finally { if (own) await browser.close(); }
  return { errors, warnings, info };
}

module.exports = { check, render, readDeckPlan, lanesOf };
