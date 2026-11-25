# Verbs

The timeline `s` is a chain: every verb returns `s`. Targets are CSS selectors inside the scene (all matches), an element, or a list. A wrong selector fails with the ids the scene does have.

**Defaults come from the language.** Every verb's `dur` and `ease` follow the kit's `--am-dur-*` and `--am-ease-*` tokens by role (enter, exit, move, effect); the values in the table below are fallbacks for a page without a kit. Name a role (`ease: "move"`) or leave the option out; don't retype the language's curves.

## Positions (when a verb starts)

GSAP's grammar. The last argument before the options object.

| Position | Starts |
|---|---|
| omitted | at the end of the timeline so far (after everything) |
| `2.5` | at 2.5 s |
| `"<"` | with the previous verb |
| `">"` | when the previous verb ends |
| `"<0.2"`, `">-0.1"` | 0.2 s after the previous verb starts; 0.1 s before it ends |
| `"+=1"`, `"-=0.5"` | 1 s after the end of the timeline; 0.5 s before it |
| `"fix"`, `"fix+=0.5"` | at a label; 0.5 s after it |

`"<"` is the previous verb's **start** (GSAP), not its end (anime.js v4 uses `"<"` for the end). A label must exist before it's used. `end` and `start` aren't labels you can define: `poster` and `expect` already take them for the scene's end and start.

## Verbs

| Verb | Does | Options (defaults) |
|---|---|---|
| `s.label(name, pos)` | names a moment: steps, posters, expects and positions refer to it | |
| `s.wait(sec)` | adds empty time at the end | |
| `s.enter(target, preset, pos, o)` | shows it: hidden before, arriving with the preset | `dur` .45, `ease` per preset (`out`), `stagger`, `distance` (px for up/down/left/right) |
| `s.exit(target, preset, pos, o)` | hides it, leaving with the preset | `dur` .3, `ease` `in`, `stagger` |
| `s.set(target, props, pos, o)` | changes at once: `{ state, text, class: "+on -off", attr: { k: v \| null }, style: { prop: v }, visible, opacity, x, y, scale, rotate, pose }` (later tweens continue from these). `visible: false` hides with `visibility`, so the element keeps its space; to take it out of the flow use `style: { display: "none" }` | `stagger` |
| `s.pose(target, pose, pos, o)` | swaps a sprite (an element with `data-am-sprite`) to another of its poses | `stagger` |
| `s.text(target, value, pos)` | replaces the text at once | |
| `s.type(target, text, pos, o)` | types it character by character, with a caret | `cps` 30 (or `dur`), `append` false, `caret` true |
| `s.count(target, { to, from, format, dur, ease }, pos, o)` | counts the number in its text | `dur` .8, `ease` `out`; format below |
| `s.tween(target, props, pos, o)` | animates `x`, `y` (px), `scale`, `scaleX`, `scaleY`, `rotate` (deg), `opacity`, or any CSS property with a number or colour (`width: "240px"`, `background: "var(--color-accent)"`, `--fill: 0.5`); property names in camelCase or kebab-case (`borderLeftColor` or `"border-left-color"`); any CSS colour interpolates, including `color-mix()` and `oklch()` | `dur` .5, `ease`: the language's `move` curve for x, y, scale and rotate, its `effect` curve for opacity and colours; `from: { … }`, `stagger` |
| `s.move(target, to, pos, o)` | moves it onto `to`: an anchor selector (centres on it), `{ x, y }` (px from its layout place), or `{ path: "#svg-path" }` (follows the path) | `dur` .6, `ease` `inOut`, `arc` (px of lift: a hop), `point` (the mover's point that lands: `"top-left"`, `"bottom"`, … or `{ x, y }` px from its top-left, such as a cursor's tip), `on` (the anchor's point it lands on, same forms), `align` `bottom` \| `top` \| `above` (shorthands), `offset: { x, y }`, `pass: { targets, set }` (as the mover reaches each target, `set` it: checks ticking as an agent passes stations), `stagger` |
| `s.clone(source, n, pos, o)` | makes n copies, appended to `into` (default: the source's parent), each flying out of the source into the place the CSS gives it. A copy is a deep copy of the source as authored (its markup and sprite, not its animated state); its id becomes `<id>-<i>` and every id inside it gets the same suffix; it starts at the source's centre at full size and fades in over 0.2 s. The source stays unless you `exit` it | `into`, `each` .06 (stagger), `from` `start` \| `center` \| `end` \| `random`, `dur` .45, `id`, `init: (el, i) => …` (per-copy setup before layout: its label, pose or colour) |
| `s.draw(target, pos, o)` | draws an SVG stroke on (sets `pathLength=1`) | `dur` .9 |
| `s.burst(target, pos, o)` | a seeded confetti burst from the target's centre; particles sit outside the layout and never count as overflow | `count` 24 (≤150), `colors`, `spread` 140, `size` 6, `dur` 1.1 |
| `s.expect(at, target, want)` | an assertion `check --render` verifies at a label, seconds, `"start"` or `"end"`: `want` = `{ text, state, visible, class }` | |
| `s.custom(target \| null, (el, p, t) => …, pos, o)` | runs on every frame with eased progress p and scene time t (null target: once per frame, for driving another engine) | `dur`, `ease` `linear` |
| `s.rand()` | a seeded random number in [0, 1): the same on every run | |

**Presets** for `enter` and `exit`: `fade`, `up`, `down`, `left`, `right` (move 14–18 px while fading, like slideware's `data-a`), `pop` (scale from .82 with overshoot), `grow-x`, `grow-y` (from zero width or height; set the origin in CSS if not left or bottom), `wipe` (left-to-right reveal), `draw` (SVG stroke), `append` (grows from zero height, so the items below slide down: list rows).

**Stagger**: `{ stagger: 0.1 }`, or `{ stagger: { each: 0.1, from: "center" } }` (`start`, `end`, `center`, `random`). Clones use `each` and `from`.

**Count formats**: omitted keeps the shape of the text already there (`"$18.00"` counts to `"-$54.00"`, `"1,250 users"` keeps the comma); `"{n} open"` or `"{n:1} GB"` (decimals); `{ style: "percent" }` or any `Intl.NumberFormat` options; or a function, for plurals: `(n) => (Math.round(n) === 1 ? "1 agent" : `${Math.round(n)} agents`)`.

**Eases**: `linear`, `in`, `out`, `inOut` (cubic), `standard`, `emphasized` (Material's), `pop` / `back` (overshoot), `spring` (one settle), `bounce`, `steps(n)`, `cubic-bezier(a, b, c, d)`. Roles: entrances `out`, exits `in`, moves `inOut` or `standard`, counters and typing `linear` or `out`, landings `spring` or `pop`.

## How values behave

- Every verb writes **channels**: x, y, scale, rotate, opacity, presence (hidden or not), text, each attribute and class, each style property. A channel holds its authored value until its first verb starts, and each verb's end value until the next one on that channel.
- Chains continue: `s.move("#a", "#b").move("#a", "#c")` goes b → c. A tween without `from` starts wherever the channel is.
- An element an `enter` targets is hidden until that verb starts. One an `exit` targets is shown until it ends.
- `set({ state })` writes `data-state`: style the states in the template's CSS (`li[data-state=fixed] { … }`), so the look stays in CSS and the timeline only says when.
- `move` and `clone` measure the layout as authored (with every element in place); keep the static layout final and let the timeline hide things.
- Clones get ids `<source-id>-1` … `-n` and the class `am-clone`; target them later (`"#agent-3"`, `".am-clone"`).

## Recipes (composed from verbs)

Inline the chain, or write a recipe as a local function inside the scene's script (`const hop = (who, to, pos) => s.move(who, to, pos, { arc: 40 })…;`). A recipe several scenes share can be registered once with `AM.verb(name, (s, ...args) => s…)` at the top of the first scene's timeline script, where `AM` is in scope. (A page `<script>` works only if it comes after the `am-runtime` script, which `inline` puts just before `</body>`.)

| Recipe | Chain |
|---|---|
| **Multiply** (one agent becomes nine) | `s.enter("#lead", "pop").clone("#lead", 9, ">", { into: "#grid", from: "center" })` with `#grid { display: grid; grid-template-columns: repeat(3, 48px); gap: 12px }` |
| **Status flip** | `s.set(".am-clone", { state: "done" }, ">", { stagger: { each: 0.12, from: "random" } })` with `[data-state=done]::after` drawing the check |
| **Hop** | `s.move("#bot", "#step3", ">", { arc: 40, align: "bottom", ease: "out" }).tween("#bot", { scaleY: 0.85 }, ">", { dur: 0.08 }).tween("#bot", { scaleY: 1 }, ">", { dur: 0.2, ease: "spring" })` |
| **Tour** (stations along a track) | per station: `s.move("#bot", "#st-3", ">", { align: "above" }).set("#st-3", { state: "visited" }, ">").enter("#bubble-3", "pop", "<").wait(0.6)` |
| **Run through** (one move, stations tick as it passes) | `s.move("#bot", "#st-last", ">", { dur: 2, align: "above", pass: { targets: ".st", set: { state: "ok" } } })` |
| **Cursor click** | `s.move("#cursor", "#add", ">", { dur: 0.5, ease: "standard", point: { x: 2, y: 2 } }).set("#add", { class: "+pressed" }, ">").set("#add", { class: "-pressed", text: "Added" }, "+=0.15")` |
| **Chat session** | `s.type("#prompt", "verify this app", ">").enter("#reply-1", "up", "+=0.3").type("#reply-1 .text", "Placing the order…", "<")` then, when the preview shows it, `.set("#reply-1 .text", { text: "Order placed", state: "ok" }, "placed")`: a pending line says what's happening, not the result |
| **Highlight** | `s.tween("#line-8", { background: "var(--am-highlight)" }, ">", { dur: 0.3 })` |
| **Camera** (zoom into a detail) | wrap the scene's content in `#world`; `s.tween("#world", { scale: 1.8, x: -320, y: -140 }, ">", { dur: 0.9, ease: "standard" })` (set `transform-origin: 0 0` on `#world`) |
| **Overlay** | `s.enter("#lock", "fade").wait(1).exit("#lock", "fade")` |
| **Pulse** (attention, ≤ 3 cycles) | `s.tween("#dot", { scale: 1.25 }, ">", { dur: 0.25 }).tween("#dot", { scale: 1 }, ">", { dur: 0.25 })` repeated at most three times |

## Primitives (for new verbs)

- `s.track(target, channel, to, pos, { from, dur, ease, stagger })`: a continuous value on a channel (`"x"`, `"opacity"`, `"style:width"`…).
- `s.cue(target, channel, value | (p, start) => value, pos, { dur, stagger })`: a discrete value, or a generator over progress.
- `s.custom(…)`: anything else, as a function of time.
