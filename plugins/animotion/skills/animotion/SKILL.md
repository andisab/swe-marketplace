---
name: animotion
description: Add animated scenes to HTML assets — slideware decks, knowledgebase pages, standalone HTML — as isolated <am-scene> elements that play a scripted timeline (things entering, moving, multiplying, typing, counting, changing state) on one seekable clock, in a visual language derived from a brand or a reference. Activate ONLY when the user explicitly asks for animation in an HTML asset ("create an animated slide", "animate this scene/diagram/slide", "add an animated scene", "animotion"), or asks to change, check or capture an existing <am-scene>. Do NOT activate for a slide's ordinary entrance motion or click builds (slideware's data-a and data-step cover those), for PowerPoint, for video generation, or for CSS or JavaScript animation in an app's own codebase.
---

# animotion

Animated scenes for single-file HTML. A scene is one isolated element, `<am-scene>`, holding its markup and its timeline. The runtime renders the markup into the element's shadow root and evaluates the timeline as a pure function of time, so any moment can be shown exactly: the scene plays while it can be seen and otherwise rests on its **poster** frame, which is what print, PDF, PNG and PowerPoint exports, thumbnails and reduced-motion viewers get.

Path convention: `$AM` is this plugin's root, two directories above this skill (`../../`). Commands: `node $AM/scripts/cli.js <command>` (Node 22+; `check --render`, `frames` and `list` also need Chrome, Edge, Brave or Chromium).

## When a scene is the right tool

A scene earns its place when **motion carries the explanation**: a process unfolding, things multiplying, state changing over time, a before and after, a cause and its effect. Apply the test: with motion off, would the explanation feel broken? If not, use slideware's `data-a` (a short entrance) or `data-step` (click builds) instead, and say so. One scene per slide; most decks need two or three, not one per slide.

## Workflow

1. **Settle the visual language** before drawing anything ([references/visual-language.md](references/visual-language.md)). Look for an existing spec first: `animotion/language.md` beside the deck or page, then the brand's (`<brand>/animotion/language.md` in knowledgeware's brand registry, when installed). Without one, derive it: from the brand's tokens alone (the floor), from a named drawing idiom the user picks, or from a reference they point at (a site, screenshot, recording, PDF). For a new language, show a **specimen** (one scene of the kit's parts) and get a yes before building scenes on it. Write the result to `animotion/language.md` and its kit to `animotion/kit.html` (shared CSS, SVG symbols, sprite definitions). A scene that needs a different glyph, colour or part changes the kit and `language.md`, not its own CSS. **Never paste the kit into a scene**: `inline` copies it into the page once and the runtime stamps it into every scene, so scenes use its classes (`.am-badge`), tokens (`var(--am-tint-60)`) and sprites (`<i data-am-sprite="agent:neutral"></i>`) directly.
2. **Write the beats** as plain sentences, one per moment ("the bot types a 10,000-character name; the field turns red; a finding appears"). Each beat becomes a label. Keep a scene under 20 s; a beat is a short motion followed by a hold long enough to read it.
3. **Build the static layout first**: the scene's markup in its `<template>`, in the language's kit, showing the *final* state. Everything a later beat reveals is in the markup from the start; the timeline only hides, moves and changes it.
4. **Write the timeline** with verbs ([references/verbs.md](references/verbs.md)): targets by selector, positions relative to the previous verb or a label, never raw coordinates for things that should land on something (move to an anchor element instead).
5. **Inline the runtime and the kit**: `node $AM/scripts/cli.js inline <file.html>` adds or refreshes `<script id="am-runtime">` and, from `animotion/kit.html` beside the file, `<template id="am-kit">` before `</body>`. Run it again after editing the kit or updating the plugin; it removes both when no scene is left.
6. **Check**: `node $AM/scripts/cli.js check <file.html> --render`. Fix every error (a blank poster, a timeline that isn't repeatable, an animation outside the scene's clock, `expect()` failures); read every warning (an element leaving the scene's box, small text, transitions, flashing).
7. **Look**: `node $AM/scripts/cli.js frames <file.html> --scene <name>` writes a contact sheet to `animotion/frames/<page>-<scene>.png` beside the file (leave it there, not in /tmp, so the user can see what you saw): start, each label and end by default; `--at every=1` for a steady sample, `--at qty,fix+0.5,end` for chosen moments; at most 12 frames (`--max`). **Read the sheet before calling the scene done**: does each frame read on its own, is anything clipped, overlapping or off-language, does the poster tell the story? Fix one beat at a time and re-run.
8. **Hand over**: say what each scene shows, how it plays (on entry, on click steps, looping), its poster, and that P / blackout / the scene's pause button (or `m` in a slideware deck) stop it.

In a slideware deck, place the scene inside a slide's `<section>` like any element (absolute position and size in the 1280 × 720 canvas), then run slideware's `check --render` as usual; its `refresh` leaves animotion's runtime and kit alone. Slideware's CLI is `$KW/skills/slideware/html/engine/cli.js`, where `$KW` is the knowledgeware plugin root: `$AM/../knowledgeware` when it exists (a checkout of the marketplace), else two directories above the slideware skill's own folder when that skill is loaded, else the newest version folder under `~/.claude/plugins/cache/*/knowledgeware/` (`ls -d ~/.claude/plugins/cache/*/knowledgeware/*/ | sort -V | tail -1`). The scene can't be edited in slideware's editor beyond moving and resizing the whole element; change it here.

## The scene in one example

```html
<am-scene name="fixes" poster="done" aria-label="Four findings appear, then each turns green as it is fixed."
  style="position:absolute; left:80px; top:180px; width:620px; height:320px">
  <template>
    <style>
      ol { list-style: none; margin: 0; padding: 0; font: 16px var(--font-sans); }
      li { padding: 10px 12px; margin-bottom: 8px; background: #FBEDEA; }
      li[data-state=fixed] { background: #E9F2E6; }
    </style>
    <h3>Findings <span id="open">0 open</span></h3>
    <ol><li id="f1">Long name</li><li id="f2">Negative quantity</li><li id="f3">Double charge</li><li id="f4">Open admin page</li></ol>
    <script type="text/animotion">
      s.enter("ol li", "append", 0.3, { stagger: 0.5 })
       .count("#open", { to: 4, format: "{n} open" }, "<", { dur: 2 })
       .label("found", "+=0.8")
       .set("ol li", { state: "fixed" }, "found", { stagger: 0.25 })
       .count("#open", { to: 0, format: "{n} open" }, "<")
       .label("done", "+=0.6")
       .expect("done", "#open", { text: "0 open" });
    </script>
  </template>
</am-scene>
```

Attributes ([references/contract.md](references/contract.md)): `aria-label` (required: what the animation shows, in one sentence), `poster` (a label, seconds or `end`; required when it loops), `loop` (a count, or `infinite`, which only holds while a deck is presenting), `hold`, `reset` (`fade` | `cut`), `trigger` (`enter`, default: plays when it comes into view; `steps`: the presenter's clicks drive it through `<am-cue data-step="n" to="label">` children; `manual`), `controls="none"`, `seed`, `data-am-overflow`.

## Rules

- **Poster**: always set `poster` to the label of the last resolved beat (`.label("done", …)` and `poster="done"`), even when that's the end: the end moves when someone adds a hold or a beat.
- **Isolation**: the scene's markup and CSS live in its template; brand tokens (`var(--color-*)`, `var(--font-*)`, and the language's `--am-*`) reach inside, page CSS doesn't. Give the element a size.
- **Determinism**: every visible change comes from the timeline. No `Math.random` (use `s.rand()`), no timers, no `Date`, no network. No CSS transitions (they're turned off inside scenes); a CSS animation goes on its element from the start, with a finite count, never switched on by a state or class.
- **Targets, not coordinates**: move to an anchor element (`s.move("#bot", "#qty")`), clone into a container the CSS lays out (`s.clone("#agent", 9, …, { into: "#grid" })`). Coordinates are for small nudges (`{ y: -8 }`).
- **Motion language**: follow the spec's durations, easing roles and signature move ([references/motion.md](references/motion.md)). One lead per beat; enter from the cause; hold after every beat; never ease-in on an entrance.
- **Legibility**: on a 1280 × 720 slide, text in a scene is at least 16 px (labels, captions) and 20 px for what the audience must read during the beat; on a page, 12 px. `check --render` warns below 14 px on a slide, 12 px elsewhere.
- **Accessibility**: `aria-label` on every scene; loops longer than 5 s keep the pause control (don't set `controls="none"`); no element flashes more than 3 times a second; reduced motion shows the poster.
- **Offline**: everything the scene draws is inline (SVG, CSS, data URIs). External assets from the source index are fetched once and embedded, with their credit in the page ([references/sources.md](references/sources.md)).
- **Style, not content**: a reference teaches construction rules; never copy its logos, mascots or characters.
- **Another engine**: if a scene truly needs one (anime.js, GSAP the user brings, a canvas), drive it from `s.custom(null, (el, p, t) => tl.seek(t * 1000), 0, { dur })` so it stays on animotion's clock.

## References

| File | Read when |
|---|---|
| [references/contract.md](references/contract.md) | writing the element, its attributes, steps, the JS API, how it behaves in each viewing mode |
| [references/verbs.md](references/verbs.md) | writing any timeline (always) |
| [references/visual-language.md](references/visual-language.md) | starting a new deck or page, or deriving a style from a reference |
| [references/motion.md](references/motion.md) | choosing durations, easing and choreography |
| [references/sources.md](references/sources.md) | using icons, illustrations, characters or motion values from outside |
