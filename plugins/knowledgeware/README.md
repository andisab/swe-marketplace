# knowledgeware

**One visual identity, every medium.** Four skills that produce polished deliverables — slide decks, multi-page HTML knowledge bases, architecture diagrams — all rendering from a single shared brand/style registry. Define your visual identity once; every deck, site, and diagram matches.

## The four skills

| Skill | What it makes | How to invoke |
|---|---|---|
| **slideware** | Slide decks in two formats: PowerPoint (`.pptx` via pptxgenjs) or single-file HTML (Reveal.js) | "Make me a pitch deck for X" — it asks pptx vs HTML when unclear |
| **knowledgebase** | Multi-page, offline-capable HTML knowledge bases: field guides, handbooks, runbooks, study guides | Explicit invocation only: "use the knowledgebase skill to build a field guide on X" or `/knowledgebase` |
| **chartware** | Enterprise-grade architecture diagrams via the draw.io MCP | "Draw a reference architecture for X" |
| **brandware** | The registry manager: import/derive brandbooks, gather logos, install fonts, set defaults | "Derive a brandbook from example.com", "add a brand", "audit the brandbooks" |

Skills activate on matching requests (see each `SKILL.md` description for exact triggers). Name a style or brand in any request — "in the acmecorp brand", "style-3" — and the deliverable renders in that identity.

## How the registry works

```
styles/                    # the registry (plugin root)
├── style-1.md … style-5.md   # 5 generic styles, ship with the plugin
├── tokens/                    # derived JSON caches for the styles
└── brands/                    # brandbooks inside the plugin install (user-local, gitignored)
$KNOWLEDGEWARE_BRANDS_DIR/     # YOUR brands directory — anywhere you like (see next section)
├── DEFAULT                    # optional: one line naming your default identity
├── <name>.md                  # canonical brandbook per brand
├── tokens/<name>.json         # derived token cache (regenerable)
└── <name>/assets/             # per-brand logos, wordmarks
```

- A **brandbook** is one `.md` file describing a visual identity — palette, typography, layout, components — following `skills/brandware/references/brandbook-spec.md`. The checked-in `acmecorp` brand is a complete fictional example.
- **Resolution order**: named brand (your directory first, then `styles/brands/<name>.md`) → named generic style (`styles/<name>.md`) → the `DEFAULT` marker (when nothing is named; your directory's marker wins) → each skill's bundled fallback. Brands shadow generic styles on name collision.
- Every consumer maps the same brandbook onto its medium (`skills/brandware/references/consumer-mappings.md`), so a deck, a knowledge-base site, and a diagram built from the same brand look like one document family.
- Inventory at any time: `node scripts/list-styles.js` (flags: `--brands`, `--names`, `--json`).

## Bring your own brands directory

Since brands are proprietary or often personalized, knowledgeware ships only the five generic styles (plus the fictional `acmecorp` example) out of the box — but lets you both **a)** build and designate your own directory of brands and **b)** designate your default go-to brand or style, in one step. Point `KNOWLEDGEWARE_BRANDS_DIR` at any directory you own:

```jsonc
// ~/.claude/settings.json — set it here (not just your shell profile),
// so it's present in every Claude Code session
{
  "env": {
    "KNOWLEDGEWARE_BRANDS_DIR": "~/my-brands"
  }
}
```

The directory follows the same conventions as `styles/brands/`:

```
~/my-brands/
├── DEFAULT                # optional: one line naming your go-to brand, e.g. "provectus"
├── <name>.md              # a brandbook
├── tokens/<name>.json     # derived cache (regenerable)
└── <name>/assets/         # any gathered logos
```

Because it lives outside the plugin install, **everything in it survives plugin updates** — no re-syncing after `claude plugin update knowledgeware`. It's also a natural thing to make a private git repo. Entries here shadow same-named plugin entries, and its `DEFAULT` marker wins over the plugin's.

Without the env var, everything below still works — brands just live in `styles/brands/` inside the plugin install and must be re-copied after each update (see *Surviving plugin updates*).

## Add a custom brand

Three routes, all filesystem-driven — no code edits. `$BRANDS` below means your `KNOWLEDGEWARE_BRANDS_DIR` (or `<plugin-root>/styles/brands` without one):

```bash
cd <plugin-root>   # e.g. ~/.claude/plugins/cache/<marketplace>/knowledgeware/<version>

# 1. Derive from a live website (heuristic — review the result by hand)
node scripts/derive-style.js https://example.com -o $BRANDS/example.md

# 2. Import an existing .md/.css brandbook (or fetch from Google Drive)
cp ~/my-brandbook.md $BRANDS/example.md
bash scripts/fetch-resource.sh <drive-share-url> $BRANDS/example.md

# 3. Write one by hand, following the spec + the acmecorp example
#    skills/brandware/references/brandbook-spec.md
```

Then (optional but recommended):

```bash
node scripts/load-style.js example -o $BRANDS/tokens/example.json  # pre-cache tokens
bash scripts/install-fonts.sh example      # install its Google Fonts locally (needed for pptx)
mkdir -p $BRANDS/example/assets            # drop logo-light.svg / logo-dark.svg here
```

Or just ask: *"add a brand for example.com"* — the brandware skill runs this workflow, gathers logos, and records provenance in the brandbook.

## Set your brand as the default

```bash
echo example > $BRANDS/DEFAULT
```

From then on, every deck, knowledge base, and diagram uses that identity unless a request names a different one. Remove the file to return to the built-in defaults. `list-styles.js` shows the current default with a `DEFAULT` tag.

## Surviving plugin updates

If you set `KNOWLEDGEWARE_BRANDS_DIR` (see *Bring your own brands directory*), there's nothing to do — your brands live outside the plugin and updates can't touch them.

Without it, `styles/brands/` lives inside the plugin install directory, and **plugin updates replace that directory** — your brandbooks, tokens, assets, and `DEFAULT` marker are wiped. Keep the originals in a private repo (brandbooks are usually proprietary and should not be committed to a public plugin fork) and re-copy them after each update. A sync script as simple as:

```bash
cp -Rp ~/my-brands/. <plugin-root>/styles/brands/
```

run after `claude plugin update knowledgeware` restores everything. See `styles/brands/README.md`.

## Requirements

- **Node.js** — registry scripts, slideware's pptx build (pptxgenjs fetched at build time), and the bundled draw.io MCP server (`@drawio/mcp`, fetched via npx on first chartware use)
- **Google Fonts access** — font installation (pptx) and font loading (HTML outputs); everything degrades gracefully offline

### Optional tooling

Everything below enhances a workflow but is never required — skills detect what's missing, deliver what they can, and point here.

| Tool | Used by | Without it | Install |
|---|---|---|---|
| **LibreOffice** | slideware pptx slide previews | deck still builds; no preview PNGs | `brew install --cask libreoffice` (macOS) · `sudo apt-get install -y libreoffice` (Debian/Ubuntu) |
| **poppler** (`pdftoppm`) | slideware pptx slide previews | same as above | `brew install poppler` · `sudo apt-get install -y poppler-utils` |
| **Playwright MCP** | chartware & slideware visual verification loops | diagrams/decks still produced; no automated screenshot review | `claude plugin install playwright@claude-plugins-official` |
