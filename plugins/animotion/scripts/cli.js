#!/usr/bin/env node
// cli.js — the animotion command line. Node 22+; check --render and frames also need Chrome, Edge, Brave or Chromium.
//
//   node cli.js inline <file.html> [--kit <kit.html>] [--remove]
//                                                    add or refresh the runtime (removed when the file has no scene) and
//                                                    the kit (default: animotion/kit.html beside the file, when it exists)
//   node cli.js check <file.html> [--render] [--json]
//   node cli.js frames <file.html> [--scene <name|n>] [--at labels|changes|every=0.5|0,qty,fix+0.5] [--max 12]
//                     [--sheet out.png] [--dir out/] [--cols 3]   default sheet: animotion/frames/<page>-<scene>.png beside the file
//   node cli.js list <file.html>                     the scenes, with duration and labels (needs Chrome)
//   node cli.js sources [--idiom line] [--use fetch-embed] [--kind icon-set] [--min 2] [--all] | sources <id>
//                                                    the source index, filtered; or one entry in full
//   node cli.js version
"use strict";
const fs = require("fs");
const H = require("./htmlfile");
const { checkFile } = require("./check");

const FLAGS = { inline: ["kit", "remove"], check: ["render", "json"], frames: ["scene", "at", "sheet", "dir", "cols", "max"], list: [], sources: ["idiom", "use", "kind", "min", "all"], version: [], help: [] };
const BOOLEAN = new Set(["remove", "render", "json", "all", "help"]);
const NUMBER = new Set(["cols", "max", "min"]);
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("="), k = eq < 0 ? a.slice(2) : a.slice(2, eq);
      if (BOOLEAN.has(k)) out[k] = true;   // a flag never takes the next word (the file name)
      else if (eq >= 0) out[k] = a.slice(eq + 1);
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
      if (NUMBER.has(k) && !(Number(out[k]) > 0)) { console.error(`--${k} needs a positive number`); process.exit(2); }
    } else out._.push(a);
  }
  return out;
}
const usage = () => { process.stdout.write(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 14).map((l) => l.replace(/^\/\/ ?/, "")).join("\n") + "\n"); };
function needFile(f) {
  if (!f) { usage(); process.exit(2); }
  if (!fs.existsSync(f)) { console.error(`no such file: ${f}`); process.exit(2); }
  return f;
}
function report({ errors, warnings, info }) {
  for (const m of errors) console.log(`error: ${m}`);
  for (const m of warnings) console.log(`warning: ${m}`);
  for (const m of info) console.log(m);
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (!cmd || cmd === "help" || a.help) return usage();
  if (FLAGS[cmd]) {
    const bad = Object.keys(a).filter((k) => k !== "_" && !FLAGS[cmd].includes(k));
    if (bad.length) { console.error(`${cmd}: unknown option ${bad.map((k) => "--" + k).join(", ")} (${cmd} takes ${FLAGS[cmd].map((k) => "--" + k).join(", ") || "no options"})`); process.exitCode = 2; return; }
  }
  if (cmd === "version") return console.log(H.runtimeVersion());

  if (cmd === "inline") {
    const f = needFile(a._[1]);
    const path = require("path");
    const kitPath = typeof a.kit === "string" ? a.kit : path.join(path.dirname(f), "animotion", "kit.html");
    if (typeof a.kit === "string" && !fs.existsSync(kitPath)) { console.error(`no kit file at ${kitPath}; nothing written`); process.exitCode = 2; return; }
    let text = fs.readFileSync(f, "utf8");
    const r = H.inline(text, { remove: !!a.remove });
    text = r.text;
    console.log({ added: `added the animotion runtime ${H.runtimeVersion()}`, refreshed: `refreshed the runtime to ${H.runtimeVersion()}`, current: `the runtime is current (${H.runtimeVersion()})`, removed: "removed the runtime (no scenes)", none: "no scenes and no runtime: nothing to do" }[r.action]);
    const keep = !a.remove && H.scenes(text).length > 0;
    if (keep && fs.existsSync(kitPath)) {
      const k = H.setKit(text, fs.readFileSync(kitPath, "utf8"), path.relative(path.dirname(f), kitPath));
      text = k.text;
      console.log({ added: `added the kit from ${kitPath}`, refreshed: `refreshed the kit from ${kitPath}`, current: "the kit is current" }[k.action]);
    } else if (!keep && H.kitRegion(text)) { text = H.setKit(text, null).text; console.log("removed the kit (no scenes)"); }
    fs.writeFileSync(f, text);
    return;
  }

  if (cmd === "check") {
    const f = needFile(a._[1]);
    const res = checkFile(fs.readFileSync(f, "utf8"));
    if (a.render && res.scenes.length && !res.errors.some((e) => /runtime isn't in the file/.test(e))) {   // a linked runtime loads in the page too
      const { renderCheck } = require("./render");
      const r = await renderCheck(f);
      r.results.forEach((s, i) => {
        const where = `scene ${s.name ? `"${s.name}"` : `#${i + 1}`}`;
        s.errors.forEach((m) => res.errors.push(`${where}: ${m}`));
        s.warnings.forEach((m) => res.warnings.push(`${where}: ${m}`));
        if (s.info && s.info.duration !== undefined) res.info.push(`${where}: ${s.info.duration} s, poster at ${s.info.poster} s, labels ${Object.entries(s.info.labels).map(([k, v]) => `${k}@${v.toFixed(2)}`).join(" ") || "none"}`);
      });
      r.pageErrors.forEach((m) => res.errors.push(`page: ${m}`));
    }
    if (a.json) console.log(JSON.stringify({ errors: res.errors, warnings: res.warnings, info: res.info }, null, 2));
    else report(res);
    process.exitCode = res.errors.length ? 1 : 0;
    return;
  }

  if (cmd === "frames") {
    const f = needFile(a._[1]);
    // Default: animotion/frames/<page>.png beside the file (one sheet per scene: <page>-<scene>.png when there are several).
    const autoName = !a.sheet && !a.dir;   // the default sheet name carries the scene's name, so one scene's sheet doesn't overwrite another's
    if (!a.sheet && !a.dir) a.sheet = require("path").join(require("path").dirname(f), "animotion", "frames", require("path").basename(f).replace(/\.html?$/i, "") + ".png");
    const { frames } = require("./render");
    const out = await frames(f, { scene: a.scene, at: a.at, sheet: a.sheet, dir: a.dir, cols: a.cols ? +a.cols : 3, max: a.max ? +a.max : 12, autoName });
    for (const w of out) console.log(w.note ? `scene ${w.scene}: ${w.note}` : w.skipped ? `scene ${w.scene}: skipped (${w.skipped})` : `${w.file}${w.frames ? ` (${w.frames} frames)` : ""}`);
    return;
  }

  if (cmd === "list") {
    const f = needFile(a._[1]);
    const { renderCheck } = require("./render");
    const r = await renderCheck(f);
    r.results.forEach((s, i) => console.log(`${i + 1}. ${s.name || "(unnamed)"}  ${s.info.duration ?? "?"} s  poster ${s.info.poster ?? "?"} s  labels: ${s.info.labels ? Object.entries(s.info.labels).map(([k, v]) => `${k}@${v.toFixed(2)}`).join(" ") : "-"}`));
    return;
  }

  if (cmd === "sources") {
    const S = require("./sources");
    const list = S.entries();
    if (a._[1]) {
      const e = list.find((x) => x.id === a._[1]);
      if (!e) { console.error(`no source "${a._[1]}" (ids: run \`sources\` with no arguments)`); process.exitCode = 2; return; }
      return console.log(e.block);
    }
    if (a.idiom && !S.IDIOMS.includes(a.idiom)) { console.error(`--idiom is one of ${S.IDIOMS.join(", ")}`); process.exitCode = 2; return; }
    const found = S.find(list, { idiom: a.idiom, use: a.use, kind: a.kind, min: a.min, all: !!a.all });
    console.log(S.table(found, a.idiom));
    console.log(`\n${found.length} of ${list.length} sources. One in full: sources <id>.`);
    return;
  }

  console.error(`unknown command: ${cmd}`);
  usage();
  process.exitCode = 2;
}

main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
