---
name: brandware
description: Central brand and style registry manager for the knowledgeware plugin (formerly "steez"). Houses the canonical brandbook .md files, derived token JSONs, and brand assets (logos, wordmarks) that the slideware, study-guide, and chartware skills resolve named brands/styles from. Load this skill when (a) a consumer skill needs to resolve a brand/style referenced by name (e.g., "use the Provectus brand", "in the AAB style"), (b) the user asks to add, import, derive, edit, or audit a brandbook, (c) the user wants to derive a style from a live website or import one from a file/Google Drive, (d) the user wants brand assets like logos gathered for a brand, or (e) the user says "brandware" or "steez". Do NOT trigger on generic mentions of branding, marketing, or visual design that aren't about applying or managing a stored visual identity.
---

# brandware — Brand & Style Registry

One registry, many consumers. Brandbooks live here once; slideware decks, study-guide sites, and chartware diagrams all render from the same visual identity.

**Plugin root**: `${CLAUDE_PLUGIN_ROOT}` — two directories above this skill's folder (`../../` from here). All paths below are relative to it.

## Layout

```
styles/                    # the registry (plugin root)
├── *.md                   # 5 default generic styles (style-1..style-5) — marketplace-safe
├── tokens/                # derived JSON token caches for defaults
└── brands/                # brandbooks — brand-specific / proprietary (NOT in the plugin repo)
    ├── <name>.md          # canonical brandbook — THE source of truth per brand
    ├── tokens/<name>.json # derived token cache (regenerable; never hand-edit)
    └── assets/            # brand assets: <name>-logo.png, <name>-wordmark.svg, ...
scripts/                   # shared tooling (plugin root)
├── load-style.js          # style/brandbook → tokens (with cache)
├── list-styles.js         # discover what's installed
├── derive-style.js        # live website → brandbook .md (heuristic)
└── fetch-resource.sh      # Google Drive URL → local file
skills/brandware/references/
├── brandbook-spec.md      # the .md format every style and brandbook follows
├── consumer-mappings.md   # how each consumer skill maps tokens onto its medium
└── chart-styling.md       # how to style data charts (bar/line/pie/KPI) from a brandbook
```

## Rules

1. **The `.md` is canonical.** Tokens JSON is a derived cache (regenerate with `node scripts/load-style.js <name> -o styles/brands/tokens/<name>.json`). If they disagree, the `.md` wins; consumers auto-invalidate stale caches by mtime.
2. **Brands are private; styles are public.** The 5 default styles ship with the plugin. Brandbooks under `styles/brands/` are proprietary/brand-specific content, kept out of the plugin repository (`.gitignore`d) and copied in from a private source repo. Never commit a brandbook to the plugin repo.
3. **Graceful degradation.** Consumers must work when no brand is installed: slideware falls back to its five default styles, study-guide to its default palette, chartware to its default catalog. Brands add named identities; they are never a hard dependency.
4. **Brand shadows default.** On a name collision, `styles/brands/<name>.md` wins over `styles/<name>.md`.

## Resolution contract (for consumer skills)

Given a brand/style name:
1. Check `styles/brands/<name>.md` (plugin root).
2. Check `styles/<name>.md` (the 5 defaults).
3. Fall back to the consumer's bundled defaults, and say so.

Run `node scripts/list-styles.js` for the live inventory (`--default` / `--brands` / `--names` / `--json`). Consumers read the brandbook `.md` (or the token cache when fresh) and map it onto their medium per `references/consumer-mappings.md`:

| Consumer | What it consumes | Mapping |
|---|---|---|
| **slideware** | tokens JSON natively (`scripts/load-style.js` understands the registry) | built-in |
| **slideware-revealjs** | YAML-frontmatter `style.md` via its own converter (`skills/slideware-revealjs/scripts/load-style.js`) | built-in |
| **study-guide** | palette + type → template CSS variables + Mermaid themeVariables | consumer-mappings §study-guide |
| **chartware** | palette + diagram strokes + type → mxGraph style strings | consumer-mappings §chartware |
| **data charts** (any medium) | palette → categorical/sequential chart colors | references/chart-styling.md |

## Authoring workflows

### Add / import a brandbook

Filesystem-driven — no code edits:
- **From scratch or by hand**: write `styles/brands/<name>.md` following `references/brandbook-spec.md`.
- **From a local file**: a `.css` or `.md` brandbook parses directly — copy it in, then normalize toward the spec if role tables are missing.
- **From Google Drive**: `bash scripts/fetch-resource.sh <share-url> styles/brands/<name>.md` (file must be "Anyone with the link").
- **Pre-cache tokens** (optional but recommended): `node scripts/load-style.js <name> -o styles/brands/tokens/<name>.json`.

### Derive from a live website

```bash
node scripts/derive-style.js <url> -o styles/brands/<name>.md
```

Derivation is a **heuristic, not an authority** — it scrapes HTML + linked CSS and frequency-analyzes color/font usage. Always review by hand against the live site before trusting: check the accent isn't a footer link color, the canvas isn't a cookie-banner gray, and the font is the real display face (JS-injected styles may be invisible to the scraper).

### Gather brand assets (logos and similar)

When adding or enriching a brand, collect its visual assets into `styles/brands/assets/`, named `<brand>-<what>.<ext>` (e.g., `provectus-logo.svg`, `aab-wordmark.png`, `nyt-favicon.png`):

1. **Source order**: user-provided file → the brand's official press/media kit page → the live site (og:image, header logo `<img>`/inline SVG, `apple-touch-icon`, favicon).
2. **Prefer SVG** (scales to any medium); PNG at ≥512px width otherwise. Keep a dark-background variant too when the brand publishes one (`<brand>-logo-dark.svg`).
3. **Record what you gathered** in the brandbook under an `## Assets` section: filename, source URL, retrieval date, and any usage constraint noted by the brand.
4. **Respect provenance**: assets fetched from a brand's site are for that brand's own deliverables (a Provectus deck uses the Provectus logo). Never place one brand's assets in another brand's output.

Consumers embed assets by absolute path resolved from the registry (slideware `addImage`, study-guide `<img>`, chartware only when the user explicitly asks for a logo in a diagram).

### Audit

On request ("audit the brandbooks"), check each brand for: token cache staleness (`.md` newer than `.json`), spec drift (missing role tables per brandbook-spec), dead asset references in `## Assets` sections, and orphaned assets with no owning brandbook. Report; fix only what the user approves.

## Registered brands

Run `node scripts/list-styles.js --brands` for the live list. Brands are installed by copying from the private source repo (ABDotfiles `llm/claude_code/brands/` → `styles/brands/` via its `sync-brands.sh`).
