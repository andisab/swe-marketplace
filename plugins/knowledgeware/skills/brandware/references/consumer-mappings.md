# Consumer Mappings

How each consumer skill translates a registry brandbook into its medium. Token names refer to the derived JSON (`styles/brands/tokens/<name>.json` at the plugin root); when a brandbook defines richer detail than the tokens carry (e.g., heading colors, diagram stroke categories), read the `.md` directly — it is canonical.

For **data charts** (bar/line/pie/scatter/KPI tiles) in any medium, see `chart-styling.md` in this directory.

## slideware

Native, both formats. The pptx format uses the shared `scripts/load-style.js` (plugin root) → tokens JSON; the html format uses its own converter (`skills/slideware/html/scripts/load-style.js`) → YAML-frontmatter `style.md` (CSS variables + Google Fonts link). Both resolve the registry directly (brand shadows default on name collision). Nothing to map by hand.

## knowledgebase

The page template is fully CSS-custom-property-driven; retheming = replacing the `:root` blocks and font stack.

| Template variable | Brandbook token | Notes |
|---|---|---|
| `--bg` | `palette.bg` | canvas |
| `--panel` / `--panel2` | `palette.surfaceAlt` / `palette.surface` | swap if surfaceAlt is lighter than surface |
| `--ink` | `palette.ink` | |
| `--muted` | `palette.inkMuted` | |
| `--accent` / `--accent-dark` | `palette.accent` (darken ~15% for `-dark`) | nav-active, drill borders |
| `--border` | `palette.border` | |
| `--tip` / `--warn` | `palette.success` / `palette.warning` (bg = 10–12% tint over `--bg`) | |
| `--arch` | `palette.accent2` if set, else a desaturated accent | |
| `--link` | `--accent-dark` | |
| body font | `type.sans` (web-safe stack fallback) | headings keep serif if brandbook has one (`type.serif`) |

Dark mode: if the brandbook has no dark palette (`bgDark` null), derive conservatively (invert neutrals, keep accent hue, drop saturation ~15%) or keep the template's default dark block — say which you did.

**Mermaid themeVariables** (in the template's init): `primaryColor` = 12% accent tint over bg · `primaryBorderColor` = accent · `primaryTextColor` = ink · `secondaryColor/Border` = success tint/stroke · `tertiaryColor/Border` = warning tint/stroke · `lineColor` = ink at ~70% (NOT the accent — edges should recede) · `edgeLabelBackground` = bg · `fontFamily` = the brand sans.

## chartware

Goal: **tastefully coordinated, understated**. A branded diagram should read as the brand's document, not a poster of its logo colors. Principles before mappings:

1. **Neutral ink carries the diagram; accents annotate it.** Boxes are `surface` fill + neutral or categorical stroke; the brand accent appears in at most TWO roles (primary flow edges, or the single highlighted node) — never as a background wash.
2. **Outlined, not filled.** Default containers: `fillColor=<surface>`, 1px stroke. Filled shapes are reserved for decision nodes (accent at ~20% tint) and header bars (`border`-tone gray).
3. **Low saturation everywhere.** If a brandbook accent is loud (Stripe violet, Figma indigo), tint fills to 10–15% over the canvas and keep the pure accent for edges/labels only.

Style-string substitutions against the chartware catalog:

| Catalog element | Brandbook mapping |
|---|---|
| `box_standard` | fill `surface`, stroke `border`→or categorical, font `ink` |
| decision rhombus | fill = accent @ ~18% tint over bg, stroke `accent` |
| `header_gray` | fill `border`-tone, font `inkMuted` |
| terminal/outcome box | stroke `success` (2px), fill `surface` |
| governance/constraint note | stroke `error` (1px), fill `surface` |
| `arrow_primary` / edges | stroke = darkened `accent` (or `ink` @ 70% for quiet diagrams), labels `inkBody`, `labelBackgroundColor=<bg>` |
| `cylinder_*` (data) | fill = data-category stroke @ 30% tint |
| fonts | `fontFamily=<brand sans>` + `fontSource=<urlencoded Google Fonts URL>` if the font is a free Google Font; otherwise fall back to Helvetica and note it |

**Categorical strokes:** if the brandbook defines diagram categories (AAB does: Application `#A9C4EB`, Security `#EA6B66`, Ops `#99CCFF`, Data `#7FB069`, Neutral `#808080`), use them verbatim. Otherwise derive four: accent (application), error (security/risk), accent2-or-desaturated-accent (ops), success (data) — all applied as strokes on white fills, never as fills.

Verification: after rendering, squint-test the screenshot — if the first thing you see is color rather than structure, it's over-branded; pull fills back toward `surface`.

## Adding a consumer

A new consumer documents its mapping here (one section), resolves per the brandware SKILL.md contract, and must run acceptably with no brands installed.
