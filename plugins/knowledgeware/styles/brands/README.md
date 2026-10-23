# styles/brands/ — brand registry

Brandbooks, their token caches, and per-brand assets (logos, wordmarks) are **brand-specific / proprietary content** and are excluded from this repository (see `.gitignore` here) — with one exception: **`acmecorp`**, a fictional checked-in example that demonstrates the layout. Only the 5 generic styles one level up (`styles/style-1.md` … `style-5.md`) plus acmecorp ship with the plugin.

Layout (one brand = one folder, the same shape as the five default styles one level up; see `../README.md`):

```
brands/
├── DEFAULT                # optional one-line marker: registry name consumers use when no style is named
└── <name>/
    ├── brand.md           # canonical brandbook (spec: skills/brandware/references/brandbook-spec.md)
    ├── tokens.json        # derived token cache (regenerable via scripts/load-style.js)
    ├── assets/            # logo-light.svg, logo-dark.svg, mark.svg, wordmark.png, ... (never mixed across brands)
    ├── css/<name>.css     # optional stylesheet for pages not built by a skill
    └── README.md          # provenance and usage
```

The older flat layout (`<name>.md` + `tokens/<name>.json` + `<name>/assets/`) is still read.

Real brands are installed in one of two ways:

1. **Preferred — your own directory**: set `KNOWLEDGEWARE_BRANDS_DIR` (in `~/.claude/settings.json` under `"env"`) to a directory anywhere on disk with this same layout. It survives plugin updates, its entries shadow this directory on name collision, and its `DEFAULT` marker wins. See the plugin README, *Bring your own brands directory*.
2. **Copy into this directory** from a private source repo. Note this directory is replaced on every plugin update — re-copy afterwards.

To add, import, derive, or audit a brandbook — gather logos, or install a brand's Google Fonts locally (`scripts/install-fonts.sh`) — use the **brandware** skill. The plugin works fully without any brands installed: slideware falls back to the 5 generic styles, knowledgebase to its default palette, chartware to its default catalog.
