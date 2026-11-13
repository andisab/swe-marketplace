# Maintaining the source index

`sources.yaml` lists online sources that animotion consults or fetches from at authoring time. It holds pointers, access recipes and licence terms, never assets. Entries are re-checked by hand, by Andis or by Claude Code on request; nothing re-checks them on a schedule. Andis curates the entries: propose additions, don't add them unasked.

## How it was generated

- **2026-11-10:** a 10-agent survey of the slideware animation extension (libraries, media, prior art, codebase, primitives, verification). It set the context; it didn't produce index entries.
- **2026-11-11:** four research agents, one report each (in the research workspace, outside this repo):
  - `sources-icons`: which icon and SVG sets can Claude search or fetch, and on what licence terms can a few icons be embedded, restyled and animated in a single-file deck?
  - `sources-illustration`: which illustration, character, pixel-art and style-reference sources exist, how do their licences treat embedding, and what do published illustration guidelines specify?
  - `sources-motion`: which motion token systems, easing references, animation catalogues and explainer exemplars should Claude consult, and which assets may be embedded?
  - `derivation-pipeline` (§3): which tools and formats extract a visual language from a reference?
- The index was built from those four reports. `last_verified` is the date the report checked the entry. A trap that starts `unconfirmed:` is something the report couldn't confirm.

## Search patterns that found the sources

Reuse these with the current year. Every WebSearch query and WebFetch URL from the research is in `provenance/web-calls.tsv`, and every curl probe in `provenance/shell-urls.tsv`, in the maintainer's research workspace (not in this repo), beside the four reports.

- **Icon sets:** `new open source SVG icon library <year> MIT` · `<set> license attribution "comments in SVG files"` · `<site> public API search icons programmatically rate limit` · `<site> licensing per icon attribution commercial use` · `<set> animated icons open source motion license`.
- **Illustration and characters:** `free open source SVG illustration library <year> CC0 new` · `<idiom> style illustrations free open source hand-drawn SVG CC0` · `<library> license attribution free plan` (Icons8, Streamline, Storyset, Blush) · `<vendor> isometric assets CC0 pack SVG` · `<source> CC0 MCP server`.
- **Game and pixel assets:** `itch.io free game assets license default` · `OpenGameArt licenses CC0 OGA-BY attribution` · `pixel art rules outline anti-aliasing palette tutorial`.
- **Style boards:** `<site> API public access search <year>` · `<site> API deprecated new API keys` · `<site> MCP <year>`.
- **Illustration guidelines:** `<design system> illustration guidelines grid line weight` · `<design system> illustration empty state sizes` · `<design system> spot illustrations style`.
- **Motion tokens:** `<system> motion tokens <token-name> cubic-bezier duration` · `Material 3 Expressive MotionScheme spring damping stiffness` · `SwiftUI Animation snappy bouncy smooth duration bounce`.
- **Easing tools:** `<tool> linear() easing generator spring` · `CSS easing generator spring bounce linear()`.
- **Animation catalogues:** `<catalogue> license terms <year> attribution` · `<catalogue> developer API search GraphQL` · `<catalogue> API key documentation`.
- **Exemplars:** `<author> interview process <medium>` · `<studio> how we make our videos`.
- **Extraction tools:** `<tool> extract brand colors fonts logo` · `MCP server extract design tokens from website URL` · `Design Tokens Community Group format stable version`.
- **Law (style vs content):** `Copyright Office style not protected 37 CFR 202.1` · `trade dress inherently distinctive secondary meaning`.

## Where to verify each kind of fact

| Fact | Canonical source | Command that worked (2026-11-11) |
|---|---|---|
| Icon set licence | the set's info record on jsDelivr (doesn't touch the rate-limited API) | `curl -s 'https://cdn.jsdelivr.net/npm/@iconify-json/{prefix}/info.json' \| jq .license` |
| All Iconify set licences | catalogue file | `curl -s https://cdn.jsdelivr.net/npm/@iconify/collections/collections.json \| jq 'to_entries \| map({(.key): .value.license.spdx}) \| add'` |
| Upstream licence (the source of truth, since mirrors lag) | repo LICENSE file | `curl -s https://raw.githubusercontent.com/{owner}/{repo}/{branch}/LICENSE \| head -40` |
| GitHub's licence field | GitHub API | `gh api repos/{owner}/{repo}/license --jq .license.spdx_id` (`NOASSERTION` means a custom licence, as with Remix Icon: read the file) |
| npm package licence and version | npm registry | `npm view <pkg> license version` |
| Package file list | jsDelivr data API | `curl -s 'https://data.jsdelivr.com/v1/packages/npm/<pkg>@<version>?structure=flat'` |
| A URL pattern still resolves | the CDN | `curl -sI 'https://cdn.jsdelivr.net/npm/lucide-static@<version>/icons/bot.svg' \| head -1` |
| Iconify search works | API (one call only) | `curl -s 'https://api.iconify.design/search?query=robot&limit=32&prefixes=lucide'` |
| DiceBear styles and slots | API | `curl -s https://api.dicebear.com/10.x` · `curl -s https://api.dicebear.com/10.x/pixel-art/options.json` |
| Lospec palette format | site | `curl -s https://lospec.com/palette-list/pico-8.json` |
| LottieFiles search | GraphQL (undocumented) | `curl -s -X POST https://graphql.lottiefiles.com/2022-08 -H 'Content-Type: application/json' -d '{"query":"{ searchPublicAnimations(query:\"robot\", first:1){ edges{ node{ name jsonUrl } } } }"}'` |
| Component registries | shadcn registry JSON | `curl -s https://magicui.design/r/registry.json \| jq '.items \| length'` |
| Motion token values | published packages and source, not JS-rendered doc sites | `curl -s 'https://unpkg.com/@atlaskit/tokens/?meta'` · `curl -s https://unpkg.com/@primer/primitives/dist/css/base/motion/motion.css` · raw `.ts` on GitHub · googlesource `…/{File}.kt?format=TEXT \| base64 -d` |
| Apple HIG | the page's JSON | `curl -s https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json` |

- **Licence pages that block fetchers:** SVG Repo returned 429; Icons8, IconScout and OpenGameArt returned 403; Land-book blocked fetches. For these, use WebSearch snippets and keep the trap marked `unconfirmed:`.
- **JS-rendered docs** (m3.material.io, the Apple HIG pages, Material M2): read the source package or the JSON instead.
- **Never stress-test the Iconify API.** About 25 calls blocked it for an hour.

## Re-check procedure

**When to run it:**
- when asked ("re-check the animotion index", "is X still OK to embed?");
- before an animotion release;
- when a fetch fails, or a licence page looks different from the entry;
- when an entry is due: its `last_verified` plus its `cadence` (monthly 31 days, quarterly 92, yearly 366) is past.

List the due entries:

```bash
uv run --with pyyaml python3 -c '
import yaml, datetime as dt
days = {"monthly": 31, "quarterly": 92, "yearly": 366}
for s in yaml.safe_load(open("plugins/animotion/index/sources.yaml"))["sources"]:
    if s["last_verified"] + dt.timedelta(days[s["cadence"]]) < dt.date.today():
        print(s["cadence"], s["id"])'
```

**To verify one entry:**
1. **Licence.** Open `license.url` (upstream, never a mirror) and compare `spdx`/`name`, `embed`, `attribution`, `modify` and `conditions`. Look for a changelog or an effective date.
2. **Access.** Run the recipe once with a harmless query. Check the status code and the shape of the response. For CDN recipes, resolve the version with `npm view`, then `curl -sI` one file.
3. **Rate limit.** Re-read the docs. Record observed limits as observations, with `unconfirmed:` if they aren't documented.
4. **Counts and versions.** Update `extract` only when a number changed materially.
5. **Unconfirmed traps.** Try to confirm each one. If confirmed, drop the `unconfirmed:` prefix (or the trap, if it's no longer a hazard). If not, leave it.
6. Set `last_verified` to today. Tighten `cadence` to `monthly` if anything changed.

**What changes an entry:**
- **The licence changed.** Update `license`, and add a trap that records old → new with the date, plus whether mirrors (Iconify, npm metadata) still show the old value. If the new licence fails the criteria below, demote the entry: `fetch-embed` → `study-only`, `embed: "no"`, `auto_select: false`.
- **Access changed** (new URL pattern, auth, a vanished endpoint, a version bump such as DiceBear `10.x`). Update `access` and `urls`.
- **Add a trap** for: a licence change in the past year; a mirror that disagrees with upstream; an undocumented endpoint; attribution that tooling strips (SVGO, Iconify); caps and quotas; clauses against automated access, AI processing, compiling or templates; and anything unconfirmed.

**To add a source (Andis approves):**
- **`fetch-embed` needs all three:**
  1. The licence allows embedding in a commercial client deck with at most a credit: MIT, ISC, Apache-2.0, CC0, CC BY, or a vendor licence that says so. No NC, no GPL, no clause against automated access or AI processing. ShareAlike only with `auto_select: false`.
  2. Stable access: a documented API, an npm or GitHub CDN path, or direct file URLs that `curl` can verify.
  3. It fits at least one idiom at 2 or more.
- **`consult`** needs public rules or numbers worth reading.
- **Anything else useful** goes in as `study-only`, with the reason stated as a trap, so Claude doesn't rediscover it as a candidate.
- **Steps:** copy a similar entry, fill every field, verify it as above, then run the validation below.

**To retire a source:** prefer demoting to `study-only` with a trap that says why, so the knowledge stays. Delete an entry only when the source is gone. Either way, say so in the commit message.

**Validate after every edit.** `node plugins/animotion/tests/sources-test.js` (run by `validate-all.sh` and CI) checks that every entry reads with the CLI's parser, ids are unique and the enums hold; `node plugins/animotion/scripts/cli.js sources <id>` shows an entry as Claude sees it. A full YAML parse:

```bash
uv run --with pyyaml python3 -c '
import yaml, collections
s = yaml.safe_load(open("plugins/animotion/index/sources.yaml"))["sources"]
dup = [k for k, v in collections.Counter(e["id"] for e in s).items() if v > 1]
print(len(s), "entries; duplicate ids:", dup or "none")'
```

YAML gotchas:
- Quote `"yes"` and `"no"`; bare, they parse as booleans.
- Quote URLs and comma-bearing text inside `{ }` and `[ ]`. Older libyaml (macOS Ruby) rejects an unquoted `https:` there, and a bare comma splits the value.

## Volatile facts: re-check these first

| Fact | Entry |
|---|---|
| Licence changed in January 2026; Iconify still reports Apache-2.0 | `remix-icon` |
| Free licence non-commercial since 2026-10-15 | `absurd-design` |
| Clauses against automated access and AI processing | `undraw`, `manypixels` |
| Undocumented, unauthenticated GraphQL endpoint; the "collect or compile" clause | `lottiefiles` |
| Public API rate limit (about 25 calls, then a one-hour block) | `iconify` |
| 50 icons and 25 illustrations per project; which terms bind via Iconify | `streamline-icons`, `streamline-illustrations` |
| Paid tiers since 2025-11-24; icon count | `hackernoon-pixel` |
| Removed brands; per-icon licences | `simple-icons` |
| API version `10.x`; per-style licences | `dicebear*` |
| Compose spring values on androidx-main; Atlassian tokens behind a feature flag; Spectrum 2 motion | `material3-motion`, `atlassian-motion`, `spectrum-motion` |
| Unconfirmed, to promote once verified | `kitbitz`, `isometric-online`, `icons8-ouch`, `storyset`, `illlustrations-co` |
| Beta API auth; paid MCP plans; the 24-hour cache rule | `lordicon`, `mobbin`, `savee` |
