---
name: brandware
description: Central brand and style registry manager for the knowledgeware plugin (formerly "steez"). Houses the canonical brandbook .md files, derived token JSONs, and brand assets (logos, wordmarks) that the slideware, knowledgebase, and chartware skills resolve named brands/styles from. Load this skill when (a) a consumer skill needs to resolve a brand/style referenced by name (e.g., "use the Provectus brand", "in the AAB style"), (b) the user asks to add, import, derive, edit, or audit a brandbook, or to set or change the default brand/style, (c) the user wants to derive a style from a live website or import one from a file/Google Drive, (d) the user wants brand assets like logos gathered for a brand, or (e) the user says "brandware" or "steez". Do NOT trigger on generic mentions of branding, marketing, or visual design that aren't about applying or managing a stored visual identity.
---

# brandware — Brand & Style Registry

One registry, many consumers. Brandbooks live here once; slideware decks, knowledgebase sites, and chartware diagrams all render from the same visual identity.

**Plugin root**: `${CLAUDE_PLUGIN_ROOT}` — two directories above this skill's folder (`../../` from here). All paths below are relative to it.

## Layout

```
styles/                    # the registry (plugin root)
├── *.md                   # 5 default generic styles (style-1..style-5) — marketplace-safe
├── tokens/                # derived JSON token caches for defaults
└── brands/                # brandbooks — brand-specific / proprietary (NOT in the plugin repo,
    │                      #   except the checked-in acmecorp example)
    ├── DEFAULT            # optional one-line marker: the registry name to use when no style is named
    ├── <name>.md          # canonical brandbook — THE source of truth per brand
    ├── tokens/<name>.json # derived token cache (regenerable; never hand-edit)
    └── <name>/assets/     # per-brand assets: logo-light.svg, wordmark.png, ... (never mixed across brands)
$KNOWLEDGEWARE_BRANDS_DIR/ # OPTIONAL user-owned brands directory — same layout as styles/brands/
    │                      #   (DEFAULT marker, <name>.md, tokens/, <name>/assets/). Lives anywhere
    │                      #   the user chooses, so it SURVIVES plugin updates. Entries here shadow
    │                      #   plugin entries on name collision; its DEFAULT marker wins too.
scripts/                   # shared tooling (plugin root)
├── load-style.js          # style/brandbook → tokens (with cache)
├── list-styles.js         # discover what's installed
├── derive-style.js        # live website → brandbook .md (heuristic)
├── install-fonts.sh       # install a brand's Google Fonts locally (see §Fonts)
└── fetch-resource.sh      # Google Drive URL → local file
skills/brandware/references/
├── brandbook-spec.md      # the .md format every style and brandbook follows
├── consumer-mappings.md   # how each consumer skill maps tokens onto its medium
└── chart-styling.md       # how to style data charts (bar/line/pie/KPI) from a brandbook
```

## Rules

1. **The `.md` is canonical.** Tokens JSON is a derived cache (regenerate with `node scripts/load-style.js <name> -o styles/brands/tokens/<name>.json`). If they disagree, the `.md` wins; consumers auto-invalidate stale caches by mtime.
2. **Brands are private; styles are public.** The 5 default styles ship with the plugin. Brandbooks under `styles/brands/` are proprietary/brand-specific content, kept out of the plugin repository (`.gitignore`d) and copied in from a private source repo. Never commit a brandbook to the plugin repo.
3. **Graceful degradation.** Consumers must work when no brand is installed: slideware falls back to its five default styles, knowledgebase to its default palette, chartware to its default catalog. Brands add named identities; they are never a hard dependency.
4. **Brand shadows default.** On a name collision: `$KNOWLEDGEWARE_BRANDS_DIR/<name>.md` wins over `styles/brands/<name>.md`, which wins over `styles/<name>.md`.
5. **Prefer the user directory when it exists.** Anything inside the plugin install (`styles/brands/`) is wiped by plugin updates. When `KNOWLEDGEWARE_BRANDS_DIR` is set, write new brandbooks, token caches, assets, and the DEFAULT marker there. When it isn't set and the user imports a brand, warn them it won't survive updates and suggest setting the env var (in `~/.claude/settings.json` under `"env"`, so it's present in every session).

## Resolution contract (for consumer skills)

0. **No name given?** Check the `DEFAULT` marker — a one-line file containing a registry name. `$KNOWLEDGEWARE_BRANDS_DIR/DEFAULT` wins if the env var is set; otherwise `styles/brands/DEFAULT`. If it exists and resolves (steps 1–3 below), use that identity and tell the user; if it's absent or names a missing entry, use the consumer's bundled defaults.

Given a brand/style name:
1. Check `$KNOWLEDGEWARE_BRANDS_DIR/<name>.md` (if the env var is set).
2. Check `styles/brands/<name>.md` (plugin root).
3. Check `styles/<name>.md` (the 5 defaults).
4. Fall back to the consumer's bundled defaults, and say so.

The registry scripts (`load-style.js`, `list-styles.js`, and slideware html's converter) implement this order natively — pass a name and they search all three locations.

Run `node scripts/list-styles.js` for the live inventory (`--default` / `--brands` / `--names` / `--json`). Consumers read the brandbook `.md` (or the token cache when fresh) and map it onto their medium per `references/consumer-mappings.md`:

| Consumer | What it consumes | Mapping |
|---|---|---|
| **slideware** (pptx format) | tokens JSON natively (`scripts/load-style.js` understands the registry) | built-in |
| **slideware** (html format) | YAML-frontmatter `style.md` via its converter (`skills/slideware/html/scripts/load-style.js`) | built-in |
| **knowledgebase** | palette + type → template CSS variables + Mermaid themeVariables | consumer-mappings §knowledgebase |
| **chartware** | palette + diagram strokes + type → mxGraph style strings | consumer-mappings §chartware |
| **data charts** (any medium) | palette → categorical/sequential chart colors | references/chart-styling.md |

## Authoring workflows

### Add / import a brandbook

Filesystem-driven — no code edits. **Destination**: `$KNOWLEDGEWARE_BRANDS_DIR/` when the env var is set (survives plugin updates — preferred), else `styles/brands/` (warn: wiped on update). `<dest>` below means that directory:
- **From scratch or by hand**: write `<dest>/<name>.md` following `references/brandbook-spec.md`.
- **From a local file**: a `.css` or `.md` brandbook parses directly — copy it in, then normalize toward the spec if role tables are missing.
- **From Google Drive**: `bash scripts/fetch-resource.sh <share-url> <dest>/<name>.md` (file must be "Anyone with the link").
- **Pre-cache tokens** (optional but recommended): `node scripts/load-style.js <name> -o <dest>/tokens/<name>.json`.

### Set a default brand

```bash
echo <name> > <dest>/DEFAULT   # e.g. echo acmecorp > ~/my-brands/DEFAULT
```

Every consumer skill then uses that identity whenever the user doesn't name a style (resolution contract step 0). Remove the file to return to each consumer's bundled defaults. In `$KNOWLEDGEWARE_BRANDS_DIR` the marker persists across plugin updates (and wins over the plugin's marker); in `styles/brands/` it is user-local (gitignored) and wiped by updates — keep a copy in your private brand source alongside the brandbooks.

### Derive from a live website

```bash
node scripts/derive-style.js <url> -o <dest>/<name>.md   # <dest> per §Add / import
```

Derivation is a **heuristic, not an authority** — it scrapes HTML + linked CSS and frequency-analyzes color/font usage. Always review by hand against the live site before trusting: check the accent isn't a footer link color, the canvas isn't a cookie-banner gray, and the font is the real display face (JS-injected styles may be invisible to the scraper).

### Gather brand assets (logos and similar)

When adding or enriching a brand, collect its visual assets into the brand's own folder `<dest>/<brand>/assets/` (`<dest>` per §Add / import), named by role (e.g., `provectus/assets/logo-light.svg`, `aab/assets/wordmark.png`, `nyt/assets/favicon.png`) — one folder per brand so assets from different brands never mix:

1. **Source order**: user-provided file → the brand's official press/media kit page → the live site (og:image, header logo `<img>`/inline SVG, `apple-touch-icon`, favicon).
2. **Prefer SVG** (scales to any medium); PNG at ≥512px width otherwise. Keep a dark-background variant too when the brand publishes one (`logo-dark.svg`).
3. **Record what you gathered** in the brandbook under an `## Assets` section: filename, source URL, retrieval date, and any usage constraint noted by the brand.
4. **Respect provenance**: assets fetched from a brand's site are for that brand's own deliverables (a Provectus deck uses the Provectus logo). Never place one brand's assets in another brand's output.

Consumers embed assets by absolute path resolved from the registry (slideware `addImage`, knowledgebase `<img>`, chartware only when the user explicitly asks for a logo in a diagram).

### Fonts

Brandbooks **name** fonts (in the `## Typography` CSS variables); the registry stores **no font binaries** — prefer families available on [Google Fonts](https://fonts.google.com) so they're installable and linkable everywhere. Per medium:

- **pptx (slideware)**: fonts must be installed on the authoring machine or PowerPoint/LibreOffice silently substitutes — run the installer below before building/previewing a deck.
- **HTML (slideware html format, knowledgebase)**: loads fonts via a Google Fonts `<link>`; viewers need nothing installed.
- **chartware**: embeds a `fontSource` Google Fonts URL in the mxGraph style; draw.io loads it.

Install a brand's fonts locally (macOS `~/Library/Fonts`, Linux `~/.local/share/fonts`):

```bash
bash scripts/install-fonts.sh <brand|style|font name>   # e.g. provectus, style-1, "Lora"
bash scripts/install-fonts.sh --check provectus          # report without installing
```

The installer resolves a registry name to its sans/serif/mono families, skips system/web-safe fonts and anything already installed, fetches TTFs from Google Fonts, and names files `GF-<Family>-<n>.ttf` so re-runs overwrite instead of duplicating. Non–Google-Fonts families (proprietary faces) are reported for manual installation — note where to obtain them in the brandbook's `## Typography` or `## Assets` section.

### Audit

On request ("audit the brandbooks"), check each brand for: token cache staleness (`.md` newer than `.json`), spec drift (missing role tables per brandbook-spec), dead asset references in `## Assets` sections, orphaned `<name>/assets/` folders with no owning brandbook, and fonts not installed locally (`install-fonts.sh --check <name>`). Report; fix only what the user approves.

## Registered brands

Run `node scripts/list-styles.js --brands` for the live list. **acmecorp** is a checked-in fictional example demonstrating the brand-folder layout (brandbook + tokens + `acmecorp/assets/`); real brands are installed either by pointing `KNOWLEDGEWARE_BRANDS_DIR` at a user-owned brands directory (preferred — survives updates) or by copying into `styles/brands/` from a private source repo (e.g., ABDotfiles `llm/claude_code/brands/` via its `sync-brands.sh`).
