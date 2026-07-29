# Knowledgeware Formatting Reference

The complete HTML idiom for knowledgebase sites. The template at `templates/page-template.html` supplies the CSS/JS chrome; this file defines how to fill it.

## Template placeholders

| Placeholder | Content |
|---|---|
| `{{SITE_TITLE}}` | Site name, shown in brand, tab title suffix, breadcrumb root, mobile bar |
| `{{SITE_SUBTITLE}}` | One-line subtitle under the brand (audience · scope · date) |
| `{{NAV_LINKS}}` | The full nav block — identical on every page (see below) |
| `{{TITLE}}` / `{{DESC}}` | Page title / meta description |
| `{{CRUMB}}` | Breadcrumb group label (e.g., "Phase II · Architect") |
| `{{H1}}` / `{{CHIPS}}` | Page heading / chip row |
| `{{CONTENT}}` | The article body (see idioms) |
| `{{PAGENAV}}` | Prev/next links (see below) |
| `{{FOOTER}}` | Site footer: what this is, compile date, re-verification warning, non-affiliation note if relevant |

`{{NAV_LINKS}}` format — groups and links, repeated identically in the side nav and mobile bar:
```html
<div class="navgroup">GROUP LABEL</div>
<a class="pl" href="page.html">Page label</a>
```
On each page, that page's own link becomes `class="pl active"` — **in both nav copies**.

`{{PAGENAV}}` format (first page omits Previous; last page omits Next):
```html
<a href="prev.html"><span class="lbl">&larr; Previous</span>Prev Title</a><a href="next.html" style="text-align:right;margin-left:auto"><span class="lbl">Next &rarr;</span>Next Title</a>
```

## Content idioms

**Sections** — `<section>` blocks with `<h2>`/`<h3>`. The scrollspy TOC auto-builds from h2s; write h2s as scannable claims ("Choosing a vector store: minimum spend, not unit price"), not labels ("Vector stores").

**Tables** — every one wrapped:
```html
<div class="tscroll"><table>…</table></div>
```
Volatile tables (prices, quotas, GA status, availability, feature matrices) get a stamp immediately after the wrapper:
```html
<p class="tag">Last verified: YYYY-MM-DD</p>
```
Stable conceptual tables (pattern selectors, checklists) are not stamped.

**Callouts** — four flavors, used deliberately:
```html
<div class="callout tip"><span class="lab">Field tip</span> …practice wisdom…</div>
<div class="callout warn"><span class="lab">Trap</span> …the mistake smart people make…</div>
<div class="callout arch"><span class="lab">Architect's lens</span> …the reasoning frame…</div>
<div class="callout refs"><span class="lab">References</span><ul><li><a href="…">…</a></li></ul></div>
```

**Comparison cards** — for side-by-side prose comparisons:
```html
<div class="grid2"><div class="card"><h4>Option A</h4><p>…</p></div><div class="card">…</div></div>
```

**Scenario drills** — collected in a dedicated `<h2>Scenario drills</h2>` section just before the pagenav; each drill opens with a one-line link to the section it exercises:
```html
<div class="q"><div class="qh">Scenario drill</div>
<p><em>Exercises: <a href="#anchor">Section name</a>.</em> …realistic situation…</p>
<details><summary>How a strong architect answers</summary><p>…model answer…</p></details></div>
```

**Emphasis** — `<mark>` for the load-bearing phrase of a section (sparingly); `.pill ga/beta/dep` for status badges; `.kbd` for keystrokes.

**Escaping** — HTML-escape `&`, `<`, `>` in all text content. In XML-adjacent or code content shown as text, double-check ampersands.

## Diagrams

**Mermaid (default)** — the template's init is theme-aware and palette-matched; just write:
```html
<pre class="mermaid">
flowchart TD
  A["Short label"] --> B{"Decision?"}
  B -->|"yes"| C["Outcome"]
</pre>
```
Rules: ≤12 nodes; `TD` for decision trees, `LR` for pipelines; **no raw `<` `>` in labels** (breaks HTML parsing before Mermaid sees it — write "under 200K" or `&lt;`); `<br/>` allowed inside quoted labels for two-line nodes. Vendor `mermaid.min.js` into the site folder (`curl -sL -o mermaid.min.js https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js`).

**Poster diagrams (chartware)** — for the site's 2–4 flagship diagrams. Author via the `chartware` skill conventions (Quicksand font, semantic colors: blue decisions `#D4E1F5`/`#7EA6E0`, green viable-outcome terminals `#97D077`, red governance/constraint notes `#FF0000`, navy edges `#0B4D6A`; orthogonal edges; center-alignment invariant; `labelBackgroundColor=#FFFFFF` on branch labels so they lift off the lines). Render to PNG (if no draw.io MCP: embed the XML in a local page with `https://viewer.diagrams.net/js/viewer-static.min.js` served over localhost, screenshot the `div.mxgraph` element with Playwright at device scale). Embed:
```html
<p style="text-align:center"><img src="diagrams/name.png" alt="…" style="max-width:100%;height:auto;background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px"></p>
<p class="tag" style="text-align:center">Poster diagram &mdash; source: <code>diagrams/name.drawio.xml</code> (draw.io).</p>
```
Keep the `.drawio` XML in `diagrams/` beside the PNG so it stays editable.

**What stays as `<pre><code>`** — genuine code samples, worked arithmetic, configs, text templates. Only *diagrams* (flow arrows, boxes, trees drawn in text) get converted to Mermaid.

## Page anatomy (canonical order)

1. Opening frame: what this page decides, in 2–4 sentences; cross-link siblings.
2. The runbook / decision sequence (if the page is a process) — numbered, imperative, at the top.
3. Big-decision sections with tables + "choose on" rules + one Mermaid decision tree.
4. Detail sections (per-option depth, mechanics, worked examples with real arithmetic).
5. Operational/fine detail (failure modes, quotas, diagnosis tables).
6. Scenario drills section.
7. Refs callout (key sources) where the page leans on external facts.
