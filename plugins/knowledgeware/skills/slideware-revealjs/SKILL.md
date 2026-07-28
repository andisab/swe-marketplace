---
name: slideware-revealjs
description: "Create style-driven HTML slide decks with Reveal.js. Use when the user asks for an HTML presentation, web-based slides, a Reveal.js deck, slides to host or share via link, or a single-file HTML deck. Triggers: 'reveal', 'reveal.js', 'HTML deck', 'web presentation', 'browser slides', 'share a link', or .html as output. Also when they reference a 'style' or 'brandbook' (.md or .css visual identity) and want HTML rather than PowerPoint. Resolves styles from the knowledgeware plugin's shared registry — 5 default generic styles plus the styles/brands/ brandbooks managed by the brandware skill (style and brandbook are interchangeable). Same visual identity as slideware (.pptx), study-guide, and chartware — one brandbook, every medium. Output is a single self-contained index.html with Reveal core via CDN, Google Fonts via link tag, theme CSS inlined. 8 layout archetypes plus a render-and-review loop via headless Chromium. Do NOT use for: PowerPoint, .pptx, or Keynote (use the slideware skill), image generation, PDF reports, or static landing pages."
license: MIT
compatibility: claude-code, claude-ai, api
---

# slideware-revealjs

Generate visually rich, style-driven HTML slide decks using **Reveal.js + js-yaml** (Node.js). Output is a single `index.html` that runs in any modern browser, share-able via link or hosted statically.

Opinionated about one thing: **don't make boring slides.** Plain bullets on white aren't worth your reader's time.

## Reference map

| Need | Read |
|------|------|
| End-to-end workflow (fast + full paths) | [references/workflow.md](references/workflow.md) |
| 8 layout archetypes | [references/layout-patterns.md](references/layout-patterns.md) |
| Visual principles (hierarchy, color, type, spacing) | [references/visual-principles.md](references/visual-principles.md) |
| Reveal.js API + theme conventions | [references/reveal.md](references/reveal.md) |
| Brandbook → CSS-variable mapping | [references/brandbook-spec.md](references/brandbook-spec.md) |

**Recommended order**: layout-patterns → visual-principles → reveal (when you hit a specific API question).

## Style / brandbook resolution (priority order)

"Style" and "brandbook" mean the same thing here — both are .md files with **YAML frontmatter** carrying the design tokens and a markdown body describing the visual identity (palette + type + layout). The renderer reads the frontmatter; the LLM reads both. **Same format as slideware-pptx** — one brandbook, two output formats.

1. **Explicit local path** — read directly.
2. **Bundled name** — discovered at runtime from the plugin registry (plugin root = `../../` from this skill):
   - `styles/*.md` — 5 default generic styles (`style-1` through `style-5`)
   - `styles/brands/*.md` — brandbooks (managed by the **brandware** skill; shadows defaults on name collision)

   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/list-styles.js` to see the current list (or `--default` / `--brands` / `--names` / `--json`).
3. **Local `.css` or non-frontmatter `.md`** — same loader as bundled names (below); it parses the input and prepends YAML frontmatter, or passes through unchanged if the input already has frontmatter.
4. **No style given** — pick `style-1` (Editorial Light) and tell the user.

**Staging a style for a build** (registry styles are prose brandbooks; this skill's loader converts them to the frontmatter form the renderer needs):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js <name|path> -o ./style.md
```

The renderer (`build-deck.js`) reads `./style.md` and extracts tokens from its YAML frontmatter. There is no separate tokens.json file — the tokens live in the .md.

## Token → CSS mapping

The renderer converts `style.md` frontmatter to CSS variables:

| Token | CSS variable | Notes |
|---|---|---|
| `palette.bg` | `--color-bg` | Hex with `#` (CSS expects it; no strip) |
| `palette.bgDark` | `--color-bg-dark` | Falls back to `palette.ink` if missing |
| `palette.surface`, `surfaceAlt` | `--color-surface`, `--color-surface-alt` | |
| `palette.ink`, `inkBody`, `inkMuted`, `inkFaint` | `--color-ink`, `--color-ink-body`, etc. | |
| `palette.accent`, `accent2` | `--color-accent`, `--color-accent2` | |
| `type.sans`, `serif`, `mono` | `--font-sans`, `--font-serif`, `--font-mono` | Generates matching Google Fonts `<link>` |
| `type.heroPt`, `titlePt`, `bodyPt`, ... | `--size-hero`, `--size-title`, `--size-body`, ... | Points (CSS supports `pt` natively) |
| `layout.radiusPx` | `--radius` | Pixels |
| `layout.shadowOpacity` | `--shadow-opacity` | 0-1 |
| `layout.marginIn` | `--margin` | Inches (CSS supports `in`) |

**Critical**: unlike pptxgenjs (which needs hex *without* `#`), CSS expects the `#`. The build-deck.js does NOT strip it.

## Two paths

| Path | When | Cycle |
|---|---|---|
| **Fast** | 1-3 slides, throwaway, prototype | scaffold → author → build → ship |
| **Full** | ≥4 slides, anything shipped | + render → inspect every PNG at full size → find ≥1 issue → iterate 2-3× |

See [workflow.md](references/workflow.md) for both. Don't pay the full-path tax on a throwaway deck.

## Pitfalls (single canonical home — read once, refer back)

- **Slide dimensions are 1280×720 px** in `build-deck.js`. Reveal's default 960×700 is too small for our type scale. Don't author at the default size.
- **Theme CSS rules MUST be scoped under `.reveal`** — Reveal's reset is aggressive and unprefixed rules get clobbered.
- **`display=swap` on the Google Fonts URL** is required — without it, you get FOIT (invisible text during load).
- **Don't reference `./style.md` from the output HTML.** Output must stand alone. The build inlines theme CSS into a `<style>` block.
- **CDN URL is pinned** (`reveal.js@5.0.5`). Bumping the version is a deliberate change — diff the output HTML after.
- **Reveal initializes with `controls`, `progress`, `slideNumber`, and `transition: 'fade'`** by default. Override these only if you have a reason — match the medium (kiosk, walkthrough, recorded presentation).
- **Image references in slides** are relative paths the deck dir; if you ship a `.skill` or move the deck, images break unless you base64-inline them or fetch from an absolute URL.
- **Markdown-style content in body strings** is NOT processed — slides take light HTML (`<strong>`, `<em>`, `<code>`, `<br>`, `<a>`). Don't author `<h1>`/`<h2>` tags; layouts emit their own heading hierarchy.
- **`card-row` overflows beyond 4 cards** on 1280×720. Split across two slides or use a different layout.
- **Long unbreakable tokens wrap mid-character.** URLs, code identifiers, and uppercase headings with letter-spacing can be wider than their card/column track. The theme CSS forces them to break (overflow-wrap: anywhere + min-width: 0 on grid items) so they don't push past the slide's right edge — but mid-token wraps still look bad. `polish-deck.py` flags any unbreakable run > 28 chars in a card or > 50 chars in a column. Shorten the URL, abbreviate the identifier, or insert a soft hyphen (`&shy;`) at a sensible break point.

## Anti-monotony rule

The point is **content-shape variety**, not visual-archetype rigidity. A deck that walks through one consistent story (a brand pitch, a single hypothesis) can reuse a layout once if doing so reinforces the through-line. A 6-slide *survey* of unrelated topics should use 5-6 distinct archetypes; a 6-slide *narrative* with three parallel proof points can run three card-row slides if that's the actual content structure.

The failure mode to avoid is **reaching for cards because the template defaulted to cards**, not "I reused a layout deliberately." If you reach for the same archetype twice without articulating why, swap one out. See [layout-patterns.md](references/layout-patterns.md) for the 8 archetypes.

## Output convention

Default `<cwd>/index.html` unless the user specifies. Print the absolute path after writing. Open it in a browser via `open ./index.html` (macOS), `xdg-open` (Linux), or `start` (Windows) — Reveal works over `file://` for local preview.

For sharing via link: drop the directory on any static host (GitHub Pages, Netlify, S3) — no build pipeline needed.

## Style mimicry (style only, never content)

When the user provides a sample HTML deck or screenshots:

- For an HTML deck: open in browser, inspect computed styles via DevTools, extract palette/type/layout tokens, encode as `style.md`. Use `node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js <path-to-css> -o ./style.md` if there's a standalone CSS file.
- For screenshots: read 3-4 representative slide images. Derive palette, type pairing, layout patterns, motif, density. Apply to the new deck. **Don't copy content.**

**Mimicry overrides anti-monotony.** If the sample has a distinctive non-standard layout, faithfully echoing *that* layout matters more than picking from the canonical 8 archetypes.
