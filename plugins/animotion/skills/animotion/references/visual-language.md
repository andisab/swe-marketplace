# The visual language

Brand tokens give colours, fonts and a radius. A scene needs more: what a document looks like, how "done" is drawn, what an agent is, how thick a line is, how things move. The **visual language** fixes those decisions once, so every scene in a deck or site reads as one system. It is a short spec of checkable decisions plus a **kit** that realises them; scenes compose only from the kit.

## Where it lives

```
<folder of the deck or page>/animotion/
  language.md     the spec: frontmatter (numbers) + sections (rules)
  kit.html        the kit: one <style> (the --am-* tokens and kit classes) and, optionally, one <svg> of <symbol>s
  specimen.html   the approved specimen (a scene of every kit part)
```

`cli.js inline` copies `kit.html` into the file as `<template id="am-kit">`; the runtime stamps it into every scene, so kit classes, tokens and `<use href="#…">` symbols work inside each scene's shadow root. A language that belongs to a brand lives in the brand's folder instead (`<brand>/animotion/` in knowledgeware's brand registry) and is copied into a deck's `animotion/` folder when the deck starts.

Look for a spec in that order (the deck's, then the brand's) before writing one. Never mix two languages in one file.

## The spec: language.md

```markdown
---
animotion: 1
idiom: blocky                 # exactly one: blocky | flat | line | hand-drawn | isometric | ui-wireframe
principles: [engineered, warm, plain]   # 3–5 adjectives, each with a test in §Principles
unit: 8                       # px grid; drawn sizes and gaps are multiples
radius: [0]                   # allowed corner radii (px)
strokes: [1, 2]               # allowed stroke widths (px); at most 4
fills: flat                   # flat | gradient | texture
shadow: ground-ellipse        # none | ground-ellipse | flat-offset | soft
tints: [100, 60, 30]          # accent strengths and what each means (§Emphasis)
fidelity: mid                 # default for UI mock-ups: high | mid | low (greeked)
motion:
  personality: expressive     # expressive | productive
  dur: { xs: 150, sm: 250, md: 400, lg: 600, xl: 900 }   # ms
  ease: { enter: "cubic-bezier(0.05, 0.7, 0.1, 1)", exit: "cubic-bezier(0.3, 0, 0.8, 0.15)", move: "cubic-bezier(0.2, 0, 0, 1)", effect: "cubic-bezier(0.33, 0, 0.67, 1)" }
  signature: pop              # the one recognisable move
  stagger: 70                 # ms
  concurrency: 3              # groups moving at once
sources: [lucide, dicebear-pixel-art]   # index ids this language draws from (references/sources.md)
references: []                # where it was derived from: url or file, date, role
---

## Principles        each adjective with a test ("engineered: every edge on the 8 px grid")
## Emphasis          what each tint means (100: the point; 60: secondary or "many"; 30: background)
## States            ok, warn, error, pending, idle, active → colour token + glyph + shape
## Ladder            how each thing is drawn: document, list, chart, app, terminal, file, person, agent, message, server
## Characters        (optional) base construction, expressions, accessories, hierarchy
## Type roles        which face labels drawings, which marks machine text, how a title highlights a phrase
## Texture           (optional) one background treatment and where it may appear
## Motion            roles, signature move, holds, what never moves
## Density           elements per scene, spacing, one focal point
## Do not reproduce  logos, mascots and characters seen in references (style only)
## Credits           external assets used, with their licence and credit line
```

Every rule should be checkable, either by `check` or by eye on the specimen: "edges on the 8 px grid", not "clean".

## Establishing it, from least to most input

1. **From the brand alone** (no questions). Map tokens to defaults: radius 0 and a mono face → `blocky`, productive motion, signature `fade`; a large radius and a rounded sans → `flat`, expressive, signature `pop`; an editorial serif → `line`, expressive with no bounce, signature `draw`. States take the brand's success, warning and error colours; tints come from the accent. State the mapping you used.
2. **From a named idiom.** Offer two or three idioms that fit the brand and the topic, each as a small specimen (one row of the kit); the user picks. Claude follows a named idiom with rules far more reliably than an adjective.
3. **From a reference** the user points at: a website, screenshots, a screen recording, a PDF or deck, a Lottie or SVG file, written guidelines. The procedure below.
4. **Specimen approval** (always, for a new language). Build `specimen.html`: one scene showing the state badges, the ladder, the character's poses (if any), a card, a track, a bubble, and each motion verb once. Render it (`cli.js frames specimen.html --at every=1`), show the user the sheet, and lock the spec only after a yes.
5. **Corrections go into the spec**, never into one scene: "idle agents get a grey bar" changes `language.md` and the kit, and every scene inherits it.

## Deriving from a reference

Measure first, interpret second: what a tool can measure exactly, measure; what only judgement can decide (idiom, ladder, what tints and states mean), answer from the evidence, citing it.

1. **Capture.**
   - *Website*: open it in Chrome; record declared custom properties (`--color-*` and the like; a brand's accent is often declared but barely used), computed colours, fonts, radii and stroke widths of visible elements, inline SVG strokes and grids; **trigger motion** (scroll the page, hover links and buttons) and read `document.getAnimations()` for real durations, delays, easing and stagger. Mask photos, video and iframes before reading colours from screenshots; dismiss consent banners.
   - *Screen recording*: extract frames (on macOS without ffmpeg, AVFoundation through a short Swift script), make a contact sheet, then crop close-ups of each kind of element at full resolution. Time motion from frame differences; report easing as the nearest named curve plus a duration.
   - *Image, PDF, deck*: colour clusters with photos masked; PDF and PPTX themes give exact colours and fonts.
   - *Lottie or SVG*: exact keyframes, easing and layer structure.
   - Optional second opinion for a website: Dembrandt (MIT), `npx --yes dembrandt@0.39.2 <url> --json-only` with `BROWSER_CDP_ENDPOINT` pointed at an open Chrome; good on colour roles, logos and shadows, weak on motion.
2. **Interpret with a fixed questionnaire**, each answer citing a crop or a measurement, `unknown` allowed: idiom; fills, outlines, shadow, perspective; unit and whether UI radii and strokes apply to drawings; what tints mean; each state's colour, glyph and shape; how each ladder item is drawn; characters (construction, expression channel, identity channel, hierarchy channel) **and what must not be copied**; type roles; texture; signature move, verbs seen, how many things move at once, holds; density.
3. **Draft** `language.md` and `kit.html` from the answers. Snap colours read from video or screenshots to the brand's declared tokens when they're close (video colour drifts visibly).
4. **Specimen in the target brand**, then compare it side by side with the reference crops: idiom, ladder, state glyphs, character construction, motion signature, and whether anything copies an excluded mark. Show the user; lock on a yes.

Budget about one contact sheet plus 12–20 close-ups per reference (a 400 px crop costs about 225 tokens to look at; a full 4K frame costs over 4,700).

**Style, not content.** A reference teaches construction rules, written one level up: "blocky flat figure built on the unit grid, expression in the eyes only, identity through accessories, rank by scale and tint". Never its logo, its mascot, its characters' silhouettes or its product UI. List those under Do not reproduce.

## The kit: kit.html

```html
<style>
  :host { --am-unit: 8px; --am-dur-sm: 250ms; --am-dur-md: 400ms; --am-dur-lg: 600ms; --am-dur-xl: 900ms;
          --am-ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1); --am-ok: var(--color-success); --am-tint-60: color-mix(in oklab, var(--color-accent) 60%, var(--color-bg)); }
  .am-badge { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: #fff; }
  .am-badge[data-state=ok] { background: var(--am-ok); } …
  .am-doc { … greeked bars … }   .am-card { … }   .am-track { … }   .am-bubble { … }
</style>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="am-check" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
</svg>
```

- The kit is stamped into every scene, so it holds CSS, SVG and sprite data only: an executable `<script>` in it would run once per scene.
- `:host` rules set the tokens on each scene; the runtime reads `--am-dur-*` and `--am-ease-*` for every verb's defaults.
- Name kit classes `am-*`; style states with `[data-state=…]` so timelines only `set({ state })`.
- Characters and props in the blocky idiom are **sprites declared in the kit** as data: `<script type="application/json" data-am-sprites>{ "agent": { "unit": 4, "palette": {…}, "poses": { "neutral": […], "happy": […] } } }</script>`, one string per pixel row. Poses differ in a few rows (expression in the eyes); accessories are separate small sprites placed over the body. Scenes write `<i data-am-sprite="agent:neutral"></i>` and swap with `s.pose`. Greeked text is bars at x-height with gaps of 1.5 bars.
- External icons and illustrations come from the source index ([sources.md](sources.md)), restyled to the spec (stroke width, `currentColor`, grid snap, radius) and credited.
