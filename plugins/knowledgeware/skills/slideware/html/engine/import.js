// import.js — bring a PowerPoint deck into slideware.
//
//   importPptx(pptx, { out, mode, brand })
//     mode "redesign" (default): an outline (titles, body text, notes per slide) and, when
//       LibreOffice is installed, a picture of every page, under <out>/.slideware/import/.
//       Claude then authors new slides in the deck's style from them.
//     mode "faithful": every shape becomes an absolutely positioned element in a new deck at
//       <out>/index.html: text with its runs (size, weight, italic, colour, font), pictures, tables,
//       fills and rounded shapes, groups, notes, hidden slides, slide backgrounds. Placeholder
//       positions are resolved through the layout and master; theme colours through the theme.
//       Charts, SmartArt, EMF/WMF pictures and video are listed in the ledger, not converted.
//   Both write a ledger (<out>/import-ledger.md) of what each slide became.
"use strict";
const fs = require("fs");
const path = require("path");
const { readZip } = require("./zip");
const X = require("./xml");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (s) => esc(s).replace(/"/g, "&quot;");

function readPackage(file) {
  const zip = readZip(fs.readFileSync(file));
  const part = (p) => { const b = zip.get(p.replace(/^\//, "")); return b ? b.toString("utf8") : null; };
  const relsOf = (p) => {
    const dir = path.posix.dirname(p), base = path.posix.basename(p);
    const t = part(`${dir}/_rels/${base}.rels`);
    const map = {};
    if (t) for (const r of X.kids(X.parse(t), "Relationship")) {
      const target = r.attrs.TargetMode === "External" ? r.attrs.Target : path.posix.normalize(path.posix.join(dir, r.attrs.Target));
      map[r.attrs.Id] = { type: r.attrs.Type.split("/").pop(), target, external: r.attrs.TargetMode === "External" };
    }
    return map;
  };
  return { zip, part, relsOf };
}

// Theme colours, with the master's colour map (bg1 → lt1, tx1 → dk1, …).
function themeColors(pkg, masterPath) {
  const mrels = pkg.relsOf(masterPath);
  const themeRel = Object.values(mrels).find((r) => r.type === "theme");
  const out = {};
  if (themeRel) {
    const th = X.parse(pkg.part(themeRel.target));
    const scheme = X.first(th, "a:clrScheme");
    for (const c of X.kids(scheme)) {
      const v = X.first(c, "a:srgbClr") ? X.attr(X.first(c, "a:srgbClr"), "val") : X.first(c, "a:sysClr") ? X.attr(X.first(c, "a:sysClr"), "lastClr") : null;
      if (v) out[c.name.replace("a:", "")] = v;
    }
  }
  const map = X.first(X.parse(pkg.part(masterPath)), "p:clrMap");
  if (map) for (const [k, v] of Object.entries(map.attrs)) if (out[v]) out[k] = out[v];
  return out;
}
function colorOf(fillNode, theme) {
  if (!fillNode) return null;
  const s = X.first(fillNode, "a:srgbClr") || X.first(fillNode, "a:schemeClr") || X.first(fillNode, "a:prstClr");
  if (!s) return null;
  let hex = s.name === "a:srgbClr" ? s.attrs.val : s.name === "a:schemeClr" ? theme[s.attrs.val] : ({ black: "000000", white: "FFFFFF" }[s.attrs.val] || null);
  if (!hex) return null;
  const lumMod = X.kid(s, "a:lumMod"), lumOff = X.kid(s, "a:lumOff"), alpha = X.kid(s, "a:alpha");
  if (lumMod || lumOff) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const mod = lumMod ? Number(lumMod.attrs.val) / 100000 : 1, off = lumOff ? Number(lumOff.attrs.val) / 100000 : 0;
    hex = [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c * mod + 255 * off))).toString(16).padStart(2, "0")).join("");
  }
  const a = alpha ? Number(alpha.attrs.val) / 100000 : 1;
  return a < 1 ? `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${a.toFixed(2)})` : `#${hex.toUpperCase()}`;
}

// Placeholder geometry from the layout, then the master, matched by type and index.
function placeholderMap(pkg, layoutPath) {
  const out = [];
  const collect = (p) => {
    if (!p) return;
    const doc = X.parse(pkg.part(p));
    for (const sp of X.find(doc, "p:sp")) {
      const ph = X.first(sp, "p:ph"), xfrm = X.first(X.kid(sp, "p:spPr"), "a:xfrm");
      if (ph && xfrm) out.push({ type: ph.attrs.type || "body", idx: ph.attrs.idx || null, xfrm });
    }
  };
  collect(layoutPath);
  const lrels = pkg.relsOf(layoutPath);
  const masterRel = Object.values(lrels).find((r) => r.type === "slideMaster");
  collect(masterRel && masterRel.target);
  return { list: out, master: masterRel && masterRel.target };
}

function geometry(xfrm, k, offset = { x: 0, y: 0, sx: 1, sy: 1, cx: 0, cy: 0 }) {
  if (!xfrm) return null;
  const off = X.kid(xfrm, "a:off"), ext = X.kid(xfrm, "a:ext");
  if (!off || !ext) return null;
  const ex = Number(off.attrs.x), ey = Number(off.attrs.y), w = Number(ext.attrs.cx), h = Number(ext.attrs.cy);
  return {
    x: (offset.x + (ex - offset.cx) * offset.sx) * k, y: (offset.y + (ey - offset.cy) * offset.sy) * k,
    w: w * offset.sx * k, h: h * offset.sy * k, rot: Number(xfrm.attrs.rot || 0) / 60000,
  };
}

function paragraphsHtml(txBody, theme, defaults) {
  const out = [];
  let list = null;
  for (const p of X.kids(txBody, "a:p")) {
    const pPr = X.kid(p, "a:pPr");
    const algn = { ctr: "center", r: "right", just: "justify" }[X.attr(pPr, "algn")] || null;
    const bullet = pPr && (X.kid(pPr, "a:buChar") || X.kid(pPr, "a:buAutoNum")) && !X.kid(pPr, "a:buNone");
    const lvl = Number(X.attr(pPr, "lvl", 0));
    const lnPct = X.first(X.kid(pPr, "a:lnSpc"), "a:spcPct");
    const lineHeight = lnPct ? (Number(lnPct.attrs.val) / 100000 * 1.2).toFixed(3) : null;   // PowerPoint's 100% is about 1.2 lines
    let html = "";
    for (const c of X.kids(p)) {
      if (c.name === "a:br") { html += "<br>"; continue; }
      if (c.name !== "a:r" && c.name !== "a:fld") continue;
      const rPr = X.kid(c, "a:rPr"), t = X.text(X.kid(c, "a:t"));
      if (!t) continue;
      const css = [];
      const sz = X.attr(rPr, "sz") || defaults.sz;
      if (sz) css.push(`font-size: ${(Number(sz) / 100 * 4 / 3).toFixed(1)}px`);
      if (X.attr(rPr, "b") === "1") css.push("font-weight: 700");
      if (X.attr(rPr, "i") === "1") css.push("font-style: italic");
      if (X.attr(rPr, "u") && X.attr(rPr, "u") !== "none") css.push("text-decoration: underline");
      const col = colorOf(X.kid(rPr, "a:solidFill"), theme);
      if (col) css.push(`color: ${col}`);
      const font = X.attr(X.kid(rPr, "a:latin"), "typeface");
      if (font && !/^\+/.test(font)) css.push(`font-family: '${font}'`);
      if (X.attr(rPr, "spc")) css.push(`letter-spacing: ${(Number(rPr.attrs.spc) / 100 * 4 / 3).toFixed(1)}px`);
      if (X.attr(rPr, "cap") === "all") css.push("text-transform: uppercase");
      const link = X.kid(rPr, "a:hlinkClick");
      const span = css.length ? `<span style="${css.join("; ")}">${esc(t)}</span>` : esc(t);
      html += link && defaults.links[link.attrs["r:id"]] ? `<a href="${escA(defaults.links[link.attrs["r:id"]])}">${span}</a>` : span;
    }
    const style = [algn ? `text-align: ${algn}` : "", lvl ? `margin-left: ${lvl * 24}px` : "", lineHeight ? `line-height: ${lineHeight}` : ""].filter(Boolean).join("; ");
    if (bullet) {
      if (!list) { list = X.kid(pPr, "a:buAutoNum") ? "ol" : "ul"; out.push(`<${list}>`); }
      out.push(`<li${style ? ` style="${style}"` : ""}>${html || "&nbsp;"}</li>`);
    } else {
      if (list) { out.push(`</${list}>`); list = null; }
      out.push(`<p${style ? ` style="${style}"` : ""}>${html || "<br>"}</p>`);
    }
  }
  if (list) out.push(`</${list}>`);
  return out.join("");
}

function importFaithful(pkg, slidePaths, k, ledger) {
  const slides = [];
  slidePaths.forEach((sp, i) => {
    const doc = X.parse(pkg.part(sp));
    const rels = pkg.relsOf(sp);
    const layoutRel = Object.values(rels).find((r) => r.type === "slideLayout");
    const ph = layoutRel ? placeholderMap(pkg, layoutRel.target) : { list: [], master: null };
    const theme = ph.master ? themeColors(pkg, ph.master) : {};
    const links = Object.fromEntries(Object.entries(rels).filter(([, r]) => r.type === "hyperlink").map(([id, r]) => [id, r.target]));
    const row = { n: i + 1, text: 0, pics: 0, tables: 0, shapes: 0, gaps: [] };
    const parts = [];
    const media = (rid) => {
      const r = rels[rid];
      if (!r) return null;
      const ext = path.extname(r.target).slice(1).toLowerCase();
      const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" }[ext];
      if (!mime) { row.gaps.push(`picture in ${ext.toUpperCase()} (not shown in browsers)`); return null; }
      const b = pkg.zip.get(r.target);
      return b ? `data:${mime};base64,${b.toString("base64")}` : null;
    };
    const box = (g, extra = "") => `position: absolute; left: ${g.x.toFixed(1)}px; top: ${g.y.toFixed(1)}px; width: ${g.w.toFixed(1)}px; height: ${g.h.toFixed(1)}px${g.rot ? `; rotate: ${g.rot}deg` : ""}${extra ? "; " + extra : ""}`;
    const walk = (tree, offset) => {
      for (const n of X.kids(tree)) {
        if (n.name === "p:grpSp") {
          const x = X.first(X.kid(n, "p:grpSpPr"), "a:xfrm");
          const off = x && X.kid(x, "a:off"), ext = x && X.kid(x, "a:ext"), cho = x && X.kid(x, "a:chOff"), che = x && X.kid(x, "a:chExt");
          const sub = off && ext && cho && che ? {
            x: offset.x + (Number(off.attrs.x) - offset.cx) * offset.sx, y: offset.y + (Number(off.attrs.y) - offset.cy) * offset.sy,
            sx: offset.sx * (Number(ext.attrs.cx) / (Number(che.attrs.cx) || 1)), sy: offset.sy * (Number(ext.attrs.cy) / (Number(che.attrs.cy) || 1)),
            cx: Number(cho.attrs.x), cy: Number(cho.attrs.y),
          } : offset;
          walk(n, sub);
        } else if (n.name === "p:sp") {
          const spPr = X.kid(n, "p:spPr"), phNode = X.first(n, "p:ph");
          let xfrm = X.first(spPr, "a:xfrm");
          if (!xfrm && phNode) {
            const t = phNode.attrs.type || "body", idx = phNode.attrs.idx || null;
            const hit = ph.list.find((p) => idx && p.idx === idx) || ph.list.find((p) => p.type === t) || ph.list.find((p) => (t === "ctrTitle" && p.type === "title") || (t === "subTitle" && p.type === "body"));
            xfrm = hit && hit.xfrm;
          }
          const g = geometry(xfrm, k, offset);
          if (!g) continue;
          const fill = colorOf(X.kid(spPr, "a:solidFill"), theme);
          const ln = X.kid(spPr, "a:ln"), lnColor = ln && colorOf(X.kid(ln, "a:solidFill"), theme), lnW = ln && ln.attrs.w ? Math.max(1, Number(ln.attrs.w) / 12700 * 4 / 3) : 1;
          const geom = X.attr(X.kid(spPr, "a:prstGeom"), "prst", "rect");
          const radius = geom === "ellipse" ? "50%" : geom === "roundRect" ? "12px" : "";
          const tx = X.kid(n, "p:txBody");
          const bodyPr = tx && X.kid(tx, "a:bodyPr");
          const ins = ["lIns", "tIns", "rIns", "bIns"].map((a, j) => (bodyPr && bodyPr.attrs[a] !== undefined ? Number(bodyPr.attrs[a]) : [91440, 45720, 91440, 45720][j]) * k);
          const anchor = { ctr: "center", b: "flex-end" }[X.attr(bodyPr, "anchor")] || "flex-start";
          const t = phNode ? (phNode.attrs.type || "body") : null;
          const defSz = t === "title" || t === "ctrTitle" ? "3600" : t ? "2000" : "1800";
          const inner = tx ? paragraphsHtml(tx, theme, { sz: defSz, links }) : "";
          const hasText = tx && X.text(tx).trim();
          if (!hasText && !fill && !lnColor) continue;
          const css = [fill ? `background: ${fill}` : "", lnColor ? `border: ${lnW.toFixed(1)}px solid ${lnColor}` : "", radius ? `border-radius: ${radius}` : "",
            hasText ? `display: flex; flex-direction: column; justify-content: ${anchor}; padding: ${ins.map((v) => v.toFixed(1) + "px").slice(1, 2)} ${ins[2].toFixed(1)}px ${ins[3].toFixed(1)}px ${ins[0].toFixed(1)}px; box-sizing: border-box` : ""].filter(Boolean).join("; ");
          const tag = t === "title" || t === "ctrTitle" ? "h2" : "div";
          parts.push(`  <${tag} class="pp-shape" style="${box(g, css)}">${inner}</${tag}>`);
          if (hasText) row.text++; else row.shapes++;
        } else if (n.name === "p:pic") {
          const g = geometry(X.first(X.kid(n, "p:spPr"), "a:xfrm"), k, offset);
          const blip = X.first(n, "a:blip");
          const vid = X.first(n, "a:videoFile");
          if (vid) { row.gaps.push("video"); continue; }
          const src = blip && media(blip.attrs["r:embed"]);
          if (g && src) { parts.push(`  <img class="pp-pic" src="${src}" alt="" style="${box(g, "object-fit: fill")}">`); row.pics++; }
        } else if (n.name === "p:graphicFrame") {
          const g = geometry(X.kid(n, "p:xfrm"), k, offset);
          const tbl = X.first(n, "a:tbl");
          if (tbl && g) {
            const rowsHtml = X.kids(tbl, "a:tr").map((tr) => "<tr>" + X.kids(tr, "a:tc").map((tc) => {
              const tcPr = X.kid(tc, "a:tcPr"), bg = tcPr && colorOf(X.kid(tcPr, "a:solidFill"), theme);
              const span = tc.attrs.gridSpan ? ` colspan="${tc.attrs.gridSpan}"` : "";
              if (tc.attrs.hMerge || tc.attrs.vMerge) return "";
              return `<td${span}${bg ? ` style="background: ${bg}"` : ""}>${paragraphsHtml(X.kid(tc, "a:txBody"), theme, { sz: "1400", links })}</td>`;
            }).join("") + "</tr>").join("");
            parts.push(`  <table class="pp-table" style="${box(g)}">${rowsHtml}</table>`);
            row.tables++;
          } else if (X.first(n, "c:chart")) row.gaps.push("chart (redraw it with chartware from its data)");
          else if (X.first(n, "dgm:relIds")) row.gaps.push("SmartArt");
          else row.gaps.push("embedded object");
        }
      }
    };
    walk(X.first(doc, "p:spTree"), { x: 0, y: 0, sx: 1, sy: 1, cx: 0, cy: 0 });
    // Background, notes, visibility.
    const bg = X.first(X.first(doc, "p:bg"), "a:solidFill");
    const bgColor = bg ? colorOf(bg, theme) : null;
    const notesRel = Object.values(rels).find((r) => r.type === "notesSlide");
    let notes = "";
    if (notesRel) {
      const nd = X.parse(pkg.part(notesRel.target));
      const body = X.find(nd, "p:sp").find((s) => { const p = X.first(s, "p:ph"); return p && (p.attrs.type === "body" || (!p.attrs.type && p.attrs.idx === "1")); });
      if (body) notes = X.kids(X.kid(body, "p:txBody"), "a:p").map((p) => X.text(p)).join("\n").trim();
    }
    const hidden = doc.attrs.show === "0";
    const title = (() => { const t = X.find(doc, "p:sp").find((s) => { const p = X.first(s, "p:ph"); return p && /title/i.test(p.attrs.type || ""); }); return t ? X.text(X.kid(t, "p:txBody")).trim() : ""; })();
    const key = `s${String(i + 1).padStart(2, "0")}`;
    slides.push(`<!-- ${key}${title ? " · " + title.replace(/--/g, "—") : ""} -->\n<section data-key="${key}" data-chrome="none" class="pp-slide"${hidden ? " hidden" : ""}${bgColor ? ` style="background: ${bgColor}"` : ""}>\n${parts.join("\n")}\n` +
      (notes ? `  <aside class="notes">${esc(notes)}</aside>\n` : "") + "</section>");
    ledger.push({ ...row, key, title, hidden, notes: !!notes });
  });
  return slides;
}

function outline(pkg, slidePaths) {
  return slidePaths.map((sp, i) => {
    const doc = X.parse(pkg.part(sp));
    const rels = pkg.relsOf(sp);
    const shapes = X.find(doc, "p:sp").map((s) => ({ ph: X.first(s, "p:ph"), text: X.kids(X.kid(s, "p:txBody"), "a:p").map((p) => X.text(p)).filter((t) => t.trim()) }));
    const title = (shapes.find((s) => s.ph && /title/i.test(s.ph.attrs.type || "")) || {}).text || [];
    const body = shapes.filter((s) => !(s.ph && /title/i.test(s.ph.attrs.type || ""))).flatMap((s) => s.text);
    const notesRel = Object.values(rels).find((r) => r.type === "notesSlide");
    let notes = "";
    if (notesRel) {
      const nd = X.parse(pkg.part(notesRel.target));
      const b = X.find(nd, "p:sp").find((s) => { const p = X.first(s, "p:ph"); return p && (p.attrs.type === "body" || (!p.attrs.type && p.attrs.idx === "1")); });
      if (b) notes = X.kids(X.kid(b, "p:txBody"), "a:p").map((p) => X.text(p)).join("\n").trim();
    }
    const pics = X.find(doc, "p:pic").length, charts = X.find(doc, "c:chart").length, tables = X.find(doc, "a:tbl").length;
    return { n: i + 1, title: title.join(" "), body, notes, hidden: doc.attrs.show === "0", pics, charts, tables };
  });
}

async function importPptx(file, { out, mode = "redesign", brand } = {}) {
  file = path.resolve(file);
  out = path.resolve(out || path.join(path.dirname(file), path.basename(file, ".pptx")));
  const pkg = readPackage(file);
  const pres = X.parse(pkg.part("ppt/presentation.xml"));
  const prels = pkg.relsOf("ppt/presentation.xml");
  const slidePaths = X.kids(X.kid(pres, "p:sldIdLst"), "p:sldId").map((s) => prels[s.attrs["r:id"]].target);
  const sz = X.kid(pres, "p:sldSz");
  const cx = Number(X.attr(sz, "cx", 12192000)), cy = Number(X.attr(sz, "cy", 6858000));
  const k = 1280 / cx;   // EMU → slide px; a 4:3 deck keeps its width and leaves the bottom empty
  fs.mkdirSync(out, { recursive: true });
  const ledgerLines = [`# Import ledger`, "", `Source: ${path.basename(file)} · ${slidePaths.length} slides · ${(cx / 914400).toFixed(2)} × ${(cy / 914400).toFixed(2)} in · mode ${mode}`, ""];
  if (Math.abs(cx / cy - 16 / 9) > 0.01) ledgerLines.push(`The source isn't 16:9 (${(cx / cy).toFixed(2)}): slides keep its width and their content scales to it.`, "");
  if (mode === "faithful") {
    const ledger = [];
    const slides = importFaithful(pkg, slidePaths, k, ledger);
    const build = require("./build");
    const D = require("./deckfile");
    let text = build.newDeck({ brand: brand || "style-1", title: path.basename(file, ".pptx"), slides: slides.join("\n\n") });
    text = D.spliceRegion(text, "sw-deck-css", `\n/* Imported from ${esc(path.basename(file))}: every shape positioned as it was. */\n` +
      ".pp-slide { padding: 0; display: block; line-height: 1.2; }\n.pp-slide .pp-shape { margin: 0; overflow: visible; font-size: 24px; line-height: 1.2; }\n" +
      ".pp-slide .pp-shape > p, .pp-slide .pp-shape li { margin: 0; }\n.pp-slide .pp-shape > :is(ul, ol) { margin: 0; padding-left: 1.2em; }\n" +
      ".pp-slide .pp-table { border-collapse: collapse; font-size: 18px; }\n.pp-slide .pp-table td { border: 1px solid #D0D0D0; padding: 4px 8px; vertical-align: top; }\n.pp-slide .pp-table td p { margin: 0; }\n");
    fs.writeFileSync(path.join(out, "index.html"), text);
    ledgerLines.push("| # | Slide | Text | Pictures | Tables | Shapes | Not converted |", "|---|---|---|---|---|---|---|",
      ...ledger.map((r) => `| ${r.n} | \`${r.key}\` ${r.title.replace(/\|/g, "/").slice(0, 60)}${r.hidden ? " (hidden)" : ""} | ${r.text} | ${r.pics} | ${r.tables} | ${r.shapes} | ${r.gaps.join("; ")} |`));
    ledgerLines.push("", "Placeholder text sizes the layout sets only through its styles are approximated (title 36 pt, body 20 pt). Check each slide; Claude can tidy what moved.");
  } else {
    const dir = path.join(out, ".slideware", "import");
    fs.mkdirSync(dir, { recursive: true });
    const rows = outline(pkg, slidePaths);
    // Page pictures through LibreOffice, when it's installed. It renders shown slides only, and
    // pdftoppm pads page numbers to the width of the last one.
    const pages = renderPages(file, dir);
    const shown = rows.filter((r) => !r.hidden).length, width = String(shown).length;
    const md = [`# ${path.basename(file, ".pptx")}`, "", `Outline of ${path.basename(file)}, for authoring new slides in the deck's style.`, ""];
    let page = 0;
    for (const r of rows) {
      if (!r.hidden) page++;
      md.push(`## ${r.n}. ${r.title || "(no title)"}${r.hidden ? " (hidden)" : ""}`, "");
      r.body.forEach((b) => md.push(`- ${b}`));
      const pic = pages && !r.hidden ? `; see page-${String(page).padStart(width, "0")}.png` : r.hidden ? " (hidden slides have no page picture)" : "";
      if (r.pics || r.charts || r.tables) md.push("", `Visuals: ${[r.pics && `${r.pics} picture(s)`, r.charts && `${r.charts} chart(s)`, r.tables && `${r.tables} table(s)`].filter(Boolean).join(", ")}${pic}`);
      else if (pic && pages) md.push("", `Page picture${pic.replace(/^; see/, ":")}`);
      if (r.notes) md.push("", "Notes:", "", r.notes.split("\n").map((l) => `> ${l}`).join("\n"));
      md.push("");
    }
    fs.writeFileSync(path.join(dir, "outline.md"), md.join("\n"));
    ledgerLines.push(`Outline: ${path.relative(out, path.join(dir, "outline.md"))}`, pages ? `Page pictures: ${pages} in ${path.relative(out, dir)}` : "Page pictures: LibreOffice (soffice) and pdftoppm aren't both installed, so none were made.");
  }
  fs.writeFileSync(path.join(out, "import-ledger.md"), ledgerLines.join("\n") + "\n");
  return { out, slides: slidePaths.length, mode };
}

function renderPages(file, dir) {
  const { execFileSync } = require("child_process");
  const which = (b) => { try { execFileSync("which", [b], { stdio: "pipe" }); return true; } catch (e) { return false; } };
  const soffice = ["soffice", "libreoffice"].find(which) || (fs.existsSync("/Applications/LibreOffice.app/Contents/MacOS/soffice") ? "/Applications/LibreOffice.app/Contents/MacOS/soffice" : null);
  if (!soffice || !which("pdftoppm")) return 0;
  const profile = fs.mkdtempSync(path.join(require("os").tmpdir(), "sw-lo-"));
  try {
    execFileSync(soffice, ["--headless", `-env:UserInstallation=file://${profile}`, "--convert-to", "pdf", "--outdir", dir, file], { stdio: "pipe", timeout: 180000 });
    const pdf = path.join(dir, path.basename(file).replace(/\.pptx$/i, ".pdf"));
    execFileSync("pdftoppm", ["-r", "80", "-png", pdf, path.join(dir, "page")], { stdio: "pipe" });
    fs.rmSync(pdf, { force: true });
    return fs.readdirSync(dir).filter((f) => /^page-\d+\.png$/.test(f)).length;
  } catch (e) { return 0; } finally { fs.rmSync(profile, { recursive: true, force: true }); }
}

module.exports = { importPptx };
