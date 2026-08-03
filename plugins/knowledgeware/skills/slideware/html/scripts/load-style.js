#!/usr/bin/env node
// load-style.js — resolve a style/brandbook input into a frontmatter-bearing .md.
//
// Inputs:
//   - Bundled name (e.g. "style-2", "anthropic") — resolved from the plugin registry: styles/[brands/]
//   - Local .md path (with or without YAML frontmatter)
//   - Local .css path
//
// Output:
//   - Frontmatter-bearing .md written to stdout (or -o <path>)
//   - If input already has frontmatter, it's copied through unchanged
//   - Otherwise parser extracts tokens from prose tables / CSS vars and prepends frontmatter
//
// Usage:
//   node load-style.js style-2 -o ./style.md
//   node load-style.js ./my-brand.css -o ./style.md
//   node load-style.js ./bundled.md            # prints to stdout

const fs = require("fs");
const os = require("os");
const path = require("path");

const STYLES_DIR = path.join(__dirname, "..", "..", "..", "..", "styles");   // plugin root registry
const BRANDS_DIR = path.join(STYLES_DIR, "brands");

// User-owned registry from $KNOWLEDGEWARE_BRANDS_DIR (with ~ expansion), or null.
function resolveUserBrandsDir() {
  let d = process.env.KNOWLEDGEWARE_BRANDS_DIR;
  if (!d || !d.trim()) return null;
  d = d.trim();
  if (d === "~") d = os.homedir();
  else if (d.startsWith("~/")) d = path.join(os.homedir(), d.slice(2));
  return path.resolve(d);
}
const USER_BRANDS_DIR = resolveUserBrandsDir();

// ── Discovery ────────────────────────────────────────────────────────────
// Discover bundled styles from the plugin registry plus the optional user brands
// directory. On name collision: user brands shadow plugin brands shadow defaults.
function listBundled() {
  const found = new Map();
  const dirs = [[STYLES_DIR, "default"], [BRANDS_DIR, "brand"]];
  if (USER_BRANDS_DIR) dirs.push([USER_BRANDS_DIR, "brand"]);
  for (const [dir, kind] of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md") || /^readme\.md$/i.test(f)) continue;
      const name = f.replace(/\.md$/, "");
      found.set(name, { name, source: path.join(dir, f), kind });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function resolveSource(input) {
  const hit = listBundled().find(b => b.name === input);
  if (hit) return hit.source;
  if (fs.existsSync(input)) return path.resolve(input);
  const names = listBundled().map(b => b.name).join(", ");
  throw new Error(`Style/brandbook not found: "${input}". Use one of [${names}] or a valid file path.`);
}

// ── Frontmatter detection ────────────────────────────────────────────────
function hasFrontmatter(text) {
  return /^---\r?\n/.test(text) && /\n---\r?\n/.test(text);
}

// ── Parser helpers (used only when input lacks frontmatter) ──────────────
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

function harvestTableRoles(text) {
  const out = {};
  const roleMap = [
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
    const searchText = cells.filter(c => !/^`?#[0-9a-fA-F]{3,6}`?$/.test(c)).join(" | ");
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

function harvestCssVars(text) {
  const out = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

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

  return { name, palette, type, layout };
}

// ── Frontmatter serialization ────────────────────────────────────────────
// Inline YAML serializer for the fixed token schema. Quoted strings throughout
// to avoid all hex/number coercion surprises. Palette values get a '#' prefix
// so IDEs render inline color swatches; the renderer strips it at parse time.
function serializeFrontmatter(tokens, description) {
  const { name, palette: P, type: T, layout: L } = tokens;
  const v = (x) => x === null || x === undefined ? "null" : (typeof x === "string" ? `'${x}'` : x);
  const hx = (x) => x == null ? "null" : `'#${String(x).replace(/^#/, "")}'`;
  const lines = [
    "---",
    `name: ${name}`,
  ];
  if (description) lines.push(`description: ${description}`);
  lines.push(
    "palette:",
    `  bg:         ${hx(P.bg)}`,
    `  bgDark:     ${hx(P.bgDark)}`,
    `  surface:    ${hx(P.surface)}`,
    `  surfaceAlt: ${hx(P.surfaceAlt)}`,
    `  ink:        ${hx(P.ink)}`,
    `  inkBody:    ${hx(P.inkBody)}`,
    `  inkMuted:   ${hx(P.inkMuted)}`,
    `  inkFaint:   ${hx(P.inkFaint)}`,
    `  border:     ${hx(P.border)}`,
    `  accent:     ${hx(P.accent)}`,
    `  accent2:    ${hx(P.accent2)}`,
    `  success:    ${hx(P.success)}`,
    `  warning:    ${hx(P.warning)}`,
    `  error:      ${hx(P.error)}`,
    "type:",
    `  sans:      ${v(T.sans)}`,
    `  serif:     ${v(T.serif)}`,
    `  mono:      ${v(T.mono)}`,
    `  heroPt:    ${T.heroPt}`,
    `  sectionPt: ${T.sectionPt}`,
    `  titlePt:   ${T.titlePt}`,
    `  bodyPt:    ${T.bodyPt}`,
    `  subBodyPt: ${T.subBodyPt}`,
    `  captionPt: ${T.captionPt}`,
    `  codePt:    ${T.codePt}`,
    "layout:",
    `  radiusIn:      ${L.radiusIn}`,
    `  radiusPx:      ${L.radiusPx}`,
    `  shadowOpacity: ${L.shadowOpacity}`,
    `  marginIn:      ${L.marginIn}`,
    "---",
    "",
  );
  return lines.join("\n");
}

// Build the output .md text for inputs that lack frontmatter.
// - For .md inputs: prepend frontmatter, keep original body
// - For .css inputs: prepend frontmatter + a substantive prose body — the prose
//   layer is what the pptx heuristic loader and the model-read consumers
//   (chartware, knowledgebase) work from, so a one-line body would half-break them.
function buildOutputMd(srcPath, srcText) {
  const tokens = build(srcPath);
  const fm = serializeFrontmatter(tokens, `Auto-derived from ${path.basename(srcPath)}`);
  if (/\.css$/i.test(srcPath)) {
    return fm + prosifyTokens(tokens, path.basename(srcPath));
  }
  return fm + srcText;
}

// Render tokens as a prose body following the brandbook spec's required sections.
function prosifyTokens(t, srcLabel) {
  const { palette: P, type: T, layout: L } = t;
  const row = (role, hex) => hex ? `| ${role} | \`#${String(hex).replace(/^#/, "")}\` |\n` : "";
  return `# ${t.name} — Derived style

> Auto-derived from \`${srcLabel}\`. Heuristic starting point — verify palette/typography against the source before trusting.

## Palette

| Role | Hex |
|------|-----|
${row("Background", P.bg)}${row("Background dark (hero)", P.bgDark)}${row("Surface", P.surface)}${row("Ink primary", P.ink)}${row("Ink muted", P.inkMuted)}${row("Border", P.border)}${row("Brand (primary accent)", P.accent)}${row("Accent 2", P.accent2)}
## Typography

\`\`\`css
--font-sans: '${T.sans}', sans-serif;${T.serif ? `\n--font-serif: '${T.serif}', serif;` : ""}${T.mono ? `\n--font-mono: '${T.mono}', monospace;` : ""}
\`\`\`

## Slide adaptation (16:9)

| Role | pt |
|------|----|
| Title slide H1 | ${T.heroPt} |
| Section title | ${T.sectionPt} |
| Slide title | ${T.titlePt} |
| Body | ${T.bodyPt} |
| Caption | ${T.captionPt} |

## Layout

- Radius: ${L.radiusPx}px
- Shadows: opacity ${L.shadowOpacity} (verify against the source)
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error("Usage: node load-style.js <name|path> [-o out.md]");
    console.error(`Bundled: ${listBundled().map(b => b.name).join(" ")}`);
    process.exit(1);
  }

  const srcPath = resolveSource(argv[0]);
  const srcText = fs.readFileSync(srcPath, "utf8");
  const outText = hasFrontmatter(srcText) ? srcText : buildOutputMd(srcPath, srcText);

  const outIdx = argv.indexOf("-o");
  if (outIdx >= 0 && argv[outIdx + 1]) {
    fs.writeFileSync(argv[outIdx + 1], outText);
    const note = hasFrontmatter(srcText) ? "frontmatter present, copied through" : "frontmatter generated";
    console.error(`Wrote ${argv[outIdx + 1]} (${note})`);
  } else {
    process.stdout.write(outText + (outText.endsWith("\n") ? "" : "\n"));
  }
}

if (require.main === module) main();
module.exports = { build, listBundled, serializeFrontmatter, hasFrontmatter };
