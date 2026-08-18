# Knowledgebase Skill — Maintenance Spec

The contract between a site's **builder** (this skill) and its **maintainer** (a human on a sweep, or the `kb-maintainer` agent on a schedule). A site that follows this spec can be maintained by pointing the agent at its folder with zero extra briefing: the maintenance page IS the work order. Field-tested across two production field guides (July–August 2026).

## 1. Freshness model

**Per-table stamps.** Every volatile table carries `<p class="tag">Last verified: YYYY-MM-DD</p>` immediately after its `tscroll` wrapper. A stamp means: *these facts were checked against the authoritative source on that date.* It does not mean the page was edited, and it is never bumped as a side effect of touching the page — a date you did not earn destroys the only freshness signal the reader has. Stamps >90 days old are stale; re-verify before any external use.

**Cadence enum.** Every tracked data class gets exactly one cadence value:

| Cadence | For | Examples |
|---|---|---|
| `weekly` | Facts that gate a recommendation; a week's delay matters | Security advisories, version floors, breaking deprecations |
| `monthly` | Published volatile facts | Prices, quotas, model IDs, GA/beta statuses, feature availability, console paths |
| `quarterly` | Slow-moving judgment material | Decision frameworks, architecture patterns, comparison verdicts |
| `on-event` | Checked only when a trigger fires | Facts covered by a subscribed feed; things a customer contradicts |

**Due computation.** A row is *due* when `(today − last check) ≥ cadence`. Last check = the date of the most recent changelog row whose scope covers the data class, falling back to the freshest stamp on a table where the class appears. This is what makes scheduled maintenance non-wasteful: a weekly job touches only due rows, and a quarterly row gets looked at four times a year, not fifty-two.

## 2. Maintenance page — required sections, canonical ids

Every site with volatile facts ships a `maintenance.html` using these section ids **verbatim** — maintainers (human and agent) navigate by id, not by heading prose:

| id | Section | Contents |
|---|---|---|
| `stamp-convention` | The stamp convention | What a stamp means / does not mean; the 90-day staleness threshold |
| `master` | Master volatility table | The work order — see column contract below |
| `upcoming` | Known upcoming changes | Announced changes with dates attached; source link each |
| `open-conflicts` | Open conflicts & unverified items | Source disagreements awaiting arbitration; `(unverified)` items with what would resolve them |
| `outstanding-questions` | Outstanding questions & dated TODOs | Questions asked-but-unanswered; drift observations; where each answer lands when it arrives |
| `detection` | Change detection | Feeds worth subscribing to; what changes silently and can only be swept |
| `runbook` | The update runbook | The §3 ordering, written for this site's specifics |
| `changelog` | Changelog | One row per sweep — see discipline below |

Optional: `census` (stamp counts per page), `protocol` (site-specific overrides to the automated-maintainer rules in §5).

**Master volatility table — column contract.** Exactly these columns, in order:

`Data class | Where it appears | Authoritative source | Change frequency | Cadence | Method`

- **Data class** — one named fact-family per row ("Claude Code version floor", "Bedrock model IDs"), not one row per page.
- **Where it appears** — the *complete* fan-out: every page repeating the fact, as internal links. A partial list leaves the site asserting two incompatible things after an update.
- **Authoritative source** — a clickable `<a>` to the exact page/console a maintainer opens to re-verify. A bare domain is a broken work order.
- **Change frequency** — observed reality, prose ("~monthly, unannounced").
- **Cadence** — one enum value from §1.
- **Method** — concrete check steps: what to open, what to compare, what counts as a delta. Written so an agent can execute it without further context.

## 3. The update runbook (canonical ordering)

A delta arrives — from a sweep, an advisory, or a customer contradicting the guide in a meeting. It travels in this order, because pages are compiled from research files and editing a page first produces a page that disagrees with its own source:

1. **Update the research file first.** New value, source URL, verification date land in `research/` (or `_research/`) in the file that owns the domain. Superseded values get a supersession note, not deletion — a removed fact leaves no trace of why it changed, and the same question gets researched again in six months.
2. **Write a reconciliation ruling if there is a conflict** — needed exactly when: two sources now disagree; the delta contradicts an existing ruling; or the delta refutes a claim other material still asserts. Rulings are numbered append-only; never renumber existing ones.
3. **Edit the pages — all of them — from the master table's fan-out column.** Work the full "Where it appears" list. This is where discipline pays: a version floor can live on sixteen pages, and a partial pass is worse than no pass.
4. **Bump stamps only on tables you actually verified** — including tables you checked and confirmed *unchanged*. Tables you did not check keep their date, even on a page you edited.
5. **Add one changelog row per sweep** (not per page): `Date | Pages touched | What changed | By whom`. **No-change sweeps get a row too** ("swept N monthly rows, no deltas") — the changelog's value is negative information: it distinguishes a page that hasn't changed because nothing changed from a page nobody has looked at. Automated sweeps identify themselves: agent name + model. New rows at the top.

If a changed fact's data class is missing from the master table, add a row — a fact volatile enough to have changed once is volatile enough to track.

## 4. Research folder contract

- Each `research/*.md` file: source URLs on every load-bearing fact, `Last verified: YYYY-MM-DD` dates, and an explicit unverified-items section. Never guessed figures.
- Conflicts between sources are arbitrated in a reconciliation file (rulings win over research files by construction); official docs beat everything else.
- Sites missing a research folder are maintainable but degraded: deltas then land directly in page tables with the source cited inline, and the maintainer notes the gap in `outstanding-questions`.

## 5. Automated maintainer protocol

What a scheduled agent (see the plugin's `kb-maintainer` agent) may and may not do. A site's `protocol` section may tighten these; it may not loosen the forbidden list.

**Allowed:** verify due rows and apply confirmed deltas through the §3 ordering · bump earned stamps · write the changelog row · add rows to `upcoming`, `open-conflicts`, `outstanding-questions` · append dated drift observations to `outstanding-questions`.

**Forbidden:** restructuring nav, page order, or section order · rewriting prose for style or voice · deleting content (supersede and annotate instead) · bumping a stamp without checking the table · inventing or extrapolating figures · converting an `(unverified)` marker to a claim without a primary source · touching rows that are not due.

**Drift is reported, not repaired.** The structure and prose were drafted deliberately over many iterations; an agent that notices a section drifting stale (deprecated tech framed as current, a missing topic the sources now emphasize, a page whose stamps keep failing verification) records a dated suggestion in `outstanding-questions` and surfaces it in its run report. The human decides whether to rebuild.

## 6. Build-time checklist (emit a maintainable site)

Before declaring a site done, verify alongside the build-process suite:

- [ ] `maintenance.html` exists with all eight canonical ids from §2
- [ ] Master table uses the exact §2 columns; every Cadence cell is one §1 enum value
- [ ] Every "Where it appears" fan-out is complete (grep the fact across `*.html` to confirm)
- [ ] Every authoritative source on the page is a clickable link — the runbook is executable by clicking down the table
- [ ] Every volatile table site-wide has a stamp; stable conceptual tables have none
- [ ] Changelog is seeded with the build row (date, "initial build", scope)
- [ ] `research/` files carry URLs, dates, and unverified sections per §4
