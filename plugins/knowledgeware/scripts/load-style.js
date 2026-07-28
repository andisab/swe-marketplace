#!/usr/bin/env node
// load-style.js — parse a style/brandbook (bundled name | local .md | local .css) into pptxgenjs tokens.
// Usage:
//   node load-style.js <name|path>           # prints JSON to stdout
//   node load-style.js <name|path> -o out.json
//
// Bundled styles are discovered at runtime from two locations (plugin root = ../ from here):
//   - styles/*.md         → 5 default generic styles (style-1 through style-5), marketplace-safe
//   - styles/brands/*.md  → brandbooks (brand-specific / proprietary; copied in from a private
//                           repo and NOT checked into the plugin repository)
//
// "Style" and "brandbook" are interchangeable terms; both describe the same .md spec.
// Brands shadow defaults on name collision.

const fs = require("fs");
const path = require("path");

const STYLES_DIR = path.join(__dirname, "..", "styles");
const BRANDS_DIR = path.join(STYLES_DIR, "brands");

// Discover bundled styles from default + brand directories. Brand shadows default
// if names collide. tokens/ subdirectories are excluded — they hold cached JSON.
function listBundled() {
  const found = new Map();  // name → { name, source, kind }
  for (const [dir, kind] of [[STYLES_DIR, "default"], [BRANDS_DIR, "brand"]]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md") || /^readme\.md$/i.test(f)) continue;
      const name = f.replace(/\.md$/, "");
      // Later iterations (brand) overwrite earlier (default) — brand shadows default
      found.set(name, { name, source: path.join(dir, f), kind });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function findBundled(name) {
  return listBundled().find(b => b.name === name) || null;
}

function resolveSource(input) {
  const hit = findBundled(input);
  if (hit) return hit.source;
  if (fs.existsSync(input)) return path.resolve(input);
  const names = listBundled().map(b => b.name).join(", ");
  throw new Error(`Style/brandbook not found: "${input}". Use one of [${names}] or a valid file path.`);
}

// Pre-built tokens for bundled styles — skips parse if file is fresh.
function tryPrebuiltTokens(input) {
  const hit = findBundled(input);
  if (!hit) return null;
  const tokensDir = hit.kind === "brand"
    ? path.join(BRANDS_DIR, "tokens")
    : path.join(STYLES_DIR, "tokens");
  const cachePath = path.join(tokensDir, `${input}.json`);
  const srcPath = hit.source;
  if (!fs.existsSync(cachePath) || !fs.existsSync(srcPath)) return null;
  // Invalidate cache if the .md is newer than the cached .json
  if (fs.statSync(srcPath).mtimeMs > fs.statSync(cachePath).mtimeMs) return null;
  return cachePath;
}

// strip "#" prefix, lowercase, ensure 6 chars
function hex6(c) {
  if (!c) return null;
  c = c.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(c)) c = c.split("").map(x => x + x).join("");
  if (!/^[0-9a-f]{6}$/.test(c)) return null;
  return c.toUpperCase();
}

function firstHexFromLine(line) {
  const m = line.match(/#([0-9a-fA-F]{6})/);
  return m ? m[1].toUpperCase() : null;
}

// Scan rows of `| Role | #hex | notes |` markdown tables for known role keywords.
// Patterns may match in the role cell OR the notes cell — many brandbooks describe
// the role in a different column (e.g. role="Light-blue", notes="Primary accent").
function harvestTableRoles(text) {
  const out = {};
  // Order matters — more specific patterns first so "background dark" wins before "background".
  const roleMap = [
    // bgDark only for explicitly-secondary dark surfaces (NOT for "Background (navy canvas)" which IS bg)
    [/\bbackground (?:deep|hero)\b/i, "bgDark"],
    [/\bdark canvas \(hero\)/i, "bgDark"],
    [/\b(?:hero|dark) bg\b/i, "bgDark"],
    [/\bbackground (?:alt|secondary|subtle|quiet|subdued|offset)\b/i, "surfaceAlt"],
    [/\bsurface alt\b/i, "surfaceAlt"],
    [/\bbackground\b/i, "bg"],
    [/\bcanvas\b/i, "bg"],
    [/\bsurface(?! alt)\b/i, "surface"],
    [/\b(?:card|panel|tile|surface white)\b/i, "surface"],
    [/\bink primary\b/i, "ink"],
    [/\btext (?:primary|solid|emphasized|heading)\b/i, "ink"],
    [/\bink body\b/i, "inkBody"],
    [/\bink \(text solid\)\b/i, "ink"],
    [/\b(?:ink|text) (?:soft|muted|secondary|paragraph|subdued|quiet)\b/i, "inkMuted"],
    [/\bsecondary text\b/i, "inkMuted"],
    [/\b(?:ink|text) faint\b/i, "inkFaint"],
    [/\brule strong\b/i, "borderStrong"],
    [/\b(?:border|rule|hairline)\b/i, "border"],
    // EXCLUDE dark/inverted variants from primary accent
    // Primary brand accent — match high-specificity terms first; exclude "on dark" rows
    [/\bprimary accent\b/i, "accentMaybe"],
    [/\b(?:brand (?:primary|bg)|brand-bg)\b/i, "accentMaybe"],
    [/\bbrand violet\b/i, "accentMaybe"],
    [/\bcta blue\b/i, "accentMaybe"],
    [/\bblue primary\b/i, "accentMaybe"],
    [/\bbreaking red\b/i, "accentMaybe"],
    [/\bindigo cta\b/i, "accentMaybe"],
    [/\bclay \(brand\)/i, "accentMaybe"],
    [/\bbrand\b/i, "accentMaybe"],
    [/\bclay\b/i, "accentMaybe"],
    [/\b(?:indigo|violet)(?! cta)\b/i, "accentMaybe"],
    [/\blink \(inline\)/i, "accentMaybe"],
    [/\b(?:link|cta)\b/i, "accentMaybe"],
    [/\baccent(?!.*hover)\b/i, "accent2Maybe"],
    [/\bsuccess\b/i, "success"],
    [/\b(?:error|danger)\b/i, "error"],
    [/\bwarning\b/i, "warning"],
  ];
  text.split("\n").forEach(line => {
    if (!line.includes("|")) return;
    const cells = line.split("|").map(s => s.trim()).filter(Boolean);
    if (cells.length < 2) return;
    const hex = firstHexFromLine(line);
    if (!hex) return;
    // Concatenate non-hex cells so patterns can match anywhere in the row text.
    const searchText = cells.filter(c => !/^`?#[0-9a-fA-F]{3,6}`?$/.test(c)).join(" | ");
    // Skip dark-inverted / on-dark rows for accent candidates — they're the alternate, not the primary
    const isDarkVariant = /\b(?:on dark|dark-inverted|inverse|brighter sky|secondary)\b/i.test(searchText);
    for (const [pattern, key] of roleMap) {
      if (!pattern.test(searchText)) continue;
      if ((key === "accentMaybe" || key === "accent2Maybe") && isDarkVariant) continue;
      const finalKey = key === "accentMaybe" ? "accent"
                     : key === "accent2Maybe" ? "accent2"
                     : key;
      if (!out[finalKey]) { out[finalKey] = hex; break; }
    }
  });
  return out;
}

// Extract :root { --foo: value } variables from CSS or markdown code blocks
function harvestCssVars(text) {
  const out = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

// Pull a font family from CSS-style declarations
function harvestFonts(cssVars) {
  const pick = (k) => {
    const v = cssVars[k];
    if (!v) return null;
    const m = v.match(/['"]([^'"]+)['"]/);
    return m ? m[1] : v.split(",")[0].trim();
  };
  return {
    sans:  pick("font-sans") || pick("font-body") || pick("f-font-sans") || pick("hds-font-family"),
    serif: pick("font-serif") || pick("font-display") || null,
    mono:  pick("font-mono") || pick("font-monospace") || pick("f-font-mono") || null,
  };
}

// "Slide adaptation" table parser: rows like `| Title slide | 44 |` or `| Body | 14 | 400 |`
function harvestSlideScale(text) {
  const out = {};
  const lines = text.split("\n");
  let inSlideTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/slide adaptation/i.test(line)) inSlideTable = true;
    if (inSlideTable && /^##+\s/.test(line) && !/slide adaptation/i.test(line)) inSlideTable = false;
    if (!inSlideTable) continue;
    if (!line.includes("|")) continue;
    const cells = line.split("|").map(s => s.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const role = cells[0].toLowerCase();
    const sizeMatch = cells[1].match(/^\d+(\.\d+)?/);
    if (!sizeMatch) continue;
    const pt = parseFloat(sizeMatch[0]);
    if (/title slide|hero/.test(role)) out.heroPt = pt;
    else if (/section title|section header/.test(role)) out.sectionPt = pt;
    else if (/slide title|title/.test(role)) out.titlePt = pt;
    else if (/sub-?bullet|sub item|sub-?head/.test(role)) out.subBodyPt = pt;
    else if (/body|paragraph|bullet/.test(role)) out.bodyPt = pt;
    else if (/caption|footnote|meta/.test(role)) out.captionPt = pt;
    else if (/code/.test(role)) out.codePt = pt;
  }
  return out;
}

function build(srcPath) {
  const text = fs.readFileSync(srcPath, "utf8");
  const name = path.basename(srcPath).replace(/\.(md|css)$/i, "");

  const tableRoles = harvestTableRoles(text);
  const cssVars = harvestCssVars(text);
  const fonts = harvestFonts(cssVars);
  const scale = harvestSlideScale(text);

  // Fallbacks if a brandbook only exposes CSS vars and not tables
  const accentFromCss =
    hex6(cssVars["accent"]) ||
    hex6(cssVars["clay"]) ||
    hex6(cssVars["indigo"]) ||
    hex6(cssVars["violet"]) ||
    hex6(cssVars["light-blue"]) ||
    hex6(cssVars["blue-primary"]) ||
    null;

  const palette = {
    bg:        tableRoles.bg        || hex6(cssVars["bg"]) || "FFFFFF",
    bgDark:    tableRoles.bgDark    || hex6(cssVars["bg-dark"]) || null,
    surface:   tableRoles.surface   || hex6(cssVars["surface"]) || hex6(cssVars["bg-card"]) || "FFFFFF",
    surfaceAlt:tableRoles.surfaceAlt|| hex6(cssVars["surface-alt"]) || hex6(cssVars["bg-quiet"]) || null,
    ink:       tableRoles.ink       || hex6(cssVars["ink"]) || "121212",
    inkBody:   tableRoles.inkBody   || hex6(cssVars["ink-body"]) || null,
    inkMuted:  tableRoles.inkMuted  || hex6(cssVars["ink-muted"]) || "5A5A5A",
    inkFaint:  tableRoles.inkFaint  || hex6(cssVars["ink-faint"]) || null,
    border:    tableRoles.border    || hex6(cssVars["rule"]) || hex6(cssVars["border"]) || "E0E0E0",
    accent:    tableRoles.accent    || accentFromCss || "5E6AD2",
    accent2:   tableRoles.accent2   || null,
    success:   tableRoles.success   || "16A34A",
    warning:   tableRoles.warning   || "D97706",
    error:     tableRoles.error     || "DC2626",
  };

  const type = {
    sans:  fonts.sans  || "Inter",
    serif: fonts.serif || "Georgia",
    mono:  fonts.mono  || "JetBrains Mono",
    heroPt:    scale.heroPt    || 44,
    sectionPt: scale.sectionPt || 32,
    titlePt:   scale.titlePt   || 28,
    bodyPt:    scale.bodyPt    || 14,
    subBodyPt: scale.subBodyPt || 12,
    captionPt: scale.captionPt || 10,
    codePt:    scale.codePt    || 12,
  };

  // Parse a radius (px) and convert to inches for rectRadius
  let radiusPx = 6;
  if (cssVars["radius"] || cssVars["radius-main"]) {
    const v = (cssVars["radius"] || cssVars["radius-main"]).match(/(\d+(\.\d+)?)\s*(px|rem)?/);
    if (v) {
      const n = parseFloat(v[1]);
      const unit = (v[3] || "px").toLowerCase();
      radiusPx = unit === "rem" ? n * 16 : n;
    }
  }

  const layout = {
    radiusIn: +(radiusPx / 96).toFixed(3),
    radiusPx,
    shadowOpacity: 0.12,
    marginIn: 0.5,
  };

  return { name, source: srcPath, palette, type, layout };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error("Usage: node load-brandbook.js <name|path> [-o out.json]");
    console.error(`Bundled: ${listBundled().map(b => b.name).join(" ")}`);
    process.exit(1);
  }
  const cached = tryPrebuiltTokens(argv[0]);
  const json = cached
    ? fs.readFileSync(cached, "utf8")
    : JSON.stringify(build(resolveSource(argv[0])), null, 2);
  const name = JSON.parse(json).name;

  const outIdx = argv.indexOf("-o");
  if (outIdx >= 0 && argv[outIdx + 1]) {
    fs.writeFileSync(argv[outIdx + 1], json);
    console.error(`Wrote ${argv[outIdx + 1]} (${name}${cached ? ", from cache" : ""})`);
  } else {
    process.stdout.write(json + (json.endsWith("\n") ? "" : "\n"));
  }
}

if (require.main === module) main();
module.exports = { build, listBundled };
