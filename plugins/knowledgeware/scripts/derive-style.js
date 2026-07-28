#!/usr/bin/env node
// derive-style.js — generate a brandbook.md by inspecting a live website.
//
// Fetches the HTML, all linked stylesheets, and inline <style> blocks. Extracts:
//   - CSS custom properties (most reliable signal — explicit brand tokens)
//   - body { background / color / font-family } declarations
//   - hex colors by frequency (excluding pure black/white as noise)
//   - border-radius distribution
// Writes a brandbook.md compatible with scripts/load-brandbook.js.
//
// Usage:
//   node derive-style.js https://example.com -o ./my-brand.md
//   node derive-style.js https://example.com               # prints to stdout
//
// Caveats:
//   - This is a heuristic starting point, not a precise harvest. Modern sites compile
//     styles aggressively; CSS custom properties and body-level rules survive best.
//   - For high-fidelity, follow up with manual inspection of the rendered page.
//   - JS-rendered styles (Tailwind JIT, runtime CSS-in-JS) may not appear in the source.

const https = require("https");
const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function fetchText(url, timeoutMs = 15000, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === "https:" ? https : http;
    const req = client.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "GET",
      headers: { "User-Agent": UA, "Accept": "text/html,text/css,*/*" },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
        const next = new URL(res.headers.location, url).toString();
        return fetchText(next, timeoutMs, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", c => { buf += c; if (buf.length > 5_000_000) { req.destroy(); reject(new Error("Response too large")); } });
      res.on("end", () => resolve(buf));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error("timeout")); });
    req.end();
  });
}

function hex6(v) {
  if (!v) return null;
  const m = String(v).match(/#([0-9a-fA-F]{3,8})\b/);
  if (!m) return null;
  let c = m[1];
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  if (c.length === 8) c = c.slice(0, 6);   // drop alpha
  if (c.length !== 6) return null;
  return c.toUpperCase();
}

function relLuminance(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isNearGray(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (max - min) <= 18;
}

function extractAllStyles(html, baseUrl) {
  const out = { inline: [], linkUrls: [] };
  const linkRe = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const h = tag.match(hrefRe);
    if (h) {
      try { out.linkUrls.push(new URL(h[1], baseUrl).toString()); } catch (_) {}
    }
  }
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html)) !== null) out.inline.push(m[1]);
  return out;
}

function extractCssVars(css) {
  const out = {};
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}]+?)\s*[;}]/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = m[2].trim();   // first occurrence wins
  }
  return out;
}

function resolveVar(value, vars, depth = 0) {
  if (depth > 5) return value;
  const m = value.match(/var\(\s*--([a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)/);
  if (!m) return value;
  const fallback = m[2] || "";
  const v = vars[m[1].toLowerCase()];
  if (!v) return fallback.trim();
  return resolveVar(v, vars, depth + 1);
}

function extractBodyRules(css) {
  const rules = [];
  // body { ... }  and  html, body { ... }
  const re = /(?:^|[\s,>{}])\b(?:html\s*,\s*body|body)\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) rules.push(m[1]);
  return rules;
}

function extractDeclaration(rules, name) {
  for (const rule of rules) {
    const re = new RegExp(`(?:^|[;{])\\s*${name}\\s*:\\s*([^;]+?)\\s*(?:;|$|\\})`, "i");
    const m = rule.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function pickFontStack(declaration) {
  if (!declaration) return null;
  const m = declaration.match(/^['"]?([^,'"]+)['"]?/);
  return m ? m[1].trim() : null;
}

function looksSerif(name) {
  return /serif|tiempo|cheltenham|imperial|lyon|fraunces|lora|georgia|playfair|merriweather|bitter|garamond|cambria/i.test(name || "");
}

function countHexColors(css) {
  const counts = {};
  const re = /#([0-9a-fA-F]{3,8})\b/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const h = hex6("#" + m[1]);
    if (!h) continue;
    counts[h] = (counts[h] || 0) + 1;
  }
  return counts;
}

function countRadii(css) {
  const counts = {};
  const re = /border-radius\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const decl = m[1];
    const parts = decl.split(/\s+/).slice(0, 1);
    for (const p of parts) {
      const u = p.match(/^(\d+(?:\.\d+)?)\s*(px|rem|em)?$/i);
      if (!u) continue;
      const n = parseFloat(u[1]);
      const unit = (u[2] || "px").toLowerCase();
      const px = unit === "px" ? n : n * 16;
      if (px <= 0 || px > 96) continue;
      counts[px] = (counts[px] || 0) + 1;
    }
  }
  return counts;
}

function pickPalette(colorCounts, body) {
  // Sort hex by count desc
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  let bg = body.bg ? hex6(body.bg) : null;
  let ink = body.ink ? hex6(body.ink) : null;

  // If body bg/ink not found, infer: most-common near-white = bg, most-common near-black = ink
  if (!bg) {
    for (const [h] of sorted) {
      if (relLuminance(h) > 0.88 && isNearGray(h)) { bg = h; break; }
    }
    bg = bg || "FFFFFF";
  }
  if (!ink) {
    for (const [h] of sorted) {
      if (relLuminance(h) < 0.1 && isNearGray(h)) { ink = h; break; }
    }
    ink = ink || "121212";
  }

  // Accent: most common color that is non-gray and not too close to bg or ink
  let accent = null;
  for (const [h, n] of sorted) {
    if (n < 2) break;
    if (isNearGray(h)) continue;
    if (h === bg || h === ink) continue;
    // skip colors that are very close to bg or ink (within 20 RGB units)
    const cr = parseInt(h.slice(0, 2), 16), cg = parseInt(h.slice(2, 4), 16), cb = parseInt(h.slice(4, 6), 16);
    const bgR = parseInt(bg.slice(0, 2), 16), bgG = parseInt(bg.slice(2, 4), 16), bgB = parseInt(bg.slice(4, 6), 16);
    if (Math.abs(cr - bgR) + Math.abs(cg - bgG) + Math.abs(cb - bgB) < 30) continue;
    accent = h;
    break;
  }
  accent = accent || "5E6AD2";

  // Muted (mid-gray)
  let muted = null;
  for (const [h] of sorted) {
    const L = relLuminance(h);
    if (L > 0.2 && L < 0.55 && isNearGray(h)) { muted = h; break; }
  }
  muted = muted || "808080";

  // Border (light gray)
  let border = null;
  for (const [h] of sorted) {
    const L = relLuminance(h);
    if (L > 0.75 && L < 0.95 && isNearGray(h)) { border = h; break; }
  }
  border = border || "E0E0E0";

  return { bg, ink, muted, border, accent };
}

function emitMarkdown({ name, sourceUrl, palette, type, layout, notes }) {
  const slideAdaptation = `
## Slide adaptation (16:9)

| Role | pt |
|------|----|
| Title slide H1 | 44 |
| Section title | 32 |
| Slide title | 28 |
| Body | 14 |
| Caption | 10 |
`;

  return `# ${name} — Derived style

> Auto-derived from \`${sourceUrl}\` on ${new Date().toISOString().slice(0, 10)}.
> This is a heuristic starting point. Verify against the live site if precision matters.

## Palette

| Role | Hex |
|------|-----|
| Background | \`#${palette.bg}\` |
| Ink primary | \`#${palette.ink}\` |
| Ink muted | \`#${palette.muted}\` |
| Border | \`#${palette.border}\` |
| Brand (primary accent) | \`#${palette.accent}\` |

## Typography

\`\`\`css
--font-sans: '${type.sans}', sans-serif;${type.serif ? `\n--font-serif: '${type.serif}', serif;` : ""}
\`\`\`

| Role | Family | Size | Weight |
|------|--------|------|--------|
| Hero | ${type.sans} | hero | — |
| Body | ${type.sans} | body | — |
${slideAdaptation}
## Layout

- Radius: ${layout.radiusPx}px
- Shadows: subtle / none (verify on live site)

## Notes (auto-derivation)

${notes.map(n => `- ${n}`).join("\n")}

## When to refine

This brandbook covers the major axes (palette, typography, radius). For better fidelity:
- Inspect the live site in Playwright/devtools and read \`getComputedStyle\` on headlines
- Read the site's marketing or design-system page if one is published
- Manually tune accent values — auto-detection picks the most-frequent color, which may not be the *brand* color (could be a CTA, link, or chart series)
`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error("Usage: node derive-style.js <url> [-o output.md] [--name <name>]");
    process.exit(1);
  }
  const url = argv[0];
  const outIdx = argv.indexOf("-o");
  const outPath = outIdx >= 0 && argv[outIdx + 1];
  const nameIdx = argv.indexOf("--name");
  let name = nameIdx >= 0 && argv[nameIdx + 1];

  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ""); }
  catch (e) { console.error(`Invalid URL: ${url}`); process.exit(2); }
  name = name || host;

  console.error(`→ Fetching ${url}`);
  const html = await fetchText(url);

  const { inline, linkUrls } = extractAllStyles(html, url);
  console.error(`  HTML: ${html.length} bytes, ${inline.length} inline <style>, ${linkUrls.length} linked stylesheets`);

  // Fetch up to 12 linked stylesheets in parallel; ignore failures
  const cssPromises = linkUrls.slice(0, 12).map(u =>
    fetchText(u, 12000).catch(err => { console.error(`  ! ${u}: ${err.message}`); return ""; })
  );
  const cssTexts = await Promise.all(cssPromises);
  const css = inline.join("\n\n") + "\n\n" + cssTexts.join("\n\n");
  console.error(`  CSS combined: ${css.length} bytes`);

  const vars = extractCssVars(css);
  const bodyRules = extractBodyRules(css);
  const bodyBgRaw = extractDeclaration(bodyRules, "background-color") || extractDeclaration(bodyRules, "background");
  const bodyInkRaw = extractDeclaration(bodyRules, "color");
  const bodyFontRaw = extractDeclaration(bodyRules, "font-family");

  const bodyBg = bodyBgRaw ? hex6(resolveVar(bodyBgRaw, vars)) : null;
  const bodyInk = bodyInkRaw ? hex6(resolveVar(bodyInkRaw, vars)) : null;
  const bodyFont = bodyFontRaw ? pickFontStack(resolveVar(bodyFontRaw, vars)) : null;

  const colorCounts = countHexColors(css);
  const radiusCounts = countRadii(css);
  const palette = pickPalette(colorCounts, { bg: bodyBg, ink: bodyInk });

  // Pick most common radius (px units), or fallback
  const sortedRadii = Object.entries(radiusCounts).sort((a, b) => b[1] - a[1]);
  const radiusPx = sortedRadii.length ? Math.round(parseFloat(sortedRadii[0][0])) : 8;

  // Typography
  let sans = bodyFont || "Inter";
  let serif = null;
  // Look at common font-family declarations to detect serif
  const ffRe = /font-family\s*:\s*([^;}]+)/gi;
  const ffSeen = new Set();
  let m;
  while ((m = ffRe.exec(css)) !== null) {
    const fam = pickFontStack(resolveVar(m[1], vars));
    if (fam && !ffSeen.has(fam)) ffSeen.add(fam);
  }
  for (const fam of ffSeen) {
    if (looksSerif(fam)) { serif = fam; break; }
  }

  const notes = [];
  if (Object.keys(vars).length > 50) notes.push(`Found ${Object.keys(vars).length} CSS custom properties — high-signal source.`);
  if (linkUrls.length === 0) notes.push("No linked stylesheets — site may use inline or compiled styles only; palette inference will be weak.");
  if (!bodyBg) notes.push("Could not find explicit \`body { background }\` — palette uses frequency-inferred background.");
  if (!bodyInk) notes.push("Could not find explicit \`body { color }\` — palette uses frequency-inferred ink.");
  if (Object.keys(colorCounts).length < 5) notes.push("Very few colors in CSS — heuristic detection may misidentify accent. Verify manually.");

  const md = emitMarkdown({
    name,
    sourceUrl: url,
    palette,
    type: { sans, serif },
    layout: { radiusPx },
    notes: notes.length ? notes : ["No notable issues during extraction."],
  });

  if (outPath) {
    fs.writeFileSync(outPath, md);
    console.error(`✓ Wrote ${outPath}`);
    console.error(`  Palette: bg=#${palette.bg} ink=#${palette.ink} accent=#${palette.accent} muted=#${palette.muted} border=#${palette.border}`);
    console.error(`  Typography: sans="${sans}"${serif ? `, serif="${serif}"` : ""}`);
    console.error(`  Layout: radius=${radiusPx}px`);
    console.error(`  Next: node ${path.dirname(__filename)}/load-brandbook.js ${outPath} -o brandbook-tokens.json`);
  } else {
    process.stdout.write(md);
  }
}

main().catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
