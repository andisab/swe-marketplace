# Slide patterns

Starting points for common slide shapes, written with the kit classes every brand without its own `slideware.css` has (a brand that ships one documents its own classes there). They are conventions, not layouts the runtime knows: copy one, change it freely, or draw the slide from scratch. Vary shapes across a deck ([../../SKILL.md](../../SKILL.md) §Anti-monotony).

Kit classes: `kicker` (small label above a heading), `lede` (a subtitle line), `center` (on a section: centre its content vertically), `cols` (a grid; `--cols: 2fr 3fr` sets the split, `--gap` the gap), `cards` with `card` items (`--n` columns), `stat`, `stat-value`, `stat-unit`, `stat-label`, `attribution`, `figure` (centres a picture or drawing), `footnote` (pinned to the bottom), `grow` (takes the free height). Section-level `--pad` sets the slide's padding.

## Title

```html
<section data-key="title" data-chrome="none" class="center">
  <p class="kicker">Platform team · Q3</p>
  <h1>Code review, automated</h1>
  <p class="lede">What changes on 1 October, and why</p>
  <aside class="notes">Why we're here, in one sentence.</aside>
</section>
```

## Section divider

```html
<section data-key="part-2" data-divider>
  <p class="kicker">Part two</p>
  <h2>What changes in the PR flow</h2>
  <aside class="notes">Transition: from why to how.</aside>
</section>
```

## Statement

One sentence that carries the slide; the rest is air.

```html
<section data-key="claim" class="center">
  <h2 style="max-width: 900px">Every merge gets a second pair of eyes, and one of them never sleeps.</h2>
  <aside class="notes">Say it, pause, move on.</aside>
</section>
```

## List with builds

```html
<section data-key="reasons">
  <h2>Three reasons</h2>
  <ul>
    <li data-step="1" data-a="up">Reviews wait 19 hours on average</li>
    <li data-step="2" data-a="up">Two of five incidents shipped unreviewed code</li>
    <li data-step="3" data-a="up">Reviewers spend a third of their time on style</li>
  </ul>
  <aside class="notes">One line on the slide's purpose.

[click 1] The wait.
[click 2] The incidents.
[click 3] The waste.</aside>
</section>
```

## Two columns

```html
<section data-key="before-after">
  <h2>Before and after</h2>
  <div class="cols" style="--cols: 1fr 1fr">
    <div><h4>Today</h4><p>…</p></div>
    <div data-step="1"><h4>From October</h4><p>…</p></div>
  </div>
  <aside class="notes">…</aside>
</section>
```

## Cards

Two to four; five overflows.

```html
<section data-key="tools">
  <h2>What we're rolling out</h2>
  <div class="cards" style="--n: 3">
    <div class="card" data-a="up" style="--i: 2"><h4>Linter</h4><p>Style issues fixed before review.</p></div>
    <div class="card" data-a="up" style="--i: 3"><h4>Reviewer bot</h4><p>A first pass on every PR.</p></div>
    <div class="card" data-a="up" style="--i: 4"><h4>Dashboard</h4><p>Wait times, per team.</p></div>
  </div>
  <aside class="notes">…</aside>
</section>
```

## Big number

```html
<section data-key="wait" class="center">
  <p class="kicker">Median review wait</p>
  <div class="stat" data-a="pop"><span class="stat-value">19</span><span class="stat-unit">h</span></div>
  <p class="stat-label">Down to 4 h in the pilot teams.</p>
  <aside class="notes">…</aside>
</section>
```

## Quote

```html
<section data-key="voice" class="center">
  <blockquote>The bot catches the boring things, so I can read the interesting ones.</blockquote>
  <p class="attribution">Staff engineer, pilot team</p>
  <aside class="notes">…</aside>
</section>
```

## Figure with a caption

The drawing lives once in the asset block ([../FORMAT.md](../FORMAT.md) §Figures).

```html
<section data-key="flow">
  <h2>The new PR flow</h2>
  <div class="figure grow"><svg data-figure-ref="pr-flow" class="cw-dg"></svg></div>
  <p class="footnote">Source: <a href="https://…" target="_blank" rel="noopener">Engineering handbook</a>, checked 2026-11-03</p>
  <aside class="notes">…</aside>
</section>
```

## Table

```html
<section data-key="timeline">
  <h2>Timeline</h2>
  <table style="width: 100%; border-collapse: collapse">
    <tr><th>Date</th><th>Step</th></tr>
    <tr><td>15 Sep</td><td>Pilot teams</td></tr>
    <tr><td>1 Oct</td><td>Everyone</td></tr>
  </table>
  <aside class="notes">…</aside>
</section>
```

Style tables, and anything else the kit doesn't cover, in the deck's CSS (`#sw-deck-css`) or a slide's own `<style>` with rules prefixed `[data-key="timeline"]`.

## Free placement

Anything can be placed absolutely on the 1280 × 720 canvas, which is also what the editor's Pin does:

```html
<section data-key="map" style="--pad: 0">
  <svg data-figure-ref="company-map" style="position: absolute; left: 40px; top: 120px; width: 820px"></svg>
  <p style="position: absolute; left: 900px; top: 180px; width: 320px">…</p>
  <aside class="notes">…</aside>
</section>
```
