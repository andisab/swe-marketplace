# Brand mapping: brandbook tokens → the diagram catalog

How this skill renders a registry style or brandbook in draw.io and SVG diagrams (resolution, the intent rules every consumer follows, and the "understated" principles that govern branded diagrams: brandware's `references/consumer-contract.md`). For Mermaid, apply the `themeVariables` block in the knowledgebase skill's `references/brand-mapping.md`. For data charts in any medium, brandware's `references/chart-styling.md`.

Style-string substitutions against the catalog in `styles.md`:

| Catalog element | Brandbook mapping |
|---|---|
| `box_standard` | fill `surface`, stroke `border` → or categorical, font `ink` |
| decision rhombus | fill = accent @ ~18% tint over bg, stroke `accent` |
| `header_gray` | fill `border`-tone, font `inkMuted` |
| terminal/outcome box | stroke `success` (2px), fill `surface` |
| governance/constraint note | stroke `error` (1px), fill `surface` |
| `arrow_primary` / edges | stroke = darkened `accent` (or `ink` @ 70% for quiet diagrams), labels `inkBody`, `labelBackgroundColor=<bg>` |
| `cylinder_*` (data) | fill = data-category stroke @ 30% tint |
| fonts | `fontFamily=<brand sans>` + `fontSource=<urlencoded Google Fonts URL>` if the font is a free Google Font; otherwise fall back to Helvetica and note it |

**Categorical strokes.** If the brandbook defines diagram categories (some do: Application, Security, Ops, Data, Neutral, each with a hex), use them verbatim. Otherwise derive four: accent (application), error (security/risk), accent2-or-desaturated-accent (ops), success (data) — all applied as strokes on white fills, never as fills.

**Verification.** After rendering, squint-test the screenshot: if the first thing you see is colour rather than structure, it's over-branded; pull fills back toward `surface`.
