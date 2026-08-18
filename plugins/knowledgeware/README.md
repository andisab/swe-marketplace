# knowledgeware

**One visual identity, every medium.** Slide decks, knowledge-base sites, and diagrams that all render from the same style — define your visual identity once and every deliverable matches.

**Works out of the box.** Five built-in styles, a fictional example brand, no setup. Your own brands are optional — add them when you're ready (see *Advanced* below).

## What you get

Four skills. Ask for the deliverable in plain language; the right skill activates.

| Skill | What it gives you |
|---|---|
| **slideware** | Slide decks as real PowerPoint files or as self-contained HTML (Reveal.js) — your choice; it asks when unclear. Visually reviews its own output and fixes mistakes when preview tooling is available. |
| **knowledgebase** | Multi-page, offline-capable HTML reference sites — field guides, handbooks, runbooks, study guides — written in a rigorous engineering voice. Every site ships a maintenance page built to a machine-actionable contract, so the bundled maintainer (below) can keep it fresh unattended. Explicit invocation only ("use the knowledgebase skill…"). |
| **chartware** | Diagrams and data charts in three media: Mermaid (quick, text-first), SVG (pixel-perfect charts and figures), or draw.io (editable artifacts — best for complicated DAGs and layered architectures). Follows your brand automatically. |
| **brandware** | Teaches the other three what your colors, fonts, and logos are. Define a brand by hand, import one from a file — or point it at a website and let it derive the style from the live CSS and assets. |

Name any style or brand in any request — "in the acmecorp brand", "style-3" — and the deliverable renders in that identity. A **brandbook** is just one `.md` file describing a visual identity; the built-in `acmecorp` example shows the format.

## Try it

Copy-paste and adapt:

- *"Use slideware to create a Reveal.js presentation from this markdown document."*
- *"Make me a pitch deck for our Q4 platform roadmap."* (it will ask: PowerPoint or HTML?)
- *"Use chartware to create a draw.io DAG of the services in this repository."*
- *"Make an SVG bar chart of quarterly revenue for this page."*
- *"Use the knowledgebase skill to create a field guide on TensorFlow. I'd like it to cover…"*
- *"Use chartware for all diagrams in the generated knowledgebase document."*
- *"Use brandware to build a brand style from https://example.com and set it as the default."*

After that last one, every deck, site, and diagram uses that identity until you say otherwise.

## Keeping knowledgebases fresh

Volatile facts (prices, quotas, versions, GA statuses) rot. Generated sites carry a maintenance page whose master volatility table is an executable work order — and the plugin ships a maintainer that executes it:

- **`kb-maintainer` agent** — reads the maintenance page, re-verifies only the facts whose check cadence has elapsed (nothing redundant), fans out research subagents against primary sources, applies confirmed changes surgically, bumps `Last verified` stamps it earned, writes the changelog row, and reports structural drift as suggestions without ever restructuring the site.
- **`/knowledgeware:kb-maintain <site-dir> [--dry-run]`** — the scheduler entry point. Put it on a weekly cron:

```bash
claude -p "/knowledgeware:kb-maintain '/path/to/site'" --permission-mode acceptEdits --model opus
```

Start with `--dry-run` to see what a sweep would change before letting it write. The contract both sides follow lives at `skills/knowledgebase/references/maintenance.md`; sites built before the contract existed are handled tolerantly (sections are matched semantically, deviations reported).

## The five built-in styles

Pick by name (`style-1` … `style-5`) or let the skill choose:

| Style | Personality | Use for |
|---|---|---|
| **style-1** — Editorial Light | Warm cream canvas, serif headings, coral accent — "a thoughtful long-form article" | Research write-ups, polished pitches with gravitas |
| **style-2** — Minimal | Pure white, single sans, indigo accent under 5% of the page | Product announcements, design-led decks |
| **style-3** — Dark Precision | Deep dark canvas, tight tracking, bright violet | Engineering reviews, premium SaaS material |
| **style-4** — Warm Sage | Warm gray, outlined-not-filled containers, sage green | Technical write-ups that should feel hand-crafted |
| **style-5** — Material Olive | Material Design 3 palette: olive/sage/teal on cream-green | Roadmaps, work wanting natural authority |

## Requirements

**Required:**
- **Node.js** — slideware builds and the registry scripts; draw.io diagrams additionally use the bundled MCP server (fetched via npx on first use). Mermaid and SVG output need nothing.
- **Python 3** — slideware's deck-QA scripts.

**Optional — never blocking.** Skills detect what's missing, deliver anyway, and tell you which check was skipped:

| Tool | Used for | Without it | Install |
|---|---|---|---|
| **LibreOffice** | pptx slide previews (visual QA) | deck still builds; no preview review | `brew install --cask libreoffice` · `sudo apt-get install -y libreoffice` |
| **poppler** (`pdftoppm`) | pptx slide previews | same as above | `brew install poppler` · `sudo apt-get install -y poppler-utils` |
| **Playwright MCP** (or Claude in Chrome) | chartware & slideware visual verification loops | output still produced; no automated screenshot review | `claude plugin install playwright@claude-plugins-official` |
| **markitdown** | reading an existing `.pptx` (style mimicry, rebuilds) | can't extract text from existing decks | `pip install markitdown` |
| **Google Fonts access** | brand font installation (pptx) and font loading (HTML) | system-font fallbacks | — |

---

*Everything below is advanced — you don't need it to use the plugin.*

## Using your own brand

The easy way is to just ask: *"add a brand for example.com"* — the brandware skill derives the style, gathers logos, records provenance, and stores it in the right place. Set it as your default with *"set example as the default brand"* (or `echo example > $BRANDS/DEFAULT`).

Manual routes, if you prefer (`$BRANDS` = your brands directory, next section — or `<plugin-root>/styles/brands` without one):

```bash
# 1. Derive from a live website (heuristic — review the result by hand)
node scripts/derive-style.js https://example.com -o $BRANDS/example.md

# 2. Import an existing .md/.css brandbook (or fetch from Google Drive)
cp ~/my-brandbook.md $BRANDS/example.md
bash scripts/fetch-resource.sh <drive-share-url> $BRANDS/example.md

# 3. Write one by hand: skills/brandware/references/brandbook-spec.md + the acmecorp example
```

Logos and wordmarks live in a per-brand folder: `$BRANDS/example/assets/`. Fonts install automatically when slideware builds a pptx; to install a brand's Google Fonts manually, `bash scripts/install-fonts.sh example`.

## Your own brands directory (survives plugin updates)

Since brands are proprietary or personal, keep them in a directory **you** own, anywhere on disk, and point the plugin at it:

```jsonc
// ~/.claude/settings.json — set it here (not just your shell profile),
// so it's present in every Claude Code session
{
  "env": {
    "KNOWLEDGEWARE_BRANDS_DIR": "~/my-brands"
  }
}
```

```
~/my-brands/
├── DEFAULT                # optional: one line naming your go-to brand, e.g. "acmecorp"
├── <name>.md              # a brandbook
├── tokens/<name>.json     # derived cache (regenerated automatically)
└── <name>/assets/         # logos, wordmarks
```

Because it lives outside the plugin install, **everything in it survives plugin updates** — nothing to re-sync, ever. It's also a natural thing to make a private git repo. Entries here shadow same-named plugin entries, and its `DEFAULT` marker wins.

Without the env var, brands go in `styles/brands/` inside the plugin install — which plugin updates replace. In that mode, keep originals elsewhere and re-copy after each update (`cp -Rp ~/my-brands/. <plugin-root>/styles/brands/`); see `styles/brands/README.md`.

## How resolution works

```
$KNOWLEDGEWARE_BRANDS_DIR/     # your directory (highest precedence)
styles/brands/                 # brandbooks inside the plugin install
styles/                        # the 5 generic styles (lowest)
```

Named brand → named generic style → the `DEFAULT` marker (when nothing is named; your directory's marker wins) → each skill's bundled fallback. Same-named entries shadow in that order. Every consumer maps the same brandbook onto its medium (`skills/brandware/references/consumer-mappings.md`), so a deck, a site, and a diagram from the same brand look like one document family. Inventory at any time: `node scripts/list-styles.js` (`--brands`, `--names`, `--json`).
