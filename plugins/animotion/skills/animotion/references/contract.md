# The scene contract

This file owns the contract of `<am-scene>`: its markup, attributes, lifecycle, behaviour in each viewing mode and its JavaScript API. The runtime is `runtime/animotion.js` in the plugin; `cli.js inline` copies it into a file.

## Markup

```html
<am-scene name="checkout" poster="fixed" loop="2" aria-label="One sentence: what the animation shows."
  style="position:absolute; left:64px; top:150px; width:1152px; height:500px">
  <template>
    <style>/* the scene's CSS; brand tokens and --am-* reach inside */</style>
    …the scene's markup, in its final state…
    <script type="text/animotion"> s.…; </script>
  </template>
  <am-cue data-step="1" to="qty"></am-cue>   <!-- optional: click steps in a slideware deck -->
</am-scene>
```

- The `<template>` is rendered into the element's **shadow root**, inside a `div.am-stage` that fills the element; absolutely positioned markup is placed relative to it. The page's CSS doesn't reach in; custom properties (`--color-*`, `--font-*`, `--am-*`) and inherited font settings do.
- The timeline is a `<script type="text/animotion">` inside the template: a function body with `s` (the timeline) and `AM` in scope. It is inert where it sits (it's in a template), so slideware's slide copies keep it. Alternatively `AM.scene("name", (s) => …)` anywhere after the runtime defines the timeline for `<am-scene name="name">`.
- A scene with no timeline and a `duration` attribute plays the template's CSS `@keyframes` on the scene clock (each with a finite iteration count). CSS animations in a scripted scene join the same clock.
- **Sprites** (pixel characters and props): definitions are JSON in `<script type="application/json" data-am-sprites>`, in the kit (shared) or a scene's template: `{ "agent": { "unit": 4, "palette": { "A": "currentColor", "K": "#1F1E1C" }, "poses": { "neutral": ["..AA..", …], "happy": […] } } }`, one string per row, one character per cell (`.` empty). An element `<i data-am-sprite="agent:neutral"></i>` is drawn as crisp SVG (`currentColor` follows the element's CSS `color`); `s.pose(el, "happy")` swaps poses; clones keep their sprite. `AM.sprite(rows, palette, { unit })` returns the same SVG as a string.
- **Building markup in the timeline**: the script runs once, before anything renders, with the scene's markup in place; `s.root` is the scene's shadow root, for generating repeated markup (`s.root.querySelector("#rows").innerHTML = …`) before the verbs that target it.
- The element needs a size: inline `style` with width and height (absolute position on a slide), or a class that sets them.

## Attributes

| Attribute | Values | Meaning |
|---|---|---|
| `aria-label` | text | **Required.** What the animation shows; screen readers announce the scene as a labelled group (its pause button stays reachable). |
| `name` | word | Identifies the scene to the CLI (`--scene`), `AM.get` and `AM.scene`. |
| `poster` | label, seconds, `end`, `start` | The frame every still view shows. Default `end`. **Required when the scene loops**: a loop's last frame is usually its least telling. |
| `loop` | count, `infinite` | Repeats. `infinite` only while a slideware deck is presenting; elsewhere 3. After the last loop it rests on the poster. |
| `hold` | seconds | Time on the last frame before a loop resets (default 1.5 when looping). |
| `reset` | `fade` (default), `cut` | How a loop returns to its start. |
| `trigger` | `enter` (default), `steps`, `manual` | `enter`: plays from the start each time it comes into view. `steps`: in a presenting slideware deck, each click plays to the next `<am-cue>`'s label, stepping back jumps back, and arriving on the slide mid-build (going back from the next slide) shows the cued state at once; outside presenting it behaves as `enter`. `manual`: only the JS API plays it. |
| `controls` | `none` | Hides the pause button. Don't, for loops over 5 s (WCAG 2.2.2). |
| `seed` | text | Seeds `s.rand()` and random staggers (default: the name). |
| `duration` | seconds | Length of a CSS-only scene; extends a scripted one. |
| `data-am-overflow` | | Lets the scene's content leave its box without a check warning (also allowed on one element inside). |

`<am-cue data-step="n" to="label">` children map the deck's click steps to labels. Steps share the slide's numbering with every other build, so a caption with `data-step="2"` appears with the scene's second beat. Before the first cue the scene holds at its start.

## When it plays

The runtime decides; authors don't.

| Context | Behaviour |
|---|---|
| Slideware deck, slide current, viewing or presenting | plays (from the start each time the slide becomes current) |
| Another slide is current | rests on the poster |
| Blackout (b), hidden browser tab | freezes where it is, resumes after |
| Presenter window, overview and thumbnails, editing, `?capture`, `?print`, printing | poster |
| Ordinary page | plays while at least 35% of it is on screen; poster before that |
| `prefers-reduced-motion: reduce` | poster only |
| `?am-still` in the URL, or `AM.still()` | poster only (used by the CLI) |

Each playing scene shows a small pause button on hover (and while paused). In a slideware deck, `m` pauses or plays the current slide's scenes; it appears in the deck's key list.

## Determinism

Every frame is `render(t)`: a pure function of the scene's time, the same whatever was shown before. So the timeline may not depend on anything else: no `Math.random` (use `s.rand()`), no `Date`, no timers or `requestAnimationFrame`, no network. CSS can't add a clock of its own either: transitions are turned off inside a scene, and a CSS animation must be on its element from the start (the runtime seeks it); one that a state or class switches on would run on the wall clock, and `check --render` reports it. The CLI checks the timeline's text for these and checks that seeking is repeatable.

## JavaScript API

Element: `play(from?)`, `playTo(label)`, `pause()`, `resume()`, `seek(label | seconds)`, `restart()`; read `duration`, `labels`, `time`, `state` (`idle` before its first frame, `poster`, `playing`, `paused`, `held`, `suspended`, `ended`), `error`, `posterTime`. Events (bubbling, composed): `am:label`, `am:loop`, `am:end`.

`AM`: `AM.scene(name, fn)`, `AM.verb(name, fn)`, `AM.get(name | element)`, `AM.list()`, `AM.inspect(x)` (duration, labels, poster, every verb's channel and timing), `AM.verify(x)` (runs the scene's `expect`s), `AM.still(on)`, `AM.pauseAll(on)`, `AM.ready()` (a promise: every scene mounted and compiled), `AM.version`.

## Exports and other tools

- **PNG, PDF, PowerPoint** (slideware's `export`): the poster, with no extra step. PowerPoint level 1 puts the slide's text in text boxes; a scene's text stays part of the picture.
- **Slideware's editor**: moves and resizes the whole element; it doesn't edit inside a scene. The runtime adds nothing to the element that the editor would save.
- **Lanes**: a lane's text replacements don't reach inside a scene's template; override the whole element in the lane if a scene's text differs.
