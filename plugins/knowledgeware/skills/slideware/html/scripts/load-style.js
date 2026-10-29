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

const PLUGIN_ROOT = path.join(__dirname, "..", "..", "..", "..");
const registry = require(path.join(PLUGIN_ROOT, "scripts", "registry.js"));
const { listBundled } = registry;

function resolveSource(input) {
  const hit = registry.findBundled(input);
  if (hit) return hit.source;
  if (fs.existsSync(input)) return path.resolve(input);
  const names = listBundled().map(b => b.name).join(", ");
  throw new Error(`Style/brandbook not found: "${input}". Use one of [${names}] or a valid file path.`);
}
// The brand's logo files, staged next to the output style.md as ./assets/, where build-deck.js
// reads them for the running footer. Registry brands keep them in their assets/ folder (a local
// brand.md in an assets/ folder beside it); the generic styles have a mark but no logo, so a deck
// in a generic style gets no logo. Returns the names copied.
const LOGO_FILES = ["logo-light.svg", "logo-dark.svg"];
function stageLogos(input, srcPath, outPath) {
  const hit = registry.findBundled(input);
  const assetsDir = hit ? hit.assetsDir : path.join(path.dirname(srcPath), "assets");
  const found = LOGO_FILES.filter(f => fs.existsSync(path.join(assetsDir, f)));
  if (!found.length) return [];
  const dest = path.join(path.dirname(path.resolve(outPath)), "assets");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of found) fs.copyFileSync(path.join(assetsDir, f), path.join(dest, f));
  return found;
}

// ── Frontmatter detection ────────────────────────────────────────────────
function hasFrontmatter(text) {
  return /^---\r?\n/.test(text) && /\n---\r?\n/.test(text);
}

// ── Parsing (only when the input lacks frontmatter) ──────────────────────
// The plugin's loader owns the brandbook parser (the frontmatter precision layer first, then
// the prose-table and CSS-variable heuristics); this converter only writes its tokens back out
// as frontmatter. One parser, so a brandbook reads the same in both deck formats.
const { build } = require(path.join(PLUGIN_ROOT, "scripts", "load-style.js"));

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
  );
  for (const key of ["paletteDark", "paletteLight"]) {
    if (!tokens[key]) continue;
    lines.push(`${key}:`);
    for (const [k, val] of Object.entries(tokens[key])) lines.push(`  ${(k + ":").padEnd(12)}${hx(val)}`);
  }
  lines.push("---", "");
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
    const logos = stageLogos(argv[0], srcPath, argv[outIdx + 1]);
    console.error(`Wrote ${argv[outIdx + 1]} (${note}${logos.length ? `; logo staged in ./assets/: ${logos.join(", ")}` : "; no logo: the style has none"})`);
  } else {
    process.stdout.write(outText + (outText.endsWith("\n") ? "" : "\n"));
  }
}

if (require.main === module) main();
module.exports = { build, listBundled, serializeFrontmatter, hasFrontmatter, stageLogos };
