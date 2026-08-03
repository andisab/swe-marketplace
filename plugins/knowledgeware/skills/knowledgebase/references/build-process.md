# Knowledgebase Skill — Build Process

The parallel-build playbook for sites larger than ~4 pages, plus the verification suite every build must pass. Field-tested on a 20-page build (July 2026).

## Phase A — Foundation (main session, before any agents)

1. **Page map + nav**: fix the full page list, groups, and reading order. The nav is defined ONCE and baked into the working template; every page carries identical nav markup.
2. **Working template**: copy `templates/page-template.html`, fill `{{SITE_TITLE}}`, `{{SITE_SUBTITLE}}`, `{{NAV_LINKS}}`, `{{FOOTER}}` — leave the per-page placeholders (`{{TITLE}} {{DESC}} {{CRUMB}} {{H1}} {{CHIPS}} {{CONTENT}} {{PAGENAV}}`) for writers. Park it at a stable path all agents can read.
3. **Vendor Mermaid** into the site folder: `curl -sL -o mermaid.min.js https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js`
4. **Prev/next chain**: write out the full ordered chain so each writer brief carries its exact PAGENAV values.

## Phase B — Research fan-out (parallel background agents)

One agent per research domain. Each brief requires:
- WebSearch/WebFetch against **primary sources**; secondary sources labeled.
- Output to `research/<topic>.md` with source URLs, `Last verified: YYYY-MM-DD`, and an explicit **unverified/could-not-confirm section** (never guessed figures).
- A short executive summary as the final report; the depth goes in the file.

Watch for: WebSearch budgets exhausting mid-run (agents should fall back to direct WebFetch of known URLs); agents going idle without reporting (the file on disk is the ground truth — check it before re-prompting); pages that render data client-side (mark unverified, note the console/CLI that would resolve it).

## Phase C — Writer fan-out (parallel background agents)

One agent per 1–3 pages. Every writer brief must contain, verbatim:

1. **Template mechanics**: read the working template; replace all placeholders; set `class="pl active"` on the page's own nav link **in both the side nav and mobile bar**; zero `{{ }}` may remain (verify with `grep -c '{{'`).
2. **Format rules**: every `<table>` wrapped in `<div class="tscroll">`; Mermaid via `<pre class="mermaid">` (≤12 nodes, no raw `<` `>` in labels); volatile tables stamped `<p class="tag">Last verified: YYYY-MM-DD</p>`; scenario drills in a dedicated end section with links to the sections they exercise; HTML-escape text.
3. **Exact PAGENAV** prev/next values.
4. **Source files to read** (research/*.md and any sibling page to mirror structurally).
5. **Tone directive**: engineering, concise, decision-first, big→medium→small.
6. **Self-verification + final report**: line count, placeholder grep result, section list.

### Chunked-write rule (learned the hard way)
A single giant Write of a 100KB+ page can die on a dropped connection with **nothing on disk**. For any page expected over ~60KB, instruct the writer to build incrementally: first Write = template shell with an `<!-- APPEND-POINT -->` marker before the pagenav; then 3–5 Edits each replacing the marker with (one or two sections + the marker again); final Edit removes the marker. Each operation stays under ~15KB so partial progress survives. Verify `grep -c 'APPEND-POINT' == 0` at the end.

### Recovering failed agents
Idle-with-no-report → check the output file on disk first; it's often complete. Failed mid-response → resume the same agent by name once (context intact); if it fails twice the same way, spawn a fresh agent with the chunked-write strategy instead.

## Phase D — Sweeps (main session or one cleanup agent)

- Consistency pass on pages written before conventions settled (stamps, drill sections, diagram conversion — triage `<pre><code>` blocks: only actual diagrams convert to Mermaid; code/arithmetic stays).
- Pagenav chain repair after any page additions/splits.
- Index page map update (it lists every page — new pages need rows).

## Verification suite (must pass before "done")

Run from the site directory:

```bash
# count + placeholders + endings + self-active nav
ls *.html | wc -l
for f in *.html; do
  ph=$(grep -c '{{' $f); e=$(tail -1 $f | grep -c '</html>')
  act=$(grep -o 'class="pl active" href="[^"]*"' $f | head -1 | sed 's/.*href="//;s/"//')
  [ "$ph" != "0" ] || [ "$e" != "1" ] && echo "$f BAD ph=$ph end=$e"
  [ "$act" != "$f" ] && echo "$f ACTIVE-MISMATCH:$act"
done
# broken internal links
for g in *.html; do grep -o 'href="[a-z-]*\.html"' "$g" | sed 's/href="//;s/"//' | sort -u \
  | while read t; do [ -f "$t" ] || echo "$g -> $t MISSING"; done; done | sort -u
# raw < inside mermaid blocks (breaks parsing)
python3 -c "
import re,glob
for f in sorted(glob.glob('*.html')):
    for m in re.findall(r'<pre class=\"mermaid\">(.*?)</pre>', open(f).read(), re.S):
        if '<' in m.replace('<br/>','').replace('<br>',''): print(f,'RAW-ANGLE')"
# pagenav chain (eyeball: complete loop, no orphans)
for f in *.html; do echo "$f => $(grep -o 'class=\"pagenav\">.*' $f | grep -o 'href=\"[a-z-]*\.html\"' | tr '\n' ' ')"; done
```

## Maintenance page (required for any site with volatile facts)

Sections: the volatility problem (brief) · the Last-verified convention (>90 days = stale, re-verify before external use) · **master volatility table** (data class | where it appears | authoritative source URL/console **as a clickable `<a>` link** | change frequency | check cadence | method) · known upcoming changes with dates · change-detection strategies (RSS/release-note subscriptions; a monthly verification-sweep prompt for a Claude session; pre-deliverable checklist scoped to what the deliverable touches) · the update runbook (update research/ first, then page tables, bump stamps, log in changelog) · changelog table. Every source cited anywhere on this page is a live link — the re-verification runbook should be executable by clicking down the volatility table.

## Rendering chartware posters without a draw.io MCP

Follow the canonical headless-render workflow in the chartware skill: `skills/chartware/references/drawio-layout.md` §Rendering without the draw.io MCP. Ship the resulting PNG + `.drawio.xml` source into this site's `diagrams/` folder.
