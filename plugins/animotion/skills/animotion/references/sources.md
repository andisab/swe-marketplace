# Outside sources

`$AM/index/sources.yaml` is a curated index of online sources: icon sets, illustration and character libraries, palettes, motion systems, animation catalogues, exemplars to study, style-reference sites and extraction tools. It holds facts and links, never the assets. Nothing is mirrored: Claude fetches what a scene needs when it builds it, embeds it in the file (which must work offline), and credits it.

## Reading the index

It is long (about 145 entries); don't read it whole. Filter it:

```bash
node $AM/scripts/cli.js sources --idiom line --use fetch-embed     # what fits the spec's idiom (score ≥ 2), as a table
node $AM/scripts/cli.js sources --kind motion-tokens               # by kind: icon-set, illustration, character, palette, …
node $AM/scripts/cli.js sources lucide                             # one entry in full: access recipe, licence, traps
```

Each entry's `use` says what Claude may do:

| Use | May |
|---|---|
| `fetch-embed` | fetch items at build time and embed them in the file, honouring `license.attribution` and `license.conditions` |
| `consult` | read for rules or numbers (motion tokens, illustration guidelines); nothing is copied into the file |
| `study-only` | look at for ideas or as a derivation reference; never copy assets from it |

`idioms` scores each source 0–3 per drawing idiom (`pixel`, `flat`, `line`, `hand`, `iso`, `wire`; `any` for motion references and tools); pick sources that score 2–3 for the spec's idiom (entries marked `auto_select: false` are listed only with `--all`: use them only when the user names them), and list the ones a language uses in its `sources:` field. `access.recipe` says how to fetch (a URL pattern or API call) and `access.rate_limit` how gently; `traps` lists what has caught people before.

## Using a fetched asset

1. **Check the entry's licence fields** before fetching. `embed: no` means don't. `attribution: visible` means the credit must be visible on the page or deck (a credits slide or footer); `notice` means an HTML comment is enough; `per-item-author` means the credit names each item's author.
2. **Fetch only what the scene uses**, from the entry's `access` (for icons, the set's own source files keep separable parts; Iconify's API merges them into one path and is rate-limited: search there, fetch in batches).
3. **Restyle to the spec**: stroke width from `strokes`, `currentColor` for colour, coordinates snapped to `unit`, radius from `radius`. Every `fetch-embed` licence in the index allows modification unless its `conditions` say otherwise (CC BY-SA keeps ShareAlike; some forbid derivatives).
4. **Embed** inline (SVG in the template or the kit; raster as a `data:` URI).
5. **Credit**: add the entry's `license.attribution` template to the file's credits: an HTML comment `<!-- animotion credits: … -->` near the runtime for `notice`, plus a visible line (a credits slide in a deck) for `visible` and `per-item-author`. Record it under §Credits in `language.md` too.

## Maintaining the index

Licences change (two sources in the index changed theirs in the year before it was built). The index is re-checked by hand through Claude Code when asked; [`$AM/index/MAINTAINING.md`](../../../index/MAINTAINING.md) is the procedure: how it was built, the searches and verification URLs, how to re-check, add and retire an entry. Andis approves new entries.
