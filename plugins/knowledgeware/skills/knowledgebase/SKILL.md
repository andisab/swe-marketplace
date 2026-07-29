---
name: knowledgebase
description: Generate professional multi-page HTML knowledge bases and study guides for software engineering, data science, and AI/ML work — field guides, solution handbooks, service catalogs, team runbooks, onboarding documentation, and technical study resources. Produces self-contained, offline-capable HTML sites with sidebar navigation, scrollspy TOC, light/dark theming, Mermaid diagrams, scenario drills, and verification stamps, written in a rigorous senior-engineer voice. Activate ONLY when the user explicitly invokes this skill by name ("/knowledgebase", "use the knowledgebase skill to...") or by its former names "study-guide" / "knowledgeware", or unambiguously asks to BUILD one of this skill's deliverables — a field guide, handbook, runbook site, or multi-page HTML study guide / reference site. Do NOT activate merely because the word "knowledgebase" or "knowledge base" appears in conversation — e.g., mentions of the Joplin knowledge base, Memory MCP, or querying/updating some existing knowledge base are NOT triggers.
---

# Knowledgebase: Technical Knowledge-Base Generator

Generate a **professional-grade, multi-page HTML knowledge base** — the kind a senior architect keeps open in a browser tab and trusts in front of a customer. Not ordinary notes: a working reference with decision frameworks, verified numbers, honest uncertainty, and a maintenance story.

## Operating persona and tone

Write as a **seasoned senior solutions architect / staff engineer** producing a reference for peers:

- **Engineering methodology over business prose.** Runbooks, decision trees, tables, and structured lists BEAT long-form copy. Context-setting is fine but brief.
- **Clear, substantive, factual.** No filler, no cheerleading, no "in today's fast-paced world."
- **Decision-first ordering.** Every page runs **big decisions → medium decisions → fine detail**. The top of a page is what a practitioner needs in the room; nuance lives below.
- **Runbook-first openings.** Where a page describes a process, open with a prioritized step sequence (numbered, imperative), then elaborate per step. Start with constraints (regulatory/compliance envelope first) when the domain involves platform or architecture selection.
- Every concept answers: *what it is / why it exists / when to use / when NOT to use / trade-offs / common mistakes / production behavior*.
- **Honest uncertainty wins.** Anything not confirmed against a primary source is marked `(unverified)`. An honest gap plus a verification plan beats a confident wrong number. Never invent figures.

## Process pipeline

Follow the phases in order. For a small resource (1–4 pages) run them solo; for larger sites, fan out subagents per the parallel-build playbook in `references/build-process.md`.

### 1. Scope and page map
Agree (or infer) the site's purpose, audience, and page list before writing anything. Organize navigation by **the reader's workflow** (phases of a process, decision order), not by source material. Define the full nav ONCE — every page carries identical nav markup. Plan a `quick-reference` page (numbers, traps, checklists) and a `maintenance` page (see §5) for any site with volatile facts.

### 2. Research first, write second
- Prioritize **official documentation** above everything; then reputable engineering sources. When sources disagree, say so and treat official docs as truth.
- Research findings land in a `research/` folder as markdown, each file with source URLs, a `Last verified: YYYY-MM-DD` date, and an explicit **unverified-items section**. Pages are built FROM research files, never from memory alone.
- For multi-topic sites, run parallel research agents (one per domain) before any page writing. Give each a bounded brief and require the unverified-items section.

### 3. Build pages from the template
Use `templates/page-template.html` (this skill's directory). It provides: Anthropic-palette CSS with dark mode, adaptive width (`clamp(900px, 86vw, 1400px)`), sticky sidebar nav + mobile nav, scrollspy on-page TOC, horizontally scrollable table wrappers, and Mermaid wiring. Full mechanics, placeholder semantics, HTML idiom catalog (callouts, cards, scenario drills, stamps), and diagram rules: **read `references/formatting.md` before writing the first page.**

### 4. Verify before declaring done
Run the verification suite in `references/build-process.md` §Verification: zero leftover placeholders, every page's nav highlights itself, zero broken internal links, files end with `</html>`, no raw `<` inside Mermaid blocks, prev/next chain is a complete loop. A page is not done until it passes.

### 5. Design for decay
Volatile facts (prices, quotas, GA statuses, availability) rot. Every volatile table carries a `Last verified` stamp; the site gets a **maintenance page** with a master volatility table (what / where it appears / authoritative source / change frequency / check cadence), known upcoming changes, a changelog, and a re-verification runbook. Treat >90-day-old stamps as stale.

## Brand override (brandware)

When the user names a brand or style for the site ("in the Provectus brand", "AAB style"), resolve it from the plugin's registry: `styles/brands/<name>.md` (plugin root — two directories above this skill; canonical) with derived tokens in `styles/brands/tokens/<name>.json`, falling through to the generic defaults at `styles/<name>.md`. Map palette and typography onto the template's `:root` CSS variables and the Mermaid `themeVariables` init per the **brandware skill's `references/consumer-mappings.md` §knowledgebase** — the template is fully variable-driven, so retheming touches only those two blocks. Chartware posters in a branded site follow the same brandbook (§chartware mapping — understated: neutral ink carries structure, accents annotate), and any data charts follow brandware's `references/chart-styling.md`. If the brand isn't installed, use the default palette and say so — brands are never a hard dependency. When the user names no brand at all, check `styles/brands/DEFAULT` (a one-line file naming a registry entry) and apply that identity if it resolves, telling the user; otherwise keep the template's default palette.

## Diagram policy (hybrid)

- **Default: Mermaid**, rendered by a locally vendored `mermaid.min.js` (copy it into the site folder; the template wires a theme-aware init matched to the palette). Diagrams stay text-editable forever — right for a living document.
- **Posters: chartware (draw.io)** for the 2–4 highest-value diagrams where visual communication is the point (the site's master flow, key decision gates). Export PNG into `diagrams/`, keep the `.drawio` XML source beside it, embed with a caption noting the source file. Use the `chartware` skill for authoring.
- Mermaid rules: `<pre class="mermaid">` blocks; ≤12 nodes per diagram; **never raw `<` or `>` inside labels** (write "under 200K" or use `&lt;`); `flowchart TD` for decisions, `LR` for pipelines.
- Genuine code samples, worked arithmetic, and config blocks stay as `<pre><code>` — only *diagrams* get converted.

## Content quality bar (per page)

- Dense `<section>` blocks with h2/h3; many comparison tables (each wrapped in `<div class="tscroll">`); one or two Mermaid diagrams; callouts (`tip` = field tip, `warn` = trap, `arch` = architect's lens, `refs` = sources).
- **Scenario drills**: 1–2 realistic practitioner situations per page in a dedicated end section, each linked to the section/workflow it exercises, with a `<details>` expandable model answer.
- Cross-link pages like chapters of a book; link official docs inline on load-bearing facts.
- 30–80KB per page is the typical depth band. Condense aggressively from research rather than padding.
- Decision tables carry a "choose on" rule — if a recommendation doesn't trace to a stated constraint or measured number, it's a preference; label it as one.

## Anti-patterns (reject these in your own output)

Solution-first prose with no decision framework · long paragraphs where a table would do · unstamped volatile numbers · invented or "typical" figures · diagrams as ASCII art · pages organized by source material instead of reader workflow · marketing tone ("powerful", "seamless") · claiming completeness ("exhaustive") instead of scoping honestly ("80/20, deliberately not exhaustive").
