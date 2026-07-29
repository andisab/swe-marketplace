# styles/brands/ — brand registry

Brandbooks, their token caches, and per-brand assets (logos, wordmarks) are **brand-specific / proprietary content** and are excluded from this repository (see `.gitignore` here) — with one exception: **`acmecorp`**, a fictional checked-in example that demonstrates the layout. Only the 5 generic styles one level up (`styles/style-1.md` … `style-5.md`) plus acmecorp ship with the plugin.

Layout (one brand = one `.md` + one tokens cache + one asset folder):

```
brands/
├── <name>.md              # canonical brandbook (spec: skills/brandware/references/brandbook-spec.md)
├── tokens/<name>.json     # derived token cache (regenerable via scripts/load-style.js)
└── <name>/assets/         # per-brand assets: logo-light.svg, logo-dark.svg, wordmark.png, ...
                           #   (one folder per brand — assets from different brands never mix)
```

Real brands are installed by copying from a private source repo into this directory. To add, import, derive, or audit a brandbook — gather logos, or install a brand's Google Fonts locally (`scripts/install-fonts.sh`) — use the **brandware** skill. The plugin works fully without any brands installed: slideware falls back to the 5 generic styles, knowledgebase to its default palette, chartware to its default catalog.
