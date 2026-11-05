// pptx.js — export a deck to PowerPoint.
//
//   exportPptx(file, out, { level })
//     level 0: each slide as one picture, plus its notes. Pixel-exact, nothing editable.
//     level 1 (default): each slide rendered with its text hidden as the background picture, and the
//       text as native PowerPoint text boxes at the measured positions (runs keep font, size, weight,
//       italic, colour, letter-spacing, capitals, links; list items get bullets). Text is editable,
//       visuals are exact. SVG figures and decoration stay in the picture.
//   Both: speaker notes (with the cue line), hidden slides hidden, 16:9 (13.333 × 7.5 in).
// Writes <out> and a fidelity ledger beside it (<out>.ledger.md) listing what each slide became.
// Fonts are named, not embedded: the machine opening the file needs them installed.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { writeZip } = require("./zip");

const EMU = 9525;   // per CSS pixel; 1280 × 720 px = 12192000 × 6858000 EMU
const W = 1280, H = 720;
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emu = (px) => Math.round(px * EMU);

// ── Reading the slides in the browser ────────────────────────────────
const COLLECT = `(async (mark) => {
  const sec = SW.current(), base = sec.getBoundingClientRect(), s = base.width / ${W};
  const INLINE = /^(inline|inline-block|inline-flex|contents)$/;
  const hex = (c) => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(c || ""); if (!m) return null; if (m[4] !== undefined && Number(m[4]) === 0) return null;
    return [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, "0")).join("").toUpperCase(); };
  const blocks = [];
  const runsOf = (el) => {
    const runs = [];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const p = n.parentElement, cs = getComputedStyle(p);
        let t = n.textContent.replace(/\\s+/g, " ");
        if (!t) return;
        if (cs.textTransform === "uppercase") t = t.toUpperCase();
        const a = p.closest("a[href]");
        runs.push({ t, font: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: parseFloat(cs.fontSize), bold: Number(cs.fontWeight) >= 600,
          italic: cs.fontStyle === "italic", color: hex(cs.color), spacing: parseFloat(cs.letterSpacing) || 0, underline: /underline/.test(cs.textDecorationLine) && !a,
          href: a ? a.href : null });
      } else if (n.nodeType === 1) {
        if (n.localName === "br") { runs.push({ br: true }); return; }
        const cs = getComputedStyle(n);
        if (cs.display === "none" || n.matches("svg, img, script, style")) return;
        n.childNodes.forEach(walk);
      }
    };
    el.childNodes.forEach(walk);
    // trim the edges of each line
    if (runs.length && runs[0].t) runs[0].t = runs[0].t.replace(/^\\s+/, "");
    if (runs.length && runs[runs.length - 1].t) runs[runs.length - 1].t = runs[runs.length - 1].t.replace(/\\s+$/, "");
    return runs.filter(r => r.br || r.t);
  };
  const visit = (el) => {
    if (el.matches("aside.notes, script, style, template, svg") || el.closest("svg")) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const blockKids = [...el.children].some(c => !INLINE.test(getComputedStyle(c).display) && c.localName !== "br" && !c.matches("svg, img"));
    if (hasText && !blockKids) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const runs = runsOf(el);
        if (runs.length) blocks.push({
          x: (r.left - base.left) / s, y: (r.top - base.top) / s, w: r.width / s, h: r.height / s,
          align: cs.textAlign, lineHeight: parseFloat(cs.lineHeight) || null, fontSize: parseFloat(cs.fontSize),
          pad: ["paddingLeft", "paddingTop", "paddingRight", "paddingBottom"].map(k => parseFloat(cs[k]) || 0),
          bullet: el.localName === "li" && cs.listStyleType !== "none" ? (el.parentElement.localName === "ol" ? "num" : "disc") : null,
          runs,
        });
        if (mark) el.setAttribute("data-sw-x", "");
      }
      return;
    }
    [...el.children].forEach(visit);
  };
  [...sec.children].forEach(visit);
  return blocks;
})`;

async function capture(file, { level, scale = 2 }) {
  const { launch } = require("./cdp");
  const browser = await launch();
  const slides = [];
  try {
    const page = await browser.newPage({ width: W, height: H, scale });
    await page.goto(pathToFileURL(path.resolve(file)).href + "?capture");
    await page.evaluate(`new Promise(r => SW.ready(() => setTimeout(r, 300)))`);
    await page.evaluate(`(() => { const s = document.createElement("style"); s.id = "sw-x-css";
      s.textContent = "html.sw-x [data-sw-x], html.sw-x [data-sw-x] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; } html.sw-x [data-sw-x]::marker { color: transparent !important; }";
      document.head.appendChild(s); })()`);
    const list = await page.evaluate(`SW.allSlides().map(s => ({ key: s.getAttribute("data-key"), hidden: s.hidden }))`);
    for (const item of list) {
      await page.evaluate(`(() => { const el = SW.allSlides().find(x => x.getAttribute("data-key") === ${JSON.stringify(item.key)});
        if (el.hidden) { el.hidden = false; el.dataset.swX = "1"; SW.refresh(); }
        SW.go(SW.slides().indexOf(el), "end"); })()`);
      await page.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
      const full = await page.screenshot();
      const notes = await page.evaluate(`(() => { const sec = SW.current(), a = sec.querySelector(":scope > aside.notes"), d = sec.dataset;
        return { text: a ? a.textContent.trim() : "", cue: [d.session, d.module, d.run && d.run !== "default" ? d.run : ""].filter(Boolean).join(" · "),
          title: (sec.querySelector("h1, h2, h3") || {}).textContent || "" }; })()`);
      let blocks = [], bg = full;
      if (level >= 1) {
        blocks = await page.evaluate(`${COLLECT}(true)`);
        await page.evaluate(`document.documentElement.classList.add("sw-x")`);
        await page.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
        bg = await page.screenshot();
        await page.evaluate(`(() => { document.documentElement.classList.remove("sw-x"); document.querySelectorAll("[data-sw-x]").forEach(e => e.removeAttribute("data-sw-x")); })()`);
      }
      await page.evaluate(`(() => { const el = SW.allSlides().find(x => x.getAttribute("data-key") === ${JSON.stringify(item.key)});
        if (el.dataset.swX) { el.hidden = true; delete el.dataset.swX; SW.refresh(); } })()`);
      slides.push({ ...item, full, bg, blocks, notes });
    }
    await page.close();
  } finally { await browser.close(); }
  return slides;
}

// ── Writing the parts ────────────────────────────────────────────────
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rels = (list) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith("http") ? type : `${REL}/${type}`}" Target="${x(target)}"${/^https?:/.test(target) ? ' TargetMode="External"' : ""}/>`).join("") + "</Relationships>";
const XMLHEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function theme(name) {
  const c = (n, v) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
  const fill3 = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return `${XMLHEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${x(name)}"><a:themeElements>` +
    `<a:clrScheme name="${x(name)}"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    c("dk2", "1A1A18") + c("lt2", "F4F4F2") + c("accent1", "3B5249") + c("accent2", "C8703E") + c("accent3", "6B7E6B") + c("accent4", "A63A1C") + c("accent5", "2F7DE1") + c("accent6", "7A7468") + c("hlink", "2F7DE1") + c("folHlink", "6B4FB3") +
    `</a:clrScheme><a:fontScheme name="${x(name)}"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="${x(name)}"><a:fillStyleLst>${fill3}</a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
    `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fill3}</a:bgFillStyleLst></a:fmtScheme>` +
    `</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}
const CLRMAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
const EMPTY_TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const master = () => `${XMLHEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld>${CLRMAP}` +
  `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
const layout = () => `${XMLHEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const notesMaster = () => `${XMLHEAD}<p:notesMaster ${NS}><p:cSld><p:spTree>${EMPTY_TREE}` +
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>` +
  `</p:spTree></p:cSld>${CLRMAP}<p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>`;

function paragraphsXml(text) {
  return String(text).split(/\n/).map((line) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${x(line)}</a:t></a:r></a:p>`).join("") || '<a:p><a:endParaRPr lang="en-US"/></a:p>';
}
function notesSlide(n, notes) {
  const body = (notes.cue ? notes.cue + "\n\n" : "") + notes.text;
  return `${XMLHEAD}<p:notes ${NS}><p:cSld><p:spTree>${EMPTY_TREE}` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image ${n}"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes ${n}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml(body)}</p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function runXml(r, linkRels) {
  if (r.br) return '<a:br><a:rPr lang="en-US"/></a:br>';
  const attrs = [`lang="en-US"`, `sz="${Math.max(100, Math.round(r.size * 75))}"`, r.bold ? 'b="1"' : 'b="0"', r.italic ? 'i="1"' : "", r.underline ? 'u="sng"' : "",
    r.spacing ? `spc="${Math.round(r.spacing * 75)}"` : "", 'dirty="0"'].filter(Boolean).join(" ");
  let inner = r.color ? `<a:solidFill><a:srgbClr val="${r.color}"/></a:solidFill>` : "";
  inner += `<a:latin typeface="${x(r.font)}"/><a:cs typeface="${x(r.font)}"/>`;
  if (r.href) { const id = `rId${100 + linkRels.length}`; linkRels.push([id, "hyperlink", r.href]); inner += `<a:hlinkClick r:id="${id}"/>`; }
  return `<a:r><a:rPr ${attrs}>${inner}</a:rPr><a:t>${x(r.t)}</a:t></a:r>`;
}
function textBoxXml(id, b, linkRels) {
  const algn = { center: "ctr", right: "r", end: "r", justify: "just" }[b.align] || "l";
  const lnSpc = b.lineHeight && b.fontSize ? `<a:lnSpc><a:spcPct val="${Math.round((b.lineHeight / b.fontSize) * 100000 / 1.2)}"/></a:lnSpc>` : "";
  const bullet = b.bullet === "disc" ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : b.bullet === "num" ? '<a:buAutoNum type="arabicPeriod"/>' : "<a:buNone/>";
  const indent = b.bullet ? ` marL="${emu(Math.round(b.fontSize * 1.2))}" indent="-${emu(Math.round(b.fontSize * 1.2))}"` : "";
  const runs = b.runs.map((r) => runXml(r, linkRels)).join("");
  const slack = b.bullet ? Math.round(b.fontSize * 1.2) : 0;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${emu(b.x - slack)}" y="${emu(b.y)}"/><a:ext cx="${emu(b.w + slack + 4)}" cy="${emu(b.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="${emu(b.pad[0])}" tIns="${emu(b.pad[1])}" rIns="${emu(b.pad[2])}" bIns="${emu(b.pad[3])}" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="${algn}"${indent}>${lnSpc}${bullet}</a:pPr>${runs}</a:p></p:txBody></p:sp>`;
}
function slideXml(n, s, level, linkRels) {
  let shapes = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide ${n}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(W)}" cy="${emu(H)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  if (level >= 1) s.blocks.forEach((b, i) => { shapes += textBoxXml(3 + i, b, linkRels); });
  return `${XMLHEAD}<p:sld ${NS}${s.hidden ? ' show="0"' : ""}><p:cSld><p:spTree>${EMPTY_TREE}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function buildPptx(slides, { level, title }) {
  const files = [];
  const n = slides.length;
  const ct = [`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`, `<Default Extension="xml" ContentType="application/xml"/>`, `<Default Extension="png" ContentType="image/png"/>`,
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
    `<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
    `<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>`,
    `<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>`,
    `<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>`,
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`];
  const presRels = [["rId1", "slideMaster", "slideMasters/slideMaster1.xml"], ["rId2", "theme", "theme/theme1.xml"], ["rId3", "presProps", "presProps.xml"],
    ["rId4", "viewProps", "viewProps.xml"], ["rId5", "tableStyles", "tableStyles.xml"], ["rId6", "notesMaster", "notesMasters/notesMaster1.xml"]];
  slides.forEach((s, i) => {
    const k = i + 1, linkRels = [];
    files.push({ name: `ppt/slides/slide${k}.xml`, data: slideXml(k, s, level, linkRels) });
    files.push({ name: `ppt/slides/_rels/slide${k}.xml.rels`, data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "image", `../media/slide${k}.png`], ["rId3", "notesSlide", `../notesSlides/notesSlide${k}.xml`], ...linkRels]) });
    files.push({ name: `ppt/media/slide${k}.png`, data: level >= 1 ? s.bg : s.full });
    files.push({ name: `ppt/notesSlides/notesSlide${k}.xml`, data: notesSlide(k, s.notes) });
    files.push({ name: `ppt/notesSlides/_rels/notesSlide${k}.xml.rels`, data: rels([["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"], ["rId2", "slide", `../slides/slide${k}.xml`]]) });
    ct.push(`<Override PartName="/ppt/slides/slide${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    presRels.push([`rId${10 + i}`, "slide", `slides/slide${k}.xml`]);
  });
  files.push({ name: "[Content_Types].xml", data: `${XMLHEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join("")}</Types>` });
  files.push({ name: "_rels/.rels", data: rels([["rId1", "officeDocument", "ppt/presentation.xml"], ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"], ["rId3", "extended-properties", "docProps/app.xml"]]) });
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  files.push({ name: "docProps/core.xml", data: `${XMLHEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>slideware</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: "docProps/app.xml", data: `${XMLHEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>knowledgeware slideware</Application><Slides>${n}</Slides></Properties>` });
  files.push({ name: "ppt/presentation.xml", data: `${XMLHEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId6"/></p:notesMasterIdLst>` +
    `<p:sldIdLst>${slides.map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${emu(W)}" cy="${emu(H)}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:defaultTextStyle></p:presentation>` });
  files.push({ name: "ppt/_rels/presentation.xml.rels", data: rels(presRels) });
  files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: master() });
  files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: layout() });
  files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]) });
  files.push({ name: "ppt/notesMasters/notesMaster1.xml", data: notesMaster() });
  files.push({ name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: rels([["rId1", "theme", "../theme/theme2.xml"]]) });
  files.push({ name: "ppt/theme/theme1.xml", data: theme("Slideware") });
  files.push({ name: "ppt/theme/theme2.xml", data: theme("Slideware Notes") });
  files.push({ name: "ppt/presProps.xml", data: `${XMLHEAD}<p:presentationPr ${NS}/>` });
  files.push({ name: "ppt/viewProps.xml", data: `${XMLHEAD}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
  files.push({ name: "ppt/tableStyles.xml", data: `${XMLHEAD}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
  return writeZip(files);
}

async function exportPptx(file, out, { level = 1 } = {}) {
  const slides = await capture(file, { level });
  const title = (/<title>([\s\S]*?)<\/title>/i.exec(fs.readFileSync(file, "utf8")) || [])[1] || path.basename(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildPptx(slides, { level, title: title.trim() }));
  const ledger = out + ".ledger.md";
  const lines = [`# PowerPoint export ledger`, "", `Deck: ${path.basename(file)} · level ${level} · ${slides.length} slides · ${new Date().toISOString().slice(0, 10)}`, "",
    level >= 1 ? "Each slide: a picture of the slide with its text hidden, and the text as native text boxes. Figures, shapes and decoration are in the picture." : "Each slide: one picture of the slide, plus its notes. Nothing on the slide is editable.", "",
    "| # | Slide | Hidden | Text boxes | Notes |", "|---|---|---|---|---|",
    ...slides.map((s, i) => `| ${i + 1} | \`${s.key}\` ${s.notes.title.replace(/\s+/g, " ").trim().replace(/\|/g, "/")} | ${s.hidden ? "yes" : ""} | ${level >= 1 ? s.blocks.length : "-"} | ${s.notes.text ? "yes" : ""} |`),
    "", "Fonts are named, not embedded; install the deck's fonts where the file is opened. Builds (click reveals) and entrance motion don't carry over."];
  fs.writeFileSync(ledger, lines.join("\n") + "\n");
  return { slides: slides.length, level, ledger };
}

module.exports = { exportPptx, buildPptx };
