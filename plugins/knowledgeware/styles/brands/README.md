# styles/brands/ — brand registry (content not in this repo)

Brandbooks, their token caches, and brand assets (logos, wordmarks) are **brand-specific / proprietary content** and are deliberately excluded from this repository (see `.gitignore` in this directory). Only the 5 generic styles one level up (`styles/style-1.md` … `style-5.md`) ship with the plugin.

Brands are installed by copying from a private source repo into this directory:

```
brands/
├── <name>.md            # canonical brandbook (spec: skills/brandware/references/brandbook-spec.md)
├── tokens/<name>.json   # derived token cache (regenerable via scripts/load-style.js)
└── assets/              # <name>-logo.svg, <name>-wordmark.png, ...
```

To add, import, derive, or audit a brandbook — or gather its logo assets — use the **brandware** skill. The plugin works fully without any brands installed: slideware falls back to the 5 generic styles, study-guide to its default palette, chartware to its default catalog.
