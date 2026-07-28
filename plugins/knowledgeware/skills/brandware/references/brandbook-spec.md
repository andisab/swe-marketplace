# Brandbook spec

A "brandbook" in this skill is a markdown file that describes a visual identity. It maps cleanly to pptxgenjs runtime tokens. This doc covers (1) what a brandbook must contain, (2) how it maps to pptx, and (3) how to load custom brandbooks.

## Required sections (for a brandbook to be parseable)

1. **Palette** — at least: a background color, an ink/text color, and a brand accent. Hex values, 6 chars.
2. **Typography** — at least: a sans font stack with system fallbacks, a heading family (often serif), and a base size. Optionally weight, letter-spacing, and a mono stack.
3. **Layout** — at least: a border-radius value. Optionally shadows and spacing scale.
4. **Slide adaptation** — pt values for slide-specific use (title, body, caption). If absent, the loader applies the conversion table below.

Optional but useful:
- A "Distinctive treatments" list — quick rules-of-thumb for the brand voice
- A "Gotchas" section — known traps when replicating the look

The bundled styles in `styles/` (plugin root) are reference implementations of this spec.

## CSS → pptxgenjs token mapping

| CSS concept | pptxgenjs equivalent | Notes |
|---|---|---|
| `color: #FAF9F5` | `color: "FAF9F5"` | 6-char hex, NO `#` |
| `background: #FAF9F5` | `slide.background = { color: "FAF9F5" }` | same |
| `font-size: 1.25rem` (20px) | `fontSize: 15` (pt) | web px × 0.75 = pt |
| `font-family: 'Inter', sans-serif` | `fontFace: "Inter"` | first family only |
| `font-weight: 600` | `bold: true` (>=600) or omitted | pptx is binary bold/normal |
| `font-weight: 510` (non-standard) | `bold: false` | Linear-style weights collapse to normal |
| `letter-spacing: -0.022em` at 64px | `charSpacing: -1.4` (pt) | LS × (size in pt) |
| `border-radius: 8px` | `rectRadius: 0.083` (in) | px ÷ 96 dpi |
| `box-shadow: 0 4px 16px rgba(0,0,0,0.3)` | `shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.3 }` | approximations only |
| 1px hairline border | `line: { color: "...", width: 0.5 }` | pt, not px |
| `padding: 0` on text | `margin: 0` | counterintuitive but correct |

### Web px → slide pt conversion

Slides are physical points, web is pixels. Don't 1:1 copy sizes — slides need bigger type for readability at projection distance.

| Web size | Slide pt equivalent |
|----------|---------------------|
| 12-14px body | 11-12pt body |
| 16px body (web default) | 14pt body |
| 20px subhead | 16pt subhead |
| 24-28px section h2 | 22-26pt |
| 32-48px section h1 | 28-36pt |
| 56-80px hero h1 | 40-48pt |

The bundled brandbooks already include a "Slide adaptation" table that does this conversion. Use it directly when available.

### Letter-spacing conversion

CSS `letter-spacing` is in em or px at a given size. pptxgenjs `charSpacing` is in points.

`charSpacing = (letterSpacing_em) × (fontSize_pt)`

So `-0.022em` at 40pt → `charSpacing: -0.88` (round to `-1`).

## Loading a brandbook

### Bundled brandbooks

```bash
node scripts/load-style.js anthropic   # prints tokens as JSON
node scripts/load-style.js aab
# Valid names are discovered from styles/*.md and styles/brands/*.md at runtime.
# List them: node scripts/list-styles.js (or --names / --json for scripting)
```

### Local file path

```bash
node scripts/load-style.js /path/to/my-brand.md
node scripts/load-style.js ./brandbook.css        # CSS files also accepted
```

The loader handles both:
- Markdown files with a "CSS Variables" code block (the bundled format)
- Plain `.css` files with `:root { --token: value; ... }` blocks

### Google Drive

```bash
bash scripts/fetch-resource.sh "https://drive.google.com/file/d/FILE_ID/view" ./brand.md
node scripts/load-style.js ./brand.md
```

The fetch script extracts the file ID and uses Google's direct-download URL. If the file isn't shared as "Anyone with the link", the script will return HTML (login wall); tell the user to fix the sharing permission or download manually.

### Website URL (derived on the fly)

If the user gives you a live website URL ("use the brandbook from https://anthropic.com"), you can derive a brandbook by inspecting the site's CSS:

```bash
node scripts/derive-style.js https://example.com -o ./brand.md
node scripts/load-style.js ./brand.md -o style-tokens.json
```

The script fetches the HTML, all linked stylesheets, and inline `<style>` blocks, then extracts:

- **CSS custom properties** (`--foo: #hex`) — the highest-signal source, since brands tend to define their tokens explicitly
- **Body-level rules** (`body { background, color, font-family }`) — the canonical defaults
- **Hex colors by frequency** — most common near-white = background, most common near-black = ink, most common saturated color = accent
- **Border-radius distribution** — most common value
- **Font-family declarations** — first non-system font (likely the brand font), plus a serif if one is present in the stack

The emitted markdown follows the same format as the bundled brandbooks; the loader consumes it without modification.

**Caveats** (the script will print these as `notes` in the output when relevant):

- **Compiled CSS strips signal.** Sites that pre-compile Tailwind, CSS-in-JS, or Webpack-bundled styles will have fewer custom properties exposed. The accent detection may pick a chart color or CTA blue instead of the actual brand color.
- **The accent is the most-frequent saturated color**, which isn't always the brand color. For Anthropic.com, this picks `#3898EC` (a generic link blue) instead of `#D97757` (clay) because clay is used sparingly. Always check the result against the live site.
- **JS-rendered styles are invisible.** If the site only applies its brand styles after JS hydration, the static CSS extraction will miss them. For these, use the bundled brandbook if one exists, or fall back to the sample-deck workflow.
- **No JS execution.** The script uses raw HTTP fetch, not a headless browser. For sites that need rendering (SPAs without server-side fallback), the script's output may be incomplete.

**Refining the derivation:**

After running the script, read the output `brand.md` and the live site side-by-side. If a value looks wrong:
- Swap the accent for what the live site actually uses (the script picks the most-frequent saturated color — often a link blue or CTA color, not the brand mark color)
- Replace fonts if the script picked a fallback (e.g., "Arial" because the brand font's name was wrapped in quotes the regex didn't capture)
- Adjust the slide-adaptation pt values if the live site uses unusual base sizes

A 60-second manual refinement on top of a 5-second auto-derivation is much faster than authoring a brandbook from scratch.

**Example:**

```bash
$ node scripts/derive-style.js https://linear.app -o ./linear-live.md
→ Fetching https://linear.app
  HTML: 2371860 bytes, 1 inline <style>, 15 linked stylesheets
  CSS combined: 770295 bytes
✓ Wrote ./linear-live.md
  Palette: bg=#FFFFFF ink=#08090A accent=#5E6AD2 muted=#8A8F98 border=#F7F8F8
  Typography: sans="Inter"
  Layout: radius=8px
```

For Linear, the derivation picked up `#08090A` (their exact ink), `#5E6AD2` (their exact brand indigo), Inter, 8px radius — within ~5 seconds. Bg defaults to `#FFFFFF` because Linear's marketing page is light-mode-first; the bundled `linear` brandbook uses `#08090A` for their canonical dark mode.

## What the loader emits

```javascript
{
  "name": "anthropic",
  "palette": {
    "bg":          "FAF9F5",
    "surface":     "FFFFFF",
    "ink":         "141413",
    "inkMuted":    "5E5D59",
    "border":      "E0DCD5",
    "accent":      "D97757",   // primary brand accent
    "accent2":     "C46686",   // secondary if defined
    "semantic": {
      "success":   "16A34A",
      "warning":   "D97706",
      "error":     "DC2626"
    }
  },
  "type": {
    "sans":        "Inter",
    "serif":       "Source Serif 4",
    "mono":        "JetBrains Mono",
    "bodyPt":      14,
    "titlePt":     32,
    "heroPt":      44,
    "captionPt":   10,
    "letterSpacingDisplay": -0.5     // pt for display sizes
  },
  "layout": {
    "radius":      0.083,            // inches (rounded rect rectRadius)
    "shadowOpacity": 0.12,
    "marginIn":    0.5
  }
}
```

This object is meant to be destructured at the top of the build script:

```javascript
const brand = require("./style-tokens.json");
const { palette: P, type: T, layout: L } = brand;
// ...
slide.background = { color: P.bg };
slide.addText("Title", { fontSize: T.titlePt, fontFace: T.serif, color: P.ink });
```

## Writing a custom brandbook

If you want to author a new brandbook, copy one of the bundled `.md` files as a starting template. The required structure:

```markdown
# Brand Name — Brandbook

> One-paragraph mood / voice description.

## Palette

| Role | Hex |
|------|-----|
| Background | `#...` |
| Ink primary | `#...` |
| ...

## Typography

```css
--font-sans: '...';
--font-serif: '...';
```

| Role | Size | Weight | LS |
|------|------|--------|----|
| Hero | 64px | 700 | -0.02em |
| Body | 16px | 400 | 0 |

## Slide adaptation (16:9)

| Role | pt |
|------|----|
| Title | 32 |
| Body | 14 |
| Caption | 10 |

## Layout

- Radius: 8px
- Shadows: subtle / none

## Distinctive treatments

1. ...

## Gotchas

- ...
```

The loader uses simple regex/markdown parsing — keep the table formats consistent with the bundled brandbooks.
