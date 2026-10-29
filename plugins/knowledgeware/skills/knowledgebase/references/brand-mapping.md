# Brand mapping: brandbook tokens → the page template

How this skill renders a registry style or brandbook (resolution and the rules every consumer follows: brandware's `references/consumer-contract.md`). Token names refer to the derived `tokens.json` beside each `brand.md`; when the brandbook's prose defines richer detail than the tokens carry (heading colours, reserved faces), read the `.md` directly — it is canonical.

The page template is fully CSS-custom-property-driven, fonts included: retheming is replacing the `:root` blocks, plus the Mermaid init below.

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
| `--font-body` | `type.sans` (web-safe stack fallback) | body text and nav |
| `--font-heading` | the brandbook's headline face: `type.serif` when headlines are serif, else `type.sans` | `h1`, `h2`, nav brand. Read the brandbook's prose: some reserve the serif for other roles (e.g. metrics only), and then headings take the sans |
| `--font-mono` | `type.mono` (web-safe stack fallback) | `code`, `.kbd` |

**Dark mode.** If the brandbook has a `paletteDark`, use it. If not (`bgDark` null), derive conservatively (invert neutrals, keep the accent hue, drop saturation ~15%) or keep the template's default dark block — say which you did.

## Mermaid themeVariables

In the template's init: `primaryColor` = 12% accent tint over bg · `primaryBorderColor` = accent · `primaryTextColor` = ink · `secondaryColor/Border` = success tint/stroke · `tertiaryColor/Border` = warning tint/stroke · `lineColor` = ink at ~70% (NOT the accent — edges should recede) · `edgeLabelBackground` = bg · `fontFamily` = the brand sans. Chartware's Mermaid medium uses the same block.
