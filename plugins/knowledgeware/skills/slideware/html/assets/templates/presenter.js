// presenter.js — presenter view, section overview and rehearsal notes drawer for slideware
// HTML decks.
//
// A Reveal.js 5 plugin. build-deck.js inlines this file into index.html and registers it:
//   Reveal.initialize({ ..., plugins: [RevealPresenter] })
// It replaces Reveal's own notes plugin (RevealNotes). Don't register both: both bind S.
// It also replaces Reveal's zoomed-out overview (O) with the section overview below and
// turns that one off (`overview: false`), so O means one thing.
//
// Audience window (the deck itself):
//   S or P  open the presenter view in a second window; the two windows stay in sync
//           (BroadcastChannel plus window.postMessage, so it also works from file://)
//   N       toggle a notes drawer along the bottom of the deck, for rehearsal. Anyone
//           who can see the screen can read it. The deck shrinks to the space above the
//           drawer (the --rp-reserve-bottom custom property on <html>, which review.js's
//           panel uses too), so long notes never cover the slide.
//   O       toggle the overview: every slide as a thumbnail, in a grid per section. A
//           section-divider slide (layout-section) heads its group with its kicker and
//           title; the slides before the first divider are the opening; a deck with no
//           dividers is one grid. The current slide is outlined, a click goes to a slide,
//           the arrow keys move between thumbnails, Esc (or O) closes. Opening the deck
//           with ?overview starts in it. The overview is drawn from the deck's own style
//           tokens (its colors, fonts and radius), so it matches whatever brand the deck
//           uses. Also available in the presenter window, where it moves both windows.
//           When the deck was built in lanes (presenter: { lanes: [{ name, file, color }] }), the
//           overview's header holds a lane switcher that opens the same slide in another lane,
//           with the lane's colour beside it, and every thumbnail carries a bar along its base:
//           ink for a slide as the base deck has it, the lane's colour for one the lane changes
//           (the builder marks those with data-lane-changed).
//           In a deck with review mode (review.js sets window.RevealReviewAPI) the overview
//           also edits the deck's structure, pending a rebuild: every slide is shown, hidden
//           ones under a mask; an eye on each thumbnail hides or shows it in this lane, an X
//           deletes it (Undo brings it back), thumbnails drag and drop into a new order, and
//           H, Delete and Shift+arrows do the same on the focused thumbnail. A Rebuild deck
//           button beside Close turns solid while anything is queued.
//   Navigation pill: a floating bar at the bottom (previous, the slide number, next, the
//           current section's name, the overview, fullscreen, and an i that lists every
//           key on hover and pins the list on click), in the deck's tokens. Shown for
//           2.5 s after the mouse moves or on hover, above the notes drawer; hidden in
//           print, in the presenter window and under the overview. It replaces Reveal's
//           arrows (controls: false).
//
// Presenter window (the deck opened with ?presenter):
//   previous slide | current slide | next slide across the top, notes full width below.
//   Drag a sidebar's border to resize that sidebar: the current slide fills the width
//   between the sidebars, and the notes take the height it leaves. Drag the border above
//   the notes to resize the current slide; the sidebars split the difference. Double-click
//   a border to reset it; a focused border moves with the arrow keys.
//   The header holds the slide number, the current session's length (editable; edits are
//   remembered per browser until the deck's own length changes) and the time that gives
//   each slide, a pace line, the elapsed timer (starts on the first move; Pause / Reset)
//   and the clock.
//   [ / ]   hide or show the previous / next sidebar (also the header's Prev / Next buttons);
//           a hidden sidebar's width goes to the current slide
//   + / -   notes text size
//   Sidebar widths and visibility and text size are remembered per browser (localStorage).
//
// Pacing: Reveal.initialize({ presenter: { sessions: { "Session 1": 90 } } }) sets each
// session's length in minutes ("" is the session of slides without a label). Every slide
// in the run gets an equal share; the plan at a slide is that share times the in-run
// slides before it in its session. Slides with data-visibility="hidden" are removed by
// Reveal, so they don't count.
//
// Notes come from <aside class="notes"> in each slide (or Reveal's data-notes attribute).
// The aside's data attributes carry the slide's cue:
//   data-session  label such as "Session 1"; slides with the same label share a length
//   data-module   label shown in the notes drawer's cue line, such as "Module 3.1"
//   data-run      default | cut-first | add-back | backup
//                 (only default and cut-first slides are in the run and get a share)
// Notes are plain text: blank lines split paragraphs, lines starting "- " form a list,
// and **bold**, *italic* and [pause] are rendered.
//
// The previous and next panes are scaled copies of those slides' markup, shown fully
// built. Scripts inside slides don't run in the copies.

(function (root) {
  "use strict";

  const NS = "reveal-presenter";
  const PREFS_KEY = NS + ":prefs";
  const RUNS = {
    "default":   { label: "Default run", inRun: true },
    "cut-first": { label: "Default run · cut first if behind", inRun: true },
    "add-back":  { label: "Add-back · use if ahead", inRun: false },
    "backup":    { label: "Backup slide", inRun: false },
  };
  const GUTTER = 8;                            // px between panes and at the window edges; each border's grab area is 16px
  const TOP_H = 56, STATUS_H = 24;             // px: header row (bar plus the gutter under it) and status row
  const SIDE = { def: 18, min: 10, max: 30 };  // sidebar widths, % of the window's content width
  const ROW_MIN = 160, NOTES_MIN = 120;        // px: shortest slides row, shortest notes pane
  const FONT = { def: 20, min: 14, max: 34, step: 2 };
  // In the presenter window the deck is a quiet pane: no chrome, no transitions, and no
  // switch to scroll view (Reveal does that when the deck is narrower than 435px).
  const PRESENTER_CONFIG = {
    controls: false, progress: false, slideNumber: false, margin: 0,
    transition: "none", backgroundTransition: "none", scrollActivationWidth: null,
  };

  const MONO = "var(--font-mono, ui-monospace, Menlo, monospace)";
  const SANS = "var(--font-sans, system-ui, sans-serif)";
  const ACCENT = "var(--color-accent, #3B5249)";
  const CSS = `
.rp-drawer { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; max-height: 38vh; overflow-y: auto;
  padding: 16px 28px 22px; background: rgba(250,250,249,.97); border-top: 1px solid #E3E3DF;
  box-shadow: 0 -8px 24px rgba(26,26,24,.10); color: #1A1A18; font-family: ${SANS}; line-height: 1.55; text-align: left; }
html.rp-drawer-on .rp-drawer { display: block; padding-bottom: 64px; }   /* room for the navigation pill, which sits above the drawer */
/* The deck gives up the bottom of the viewport to whatever sits there (the notes drawer, review mode's panel) and Reveal re-fits the slide. */
html.rp-drawer-on body > .reveal, html.rv-on body > .reveal { height: calc(100% - var(--rp-reserve-bottom, 0px)); }
.rp-cue-text { font-family: ${MONO}; font-size: 11px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rp-drawer .rp-md { margin-top: 8px; font-size: 18px; max-width: 1100px; }
.rp-md p { margin: 0 0 .8em; }
.rp-md ul { margin: 0 0 .8em 1.1em; padding: 0; }
.rp-md b { font-weight: 700; }
.rp-empty { color: #6B6B63; font-style: italic; }
.rp-pause { display: inline-block; padding: 1px 7px; border: 1px solid #E8B892; border-radius: 6px; background: #FAEEE4; color: #A85C32;
  font-family: ${MONO}; font-size: .62em; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; vertical-align: .15em; }

.rp-shell { display: none; }
html.rp-presenter body { background: #F4F4F2; }
html.rp-presenter .rp-shell { position: fixed; inset: 0; z-index: 1; display: grid;
  grid-template-columns: var(--rp-prev-w, ${SIDE.def}%) var(--rp-prev-g, ${GUTTER}px) minmax(0, 1fr) var(--rp-next-g, ${GUTTER}px) var(--rp-next-w, ${SIDE.def}%);
  grid-template-rows: ${TOP_H}px var(--rp-row, 55%) ${GUTTER}px minmax(0, 1fr) ${STATUS_H}px;
  padding: 0 ${GUTTER}px ${GUTTER}px; color: #1A1A18; font-family: ${SANS}; line-height: 1.4; text-align: left; }
.rp-top { grid-area: 1 / 1 / 2 / -1; }
.rp-side-prev { grid-area: 2 / 1; }
.rp-split[data-split=prev] { grid-area: 2 / 2; }
.rp-current { grid-area: 2 / 3; }
.rp-split[data-split=next] { grid-area: 2 / 4; }
.rp-side-next { grid-area: 2 / 5; }
.rp-split-y { grid-area: 3 / 1 / 4 / -1; }
.rp-notes-wrap { grid-area: 4 / 1 / 5 / -1; }
.rp-status { grid-area: 5 / 1 / 6 / -1; }
.rp-shell[data-hide-prev] .rp-side-prev, .rp-shell[data-hide-prev] [data-split=prev],
.rp-shell[data-hide-next] .rp-side-next, .rp-shell[data-hide-next] [data-split=next] { display: none; }
html.rp-presenter .reveal [data-a] { animation: none !important; }   /* the presenter sees each slide fully in place */
html.rp-presenter .reveal.rp-main { border-radius: 10px; box-shadow: 0 0 0 1px #E3E3DF, 0 2px 8px -2px rgba(26,26,24,.18); }
/* Dark header bar, edge to edge, with a gutter under it. */
.rp-top { display: flex; align-items: center; gap: 20px; align-self: start; height: ${TOP_H - GUTTER}px; min-width: 0;
  margin: 0 -${GUTTER}px; padding: 0 ${GUTTER + 8}px; background: #232321; color: #C9C9C3; white-space: nowrap;
  font-family: ${MONO}; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.rp-top > * { flex: none; }
.rp-count { font-weight: 600; color: #FFFFFF; }
.rp-session { display: flex; align-items: center; gap: 8px; margin-left: auto; text-transform: none; letter-spacing: .02em; }
.rp-session-name:empty { display: none; }
.rp-length { width: 4.5em; padding: 3px 6px; border: 1px solid rgba(255,255,255,.25); border-radius: 6px; background: transparent;
  color: #FFFFFF; font: 600 13px ${MONO}; text-align: right; }
.rp-length:focus { outline: 2px solid #EDEDEA; outline-offset: 1px; }
.rp-each { color: #9E9E97; }
.rp-pace { text-transform: none; letter-spacing: .02em; }
.rp-pace.rp-behind { color: #F2A58E; }
.rp-pace.rp-ahead { color: #A8CDB0; }
.rp-timer, .rp-clock { font-size: 24px; font-weight: 600; letter-spacing: .04em; color: #FFFFFF; font-variant-numeric: tabular-nums; }
.rp-shell button { all: unset; cursor: pointer; padding: 4px 10px; border: 1px solid #CBD2CB; border-radius: 8px; color: ${ACCENT};
  font: 500 11px ${MONO}; letter-spacing: .08em; text-transform: uppercase; }
.rp-shell button:hover { background: #EEF1EE; }
.rp-shell button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
.rp-shell .rp-top button { padding: 5px 11px; border-color: rgba(255,255,255,.25); color: #EDEDEA; font-size: 12px; }
.rp-shell .rp-top button:hover { background: rgba(255,255,255,.08); }
.rp-shell .rp-top button:focus-visible { outline-color: #EDEDEA; }
.rp-views { display: flex; gap: 6px; }
.rp-shell .rp-views button { display: inline-flex; align-items: center; gap: 6px; }
.rp-shell .rp-views button[aria-pressed=false] { border-style: dashed; color: #8E8E87; }
.rp-eye { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rp-views button[aria-pressed=true] .rp-eye-off, .rp-views button[aria-pressed=false] .rp-eye-on { display: none; }

.rp-side { display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; overflow: hidden; }
.rp-side > * { flex: none; }
.rp-side-head { display: flex; justify-content: space-between; gap: 8px; font-family: ${MONO}; font-size: 10.5px;
  letter-spacing: .14em; text-transform: uppercase; color: #4A4A43; }
.rp-side-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.7em; font-size: 13px; line-height: 1.35; color: #1A1A18; }
/* Full width at the slide's aspect ratio; shrinks in height when the slides row is short (fitThumbs letterboxes the copy). */
.rp-side > .rp-thumb { position: relative; flex: 0 1 auto; width: 100%; aspect-ratio: var(--rp-ratio, 16 / 9); min-height: 0; container-type: size; }
.rp-thumb > .rp-preview { position: absolute; top: 0; border-radius: 8px; box-shadow: 0 0 0 1px #E3E3DF; pointer-events: none; }
/* START / END fill about 80% of the card's width (a mono character is ~.66em with this tracking), capped by its height. */
.rp-end { position: absolute; inset: 0; display: grid; place-items: center; padding-left: .06em; border: 1px dashed #D5D5D0; border-radius: 8px;
  font-family: ${MONO}; font-size: min(calc(80cqw / (var(--chars, 5) * .66)), 60cqh); font-weight: 600; letter-spacing: .06em;
  line-height: 1; text-transform: uppercase; color: #CFCFC9; }
.rp-steps { font-size: 12px; color: ${ACCENT}; }

.rp-current { min-width: 0; min-height: 0; }
.rp-notes-wrap { display: flex; flex-direction: column; min-height: 0; padding: 14px 20px; border: 1px solid #E3E3DF; border-radius: 14px; background: #FFFFFF; }
.rp-notes-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px;
  font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #4A4A43; }
.rp-shell .rp-notes-head button { padding: 2px 8px; margin-left: 4px; font-size: 13px; letter-spacing: 0; }
.rp-notes { flex: 1; min-height: 0; overflow-y: auto; padding-right: 6px; font-size: var(--rp-font, ${FONT.def}px); line-height: 1.55; }
/* A scrollbar that stays visible while the notes overflow (macOS otherwise hides it until you scroll). */
.rp-notes::-webkit-scrollbar { width: 10px; }
.rp-notes::-webkit-scrollbar-track { background: #F1F1EE; border-radius: 5px; }
.rp-notes::-webkit-scrollbar-thumb { background: #C4C4BE; border: 2px solid #F1F1EE; border-radius: 5px; }
.rp-notes::-webkit-scrollbar-thumb:hover { background: #9E9E97; }
@supports not selector(::-webkit-scrollbar) { .rp-notes { scrollbar-width: thin; scrollbar-color: #C4C4BE #F1F1EE; } }

.rp-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 6px; white-space: nowrap;
  font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: #6B6B63; }
.rp-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: ${ACCENT}; }

/* Each border overhangs its ${GUTTER}px gutter by 4px on both sides, so it stays easy to grab. */
.rp-split { position: relative; z-index: 1; touch-action: none; outline: none; }
.rp-split-x { margin: 0 -4px; cursor: col-resize; }
.rp-split-y { margin: -4px 0; cursor: row-resize; }
.rp-split::before { content: ""; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 2px; background: #CFCFCA; }
.rp-split-x::before { width: 4px; height: 36px; }
.rp-split-y::before { width: 36px; height: 4px; }
.rp-split::after { content: ""; position: absolute; background: transparent; transition: background .15s; }
.rp-split-x::after { top: 0; bottom: 0; left: 7px; width: 2px; }
.rp-split-y::after { left: 0; right: 0; top: 7px; height: 2px; }
.rp-split:hover::before, .rp-split:hover::after, .rp-split:focus-visible::before, .rp-split:focus-visible::after,
.rp-split.rp-active::before, .rp-split.rp-active::after { background: ${ACCENT}; }
html.rp-resizing-x, html.rp-resizing-x * { cursor: col-resize !important; user-select: none !important; }
html.rp-resizing-y, html.rp-resizing-y * { cursor: row-resize !important; user-select: none !important; }

/* Section overview: the deck's own tokens, so it matches the deck's style rather than a fixed theme. */
.rp-ov { display: none; position: fixed; inset: 0; z-index: 50; overflow-y: auto; padding: 28px 36px 64px;
  background: var(--color-surface-alt, var(--color-bg, #F4F4F2)); color: var(--color-ink, #1A1A18); font-family: ${SANS}; line-height: 1.4; text-align: left; }
html.rp-ov-on .rp-ov { display: block; }
.rp-ov-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.rp-ov-title { margin: 0 0 4px; font-family: var(--font-serif, ${SANS}); font-size: 22px; font-weight: 600; line-height: 1.2; color: var(--color-ink, #1A1A18); }
.rp-ov-sub { margin: 0; font-size: 13px; color: var(--color-ink-muted, #6B6B63); }
.rp-ov button.rp-ov-close { all: unset; cursor: pointer; flex: none; padding: 6px 12px; border: 1px solid var(--color-border, #CBD2CB); border-radius: var(--radius, 8px);
  color: ${ACCENT}; font: 500 11px ${MONO}; letter-spacing: .08em; text-transform: uppercase; }
.rp-ov button.rp-ov-close:hover { background: var(--color-surface, #FFFFFF); }
.rp-ov button.rp-ov-close:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
.rp-ov-grp { display: flex; align-items: baseline; gap: 12px; margin: 30px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border, #E3E3DF);
  font-family: var(--font-serif, ${SANS}); font-size: 17px; font-weight: 600; line-height: 1.25; color: var(--color-ink, #1A1A18); }
.rp-ov-body > .rp-ov-grp:first-child { margin-top: 22px; padding-top: 0; border-top: 0; }
.rp-ov-body > .rp-ov-grid:first-child { margin-top: 22px; }
.rp-ov-kick { flex: none; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rp-ov-count { flex: none; margin-left: auto; font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: var(--color-ink-faint, #9E9E97); }
.rp-ov button.rp-ov-rebuild { margin-right: 8px; transition: background .15s, color .15s, border-color .15s; }
html.rv-queued .rp-ov button.rp-ov-rebuild { background: var(--color-success, #3F8A4F); border-color: var(--color-success, #3F8A4F); color: #FFFFFF; }
html.rv-queued .rp-ov button.rp-ov-rebuild:hover { filter: brightness(1.08); }
.rp-ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px 16px; }
.rp-ov-cell { position: relative; min-width: 0; }
.rp-ov-cell[draggable] { cursor: grab; }
.rp-ov-cell.rp-dragging { opacity: .35; }
.rp-ov-cell.rp-drop-before .rp-ov-box { box-shadow: -8px 0 0 -4px ${ACCENT}; }
.rp-ov-cell.rp-drop-after .rp-ov-box { box-shadow: 8px 0 0 -4px ${ACCENT}; }
.rp-ov-th { all: unset; display: block; min-width: 0; cursor: pointer; }
.rp-ov-cell[draggable] .rp-ov-th { cursor: grab; }
/* A hidden slide sits under a mask in the panel's own background, so it reads as dimmed in light and dark styles alike. */
.rp-ov-mask { display: none; position: absolute; inset: 0; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--color-surface-alt, var(--color-bg, #F4F4F2)) 74%, transparent); color: var(--color-ink-muted, #6B6B63); }
.rp-ov-mask svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.rp-ov-cell.rp-hidden .rp-ov-mask { display: flex; }
.rp-ov-cell.rp-hidden .rp-ov-cap { color: var(--color-ink-muted, #6B6B63); }
.rp-ov-cell.rp-deleted .rp-ov-box { opacity: .3; filter: grayscale(1); }
.rp-ov-cell.rp-deleted .rp-ov-cap { color: var(--color-ink-muted, #6B6B63); text-decoration: line-through; }
.rp-ov-tools { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity .12s; }
.rp-ov-cell:hover .rp-ov-tools, .rp-ov-cell:focus-within .rp-ov-tools, .rp-ov-cell.rp-hidden .rp-ov-tools, .rp-ov-cell.rp-deleted .rp-ov-tools { opacity: 1; }
.rp-ov-tools button { all: unset; cursor: pointer; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;
  background: var(--color-surface, #FFFFFF); border: 1px solid var(--color-border, #E3E3DF); color: var(--color-ink, #1A1A18); box-shadow: 0 2px 8px rgba(0, 0, 0, .14); }
.rp-ov-tools button:hover { color: ${ACCENT}; border-color: ${ACCENT}; }
.rp-ov-tools button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
.rp-ov-tools button[data-ov=undo] { width: auto; padding: 0 9px; border-radius: 13px; font: 500 11px ${MONO}; letter-spacing: .06em; text-transform: uppercase; }
.rp-ov-tools svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rp-ov-box { position: relative; width: 100%; aspect-ratio: var(--rp-ratio, 16 / 9); overflow: hidden; border-radius: var(--radius, 6px);
  background: var(--color-bg, #FFFFFF); outline: 1px solid var(--color-border, #E3E3DF); outline-offset: 0; transition: outline-color .12s; }
.rp-ov-box > .rp-preview { position: absolute; inset: 0; pointer-events: none; }
.rp-ov-th:hover .rp-ov-box, .rp-ov-th:focus-visible .rp-ov-box { outline: 2px solid ${ACCENT}; }
.rp-ov-th.rp-cur .rp-ov-box { outline: 3px solid var(--color-ink, #1A1A18); }
.rp-ov-cap { display: flex; gap: 8px; margin-top: 8px; font-size: 12px; line-height: 1.35; color: var(--color-ink-body, #1A1A18); }
.rp-ov-cap b { flex: none; font-family: ${MONO}; font-weight: 500; color: ${ACCENT}; font-variant-numeric: tabular-nums; }
.rp-ov-cap span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rp-ov .reveal [data-a] { animation: none !important; }   /* thumbnails show each slide fully in place */
.rp-ov-lane { display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 12px; font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-ink-muted, #6B6B63); }
.rp-ov-lane select { font: 500 12px ${SANS}; color: var(--color-ink, #1A1A18); background: var(--color-surface, #FFFFFF); border: 1px solid var(--color-border, #E3E3DF); border-radius: var(--radius, 8px); padding: 5px 8px; }
.rp-ov-lane select:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
.rp-ov-swatch { width: 12px; height: 12px; border-radius: 50%; background: var(--rp-lane, var(--color-ink, #1A1A18)); box-shadow: 0 0 0 1px var(--color-border, #E3E3DF); }
.rp-ov-cell.rp-laned .rp-ov-box::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--rp-lane, var(--color-ink, #1A1A18)); }

/* Navigation pill: the deck's surface at 92%, its ink, border and accent, so a dark style gives a dark pill. */
.rp-hud { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 45; display: flex; align-items: center; gap: 4px; padding: 5px;
  border-radius: 12px; border: 1px solid var(--color-border, #E3E3DF); background: var(--color-surface, #FFFFFF);
  background: color-mix(in srgb, var(--color-surface, #FFFFFF) 92%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  color: var(--color-ink, #1A1A18); font-family: ${SANS}; font-size: 12px; box-shadow: 0 8px 30px rgba(0, 0, 0, .18); opacity: 0; transition: opacity .3s; }
html.rp-hud-on .rp-hud, .rp-hud:hover, .rp-hud:focus-within, .rp-hud[data-help] { opacity: 1; }
.rp-hud button { all: unset; cursor: pointer; height: 30px; min-width: 30px; padding: 0 9px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-ink, #1A1A18); }
.rp-hud button:hover { background: color-mix(in srgb, var(--color-ink, #1A1A18) 7%, transparent); }
.rp-hud button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
.rp-hud svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rp-hud .rp-hud-count { font-family: ${MONO}; font-size: 12px; padding: 0 8px; min-width: 74px; text-align: center; font-variant-numeric: tabular-nums; }
.rp-hud .rp-hud-count span { color: var(--color-ink-muted, #6B6B63); }
.rp-hud .rp-hud-sep { width: 1px; height: 18px; margin: 0 3px; background: color-mix(in srgb, var(--color-ink, #1A1A18) 14%, transparent); }
.rp-hud .rp-hud-name { padding: 0 8px; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-ink-muted, #6B6B63); }
.rp-hud .rp-hud-name:empty, .rp-hud .rp-hud-name:empty + .rp-hud-sep { display: none; }
/* The key list: hover or focus the i for a tooltip, click to pin it (Esc or a click elsewhere unpins). */
.rp-hud-info { position: relative; display: inline-flex; }
.rp-hud-help { display: none; position: absolute; right: 0; bottom: calc(100% + 6px); width: 320px; padding: 12px 14px 10px; box-sizing: border-box; cursor: default;
  border-radius: 12px; border: 1px solid var(--color-border, #E3E3DF); background: var(--color-surface, #FFFFFF); color: var(--color-ink, #1A1A18);
  box-shadow: 0 8px 30px rgba(0, 0, 0, .18); font-size: 12px; line-height: 1.4; text-align: left; }
.rp-hud-help::after { content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; }   /* keeps :hover across the gap */
.rp-hud-info:hover .rp-hud-help, .rp-hud-info:focus-within .rp-hud-help, .rp-hud[data-help] .rp-hud-help { display: block; }
.rp-hud-help h3 { margin: 0 0 8px; font: 600 11px/1 ${SANS}; letter-spacing: .1em; text-transform: uppercase; color: var(--color-ink-muted, #6B6B63); }
.rp-hud-help dl { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; margin: 0; }
.rp-hud-help dt { font-family: ${MONO}; font-size: 11px; white-space: nowrap; color: ${ACCENT}; }
.rp-hud-help dd { margin: 0; }
.rp-hud-help p { margin: 8px 0 0; color: var(--color-ink-muted, #6B6B63); }
html.rp-presenter .rp-hud, html.rp-ov-on .rp-hud { display: none !important; }
@media print { .rp-hud { display: none !important; } }
`;
  const HUD_HTML = `
<button type="button" data-hud="prev" aria-label="Previous slide" title="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
<span class="rp-hud-count"></span>
<button type="button" data-hud="next" aria-label="Next slide" title="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
<span class="rp-hud-sep"></span>
<span class="rp-hud-name"></span>
<span class="rp-hud-sep"></span>
<button type="button" data-hud="grid" aria-label="Slide overview (O)" title="Overview (O)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button>
<button type="button" data-hud="full" aria-label="Fullscreen (F)" title="Fullscreen (F)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
<span class="rp-hud-info"><button type="button" data-hud="help" aria-label="Keyboard shortcuts" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg></button><div class="rp-hud-help" role="tooltip"></div></span>`;
  // The key list behind the pill's i. Review mode's keys are listed when the deck was built with it.
  const KEYS = [
    ["→ ← Space", "Next and previous slide"],
    ["S or P", "Presenter view in a second window"],
    ["N", "Notes drawer, for rehearsal"],
    ["O", "Overview of every slide, by section"],
    ["F", "Fullscreen"],
    ["B or .", "Black out the screen"],
    ["Esc", "Close the overview, leave a field"],
    ["?", "Every Reveal.js key"],
  ];
  const REVIEW_KEYS = [
    ["E", "Review mode: edit text and notes in place"],
    ["⇧B", "Rebuild the deck (through serve-deck.js)"],
    ["H · Del · ⇧←→", "In the overview: hide, delete or move the focused slide"],
  ];
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.4 10.4 0 0 1 12 5c5 0 9 4 10 7a11.7 11.7 0 0 1-3.2 4.3M6.3 6.3A11.6 11.6 0 0 0 2 12c1 3 5 7 10 7a9.7 9.7 0 0 0 4.4-1"/></svg>';
  const EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const OPENING = "Opening";   // the group of slides before the first section divider

  const splitHtml = (name, axis, label) => `<div class="rp-split rp-split-${axis}" data-split="${name}" role="separator"
  aria-label="${label}" aria-orientation="${axis === "x" ? "vertical" : "horizontal"}" tabindex="0"
  title="Drag to resize · double-click to reset"></div>`;
  const sideHtml = (side, label) => `
<div class="rp-side rp-side-${side}">
  <div class="rp-side-head"><span>${label}</span><span class="rp-side-num"></span></div>
  <div class="rp-side-title"></div>
  <div class="rp-thumb"></div>${side === "next" ? '\n  <div class="rp-steps"></div>' : ""}
</div>`;
  const EYE = `<svg class="rp-eye" viewBox="0 0 24 24" aria-hidden="true">
<g class="rp-eye-on"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>
<g class="rp-eye-off"><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1"/><path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></g></svg>`;
  const SHELL_HTML = `
<header class="rp-top">
  <span class="rp-count"></span>
  <span class="rp-views">
    <button type="button" data-rp="prev" aria-pressed="true" title="Show or hide the previous-slide pane ( [ )">${EYE}Prev</button>
    <button type="button" data-rp="next" aria-pressed="true" title="Show or hide the next-slide pane ( ] )">${EYE}Next</button>
  </span>
  <label class="rp-session" title="Session length. Each slide in the run gets an equal share of it.">
    <span class="rp-session-name"></span><input class="rp-length" type="number" min="1" max="600" step="5" placeholder="–"
      aria-label="Session length in minutes">min<span class="rp-each"></span>
  </label>
  <span class="rp-pace"></span><span class="rp-timer">00:00</span>
  <button type="button" data-rp="pause">Pause</button><button type="button" data-rp="reset">Reset</button><span class="rp-clock"></span>
</header>
${sideHtml("prev", "Previous")}
${splitHtml("prev", "x", "Resize previous slide")}
<div class="rp-current"></div>
${splitHtml("next", "x", "Resize next slide")}
${sideHtml("next", "Next")}
${splitHtml("row", "y", "Resize current slide and notes")}
<div class="rp-notes-wrap">
  <div class="rp-notes-head"><span>Notes</span><span>
    <button type="button" data-rp="smaller" aria-label="Smaller notes">A−</button><button type="button" data-rp="larger" aria-label="Larger notes">A+</button>
  </span></div>
  <div class="rp-notes rp-md"></div>
</div>
<div class="rp-status"><span class="rp-title"></span><span class="rp-sync"></span></div>`;

  // ── Notes text ────────────────────────────────────────────────────
  function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function inline(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>")
      .replace(/\[pause\]/gi, '<span class="rp-pause">pause</span>');
  }
  function md(text) {
    if (!text.trim()) return '<p class="rp-empty">No notes for this slide.</p>';
    return text.trim().split(/\n\s*\n/).map((para) => {
      const lines = para.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
        return "<ul>" + lines.map((l) => "<li>" + inline(l.replace(/^\s*[-•]\s+/, "")) + "</li>").join("") + "</ul>";
      return "<p>" + inline(para) + "</p>";
    }).join("");
  }

  function readNote(slide) {
    const aside = slide.querySelector("aside.notes");
    const d = aside ? aside.dataset : {};
    return {
      text: aside ? aside.textContent : (slide.getAttribute("data-notes") || ""),
      session: d.session || "", module: d.module || "", run: d.run || "",
    };
  }
  function inRun(n) { return !RUNS[n.run] || RUNS[n.run].inRun; }
  function cueLine(n) {
    const run = RUNS[n.run] ? RUNS[n.run].label : n.run;
    return [n.session, n.module, run].filter(Boolean).join(" · ");
  }
  function titleOf(slide) {
    const t = slide && slide.querySelector("h1, h2, h3");
    return t ? t.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(s % 60);
  }
  function clamp(v, lo, hi, def) { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; }

  root.RevealPresenter = function () {
    const key = location.pathname;
    const isPresenter = /[?&]presenter(?:[=&]|$)/.test(location.search);
    let deck, slides = [], notes = [], cur = 0;
    let bc = null, peer = null, applying = false, connected = false;
    let drawer, shell, revealEl, ratio = 16 / 9, slideW = 1280, slideH = 720;
    let ov, ovFilled = false;   // the overview panel; its thumbnails are made on first open
    let hud, hudTimer = 0;      // the navigation pill (audience window only)
    const timer = { start: 0, paused: 0, pausedAt: 0 };
    // prev / next: sidebar widths (%); hide: collapsed sidebars; soloRow: slides-row height (px)
    // when both sidebars are hidden, unset for the largest that fits.
    const prefs = { font: FONT.def, prev: SIDE.def, next: SIDE.def, hide: { prev: false, next: false }, soloRow: null };
    const LENGTHS_KEY = NS + ":lengths:" + key;
    let deckLengths = {}, lengths = {};   // session label → minutes: as the deck sets them, and as used here
    const shown = { prev: 0, next: 0, row: 0 };   // px on screen, after applyLayout
    const q = (sel) => shell.querySelector(sel);

    // ── Sync between the two windows ───────────────────────────────
    function connect() {
      try { bc = new BroadcastChannel(NS + ":" + key); bc.onmessage = (e) => receive(e.data); } catch (e) { bc = null; }
      window.addEventListener("message", (e) => {
        if (e.origin !== location.origin && location.protocol !== "file:") return;
        receive(e.data);
      });
      if (isPresenter) peer = window.opener;
    }
    function send(type) {
      const i = deck.getIndices();
      const msg = { ns: NS, deck: key, type, h: i.h, v: i.v, f: i.f, paused: deck.isPaused() };
      if (bc) try { bc.postMessage(msg); } catch (e) { /* channel closed */ }
      if (peer && !peer.closed) try { peer.postMessage(msg, "*"); } catch (e) { /* window gone */ }
    }
    function receive(msg) {
      if (!msg || msg.ns !== NS || msg.deck !== key) return;
      const initial = !connected;
      connected = true;
      if (isPresenter) q(".rp-sync").textContent = "Synced · either window moves both";
      if (msg.type === "hello") { if (!isPresenter) send("state"); return; }
      if (msg.type !== "state" || typeof msg.h !== "number") return;
      const i = deck.getIndices();
      applying = initial ? "initial" : true;   // the first state only lines the windows up; it doesn't start the timer
      try {
        if (i.h !== msg.h || (i.v || 0) !== (msg.v || 0) || i.f !== msg.f) deck.slide(msg.h, msg.v || 0, msg.f);
        if (typeof msg.paused === "boolean" && deck.isPaused() !== msg.paused) deck.togglePause(msg.paused);
      } finally { applying = false; }
    }

    // ── Navigation ─────────────────────────────────────────────────
    function onNav() {
      const i = slides.indexOf(deck.getCurrentSlide());
      const moved = i !== cur;
      cur = Math.max(0, i);
      if (!applying && !deck.isOverview()) send("state");
      if (isPresenter) {
        if (!timer.start && applying !== "initial") timer.start = Date.now();
        render(moved);
      } else { renderDrawer(); renderHud(); }
      if (overviewOpen()) markCurrent();
    }

    // ── Audience window ────────────────────────────────────────────
    function presenterUrl() {
      const u = new URL(location.href);
      u.searchParams.delete("overview");   // the presenter window starts on its slides, not in the overview
      u.hash = "";
      const url = u.href;
      return url + (url.indexOf("?") >= 0 ? "&" : "?") + "presenter" + location.hash;
    }
    function openPresenter() {
      if (!peer || peer.closed) {
        // Reuse a presenter window that survived a reload of this one, so its timer keeps running.
        peer = window.open("", NS + ":" + key, "width=1440,height=900");
        if (!peer) { console.warn("RevealPresenter: the popup was blocked. Allow popups for this page, then press S again."); return; }
        let blank = true;
        try { blank = peer.location.href === "about:blank"; } catch (e) { blank = false; }
        if (blank) peer.location.href = presenterUrl();
      }
      peer.focus();
    }
    function toggleDrawer() {
      document.documentElement.classList.toggle("rp-drawer-on");
      renderDrawer();
      reserveBottom();
    }
    // How much of the viewport's bottom the deck gives up: the drawer's height while it's shown
    // (review mode's panel sets the same property itself and hides the drawer). Reveal re-fits.
    function reserveBottom() {
      if (document.documentElement.classList.contains("rv-on")) return;   // review.js owns it then
      const on = document.documentElement.classList.contains("rp-drawer-on");
      if (on) document.documentElement.style.setProperty("--rp-reserve-bottom", drawer.offsetHeight + "px");
      else document.documentElement.style.removeProperty("--rp-reserve-bottom");
      deck.layout();
    }
    function renderDrawer() {
      if (!document.documentElement.classList.contains("rp-drawer-on")) return;
      const n = notes[cur] || readNote(deck.getCurrentSlide()), cue = cueLine(n);
      drawer.firstChild.textContent = (cur + 1) + " / " + slides.length + (cue ? "  ·  " + cue : "");
      drawer.lastChild.innerHTML = md(n.text);
    }
    function buildAudience() {
      drawer = document.createElement("div");
      drawer.className = "rp-drawer";
      drawer.setAttribute("aria-live", "polite");
      drawer.innerHTML = '<div class="rp-cue-text"></div><div class="rp-md"></div>';
      document.body.appendChild(drawer);
      new ResizeObserver(() => { if (document.documentElement.classList.contains("rp-drawer-on")) reserveBottom(); }).observe(drawer);   // notes change length per slide
      document.addEventListener("rp-reserve-recompute", reserveBottom);   // review mode closed; the drawer's claim applies again
      deck.addKeyBinding({ keyCode: 83, key: "S", description: "Open presenter view" }, openPresenter);
      deck.addKeyBinding({ keyCode: 80, key: "P", description: "Open presenter view" }, openPresenter);
      deck.addKeyBinding({ keyCode: 78, key: "N", description: "Notes drawer (the audience can see it)" }, toggleDrawer);
      buildHud();
    }

    // ── Navigation pill ────────────────────────────────────────────
    function buildHud() {
      hud = document.createElement("nav");
      hud.className = "rp-hud";
      hud.setAttribute("aria-label", "Slide navigation");
      hud.innerHTML = HUD_HTML;
      document.body.appendChild(hud);
      hud.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-hud]");
        if (!btn) return;
        btn.blur();   // so Space and the arrows keep moving slides
        const act = btn.dataset.hud;
        if (act === "prev") deck.prev();
        else if (act === "next") deck.next();
        else if (act === "grid") toggleOverview();
        else if (act === "full") toggleFullscreen();
        else if (act === "help") pinHelp(!hud.hasAttribute("data-help"));
      });
      const keys = deck.getConfig().review ? KEYS.slice(0, 6).concat(REVIEW_KEYS, KEYS.slice(6)) : KEYS;
      hud.querySelector(".rp-hud-help").innerHTML = "<h3>Keys</h3><dl>" + keys.map(([k, d]) => "<dt>" + k + "</dt><dd>" + d + "</dd>").join("") + "</dl>" +
        "<p>Click the i to keep this open.</p>";
      document.addEventListener("click", (e) => { if (hud.hasAttribute("data-help") && !e.target.closest(".rp-hud-info")) pinHelp(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && hud.hasAttribute("data-help")) pinHelp(false); }, true);
      const show = () => {
        document.documentElement.classList.add("rp-hud-on");
        clearTimeout(hudTimer);
        hudTimer = setTimeout(() => document.documentElement.classList.remove("rp-hud-on"), 2500);
      };
      document.addEventListener("mousemove", show);
      document.addEventListener("touchstart", show, { passive: true });
      show();
    }
    function pinHelp(open) {
      hud.toggleAttribute("data-help", open);
      hud.querySelector("button[data-hud=help]").setAttribute("aria-expanded", String(open));
    }
    function toggleFullscreen() {
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    }
    function sectionOf(i) {   // the heading of the nearest section divider at or before slide i, or the opening
      for (let k = i; k >= 0; k--) {
        const g = groupOf(slides[k]);
        if (g) return g.title;
      }
      return slides.some((s) => groupOf(s)) ? OPENING : "";
    }
    function renderHud() {
      if (!hud) return;
      hud.querySelector(".rp-hud-count").innerHTML = pad(cur + 1) + " <span>/ " + slides.length + "</span>";
      hud.querySelector(".rp-hud-name").textContent = sectionOf(cur);
    }

    // ── Presenter window: layout ───────────────────────────────────
    // The sidebar widths are the settings. The current slide fills the width between the
    // sidebars, its height sets the slides row, and the notes get the rest. Only when the
    // window can't fit that row (notes under NOTES_MIN, row under ROW_MIN) is the row clamped,
    // and then the sidebars absorb the difference, so no slide ever has empty space beside it.
    // With both sidebars hidden there is nothing to absorb it, so the row is set directly and
    // the slide is centred in it.
    function contentWidth() { return shell.clientWidth - 2 * GUTTER; }
    function shownSides() { return ["prev", "next"].filter((s) => !prefs.hide[s]); }
    function panesWidth(W) { return W - GUTTER * shownSides().length; }   // the shown panes, without their gutters
    function rowRoom() { return shell.clientHeight - TOP_H - STATUS_H - 3 * GUTTER - NOTES_MIN; }   // tallest slides row

    function applyLayout() {
      const W = contentWidth(), panes = panesWidth(W), sides = shownSides();
      const width = { prev: 0, next: 0 };
      sides.forEach((s) => { width[s] = (prefs[s] / 100) * W; });
      const total = width.prev + width.next;
      const wanted = sides.length ? (panes - total) / ratio : Math.min(prefs.soloRow || Infinity, panes / ratio);
      const row = Math.max(ROW_MIN, Math.min(rowRoom(), wanted));
      const spare = sides.length ? panes - total - row * ratio : 0;   // non-zero only where the row was clamped
      sides.forEach((s) => { width[s] += (spare * width[s]) / total; });
      Object.assign(shown, { prev: width.prev, next: width.next, row });
      ["prev", "next"].forEach((s) => {
        shell.style.setProperty(`--rp-${s}-w`, width[s] + "px");
        shell.style.setProperty(`--rp-${s}-g`, (prefs.hide[s] ? 0 : GUTTER) + "px");
        shell.toggleAttribute("data-hide-" + s, prefs.hide[s]);
        q(`[data-rp=${s}]`).setAttribute("aria-pressed", String(!prefs.hide[s]));
        q(`[data-split=${s}]`).setAttribute("aria-valuenow", Math.round(prefs[s]));
      });
      shell.style.setProperty("--rp-row", row + "px");
      q("[data-split=row]").setAttribute("aria-valuenow", Math.round((row / (rowRoom() + NOTES_MIN)) * 100));
      relayout();
      fitThumbs();
    }
    function toggleSide(side) {
      prefs.hide[side] = !prefs.hide[side];
      applyLayout();
      savePrefs();
    }
    // Resize one sidebar, leaving the other where it is. The current slide takes up the change,
    // so the border stops where the slides row would get too tall or too short for the window.
    function resizeSide(name, px) {
      const W = contentWidth(), panes = panesWidth(W), other = name === "prev" ? "next" : "prev";
      const lo = Math.max((SIDE.min / 100) * W, panes - shown[other] - rowRoom() * ratio);
      const hi = Math.min((SIDE.max / 100) * W, panes - shown[other] - ROW_MIN * ratio);
      prefs[name] = (Math.min(Math.max(px, lo), Math.max(lo, hi)) / W) * 100;
      prefs[other] = (shown[other] / W) * 100;   // store what's on screen, so the other border stays put
      applyLayout();
    }
    // Resize the slides row, and with it the current slide. The shown sidebars split the width
    // the slide gives up or takes in their current proportion, within their own limits.
    function resizeRow(px) {
      const W = contentWidth(), panes = panesWidth(W), sides = shownSides();
      if (!sides.length) { prefs.soloRow = px; applyLayout(); return; }
      const total = sides.reduce((t, s) => t + shown[s], 0), shares = sides.map((s) => shown[s] / total);
      const lo = Math.max(ROW_MIN, (panes - ((SIDE.max / 100) * W) / Math.max(...shares)) / ratio);
      const hi = Math.min(rowRoom(), (panes - ((SIDE.min / 100) * W) / Math.min(...shares)) / ratio);
      const width = panes - Math.min(Math.max(px, lo), Math.max(lo, hi)) * ratio;
      sides.forEach((s, i) => { prefs[s] = ((width * shares[i]) / W) * 100; });
      applyLayout();
    }
    function resetSplit(name) {
      if (name !== "row") resizeSide(name, (SIDE.def / 100) * contentWidth());
      else if (shownSides().length) { prefs.prev = prefs.next = SIDE.def; applyLayout(); }
      else { prefs.soloRow = null; applyLayout(); }
    }

    function loadPrefs() {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { /* storage blocked */ }
      prefs.prev = clamp(saved.prev, SIDE.min, SIDE.max, SIDE.def);
      prefs.next = clamp(saved.next, SIDE.min, SIDE.max, SIDE.def);
      prefs.hide = { prev: !!(saved.hide && saved.hide.prev), next: !!(saved.hide && saved.hide.next) };
      prefs.soloRow = Number(saved.soloRow) > 0 ? Number(saved.soloRow) : null;
      setFont(saved.font);
    }
    function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } }
    function setFont(v) {
      prefs.font = clamp(v, FONT.min, FONT.max, FONT.def);
      shell.style.setProperty("--rp-font", prefs.font + "px");
    }

    // Pointer position → the sidebar width or row height that puts the border under it.
    function pointerTarget(name, e) {
      if (name === "row") return e.clientY - q(".rp-current").getBoundingClientRect().top - GUTTER / 2;
      const left = shell.getBoundingClientRect().left + GUTTER;
      return name === "prev" ? e.clientX - left - GUTTER / 2 : left + contentWidth() - e.clientX - GUTTER / 2;
    }
    function resizeTo(name, px) { if (name === "row") resizeRow(px); else resizeSide(name, px); }
    function wireSplit(name) {
      const handle = q(`[data-split=${name}]`), html = document.documentElement;
      const resizing = name === "row" ? "rp-resizing-y" : "rp-resizing-x";
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        handle.classList.add("rp-active");
        html.classList.add(resizing);
        const move = (ev) => resizeTo(name, pointerTarget(name, ev));
        const end = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", end);
          handle.classList.remove("rp-active");
          html.classList.remove(resizing);
          savePrefs();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      });
      handle.addEventListener("dblclick", () => { resetSplit(name); savePrefs(); });
      handle.addEventListener("keydown", (e) => {
        const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        e.stopPropagation();   // keep Reveal from changing slides
        // Arrows move the border; the next sidebar sits right of its border, so it narrows as the border moves right.
        if (name === "row") resizeRow(shown.row + 12 * dir);
        else resizeSide(name, shown[name] + 0.01 * contentWidth() * dir * (name === "next" ? -1 : 1));
        savePrefs();
      });
    }

    // Fit the live deck to the current-slide pane, sitting right on the border above the notes.
    function relayout() {
      const box = q(".rp-current").getBoundingClientRect();
      const w = Math.max(0, Math.min(box.width, box.height * ratio)), h = w / ratio;
      Object.assign(revealEl.style, {
        position: "fixed", zIndex: "2", left: box.left + (box.width - w) / 2 + "px", top: box.bottom - h + "px",
        width: w + "px", height: h + "px",
      });
      if (deck.isReady()) deck.layout();
    }
    // A thumbnail the row is too short for shrinks toward the current slide, keeping the gutter between them.
    function fitThumbs() {
      shell.querySelectorAll(".rp-thumb > .rp-preview").forEach((frame) => {
        const box = frame.parentNode, w = Math.max(0, Math.min(box.clientWidth, box.clientHeight * ratio));
        const left = frame.closest(".rp-side-prev") ? box.clientWidth - w : 0;
        Object.assign(frame.style, { left: left + "px", width: w + "px", height: w / ratio + "px" });
        scaleCopy(frame, w);
      });
    }

    function buildShell() {
      document.documentElement.classList.add("rp-presenter");
      shell = document.createElement("div");
      shell.className = "rp-shell";
      shell.innerHTML = SHELL_HTML;
      document.body.appendChild(shell);
      revealEl.classList.add("rp-main");
      shell.style.setProperty("--rp-ratio", slideW + " / " + slideH);
      loadPrefs();
      ["prev", "next", "row"].forEach(wireSplit);
      new ResizeObserver(applyLayout).observe(shell);   // window resizes
      applyLayout();   // size the pane before Reveal's first layout
    }

    // ── Presenter window: pacing ───────────────────────────────────
    // Session lengths come from the deck; one edited here wins until the deck's own length
    // for that session changes, so a rebuilt deck never loses to a stale edit.
    function savedLengths() {
      try { return JSON.parse(localStorage.getItem(LENGTHS_KEY)) || {}; } catch (e) { return {}; }
    }
    function loadLengths() {
      deckLengths = Object.assign({}, (deck.getConfig().presenter || {}).sessions);
      lengths = Object.assign({}, deckLengths);
      const saved = savedLengths();
      Object.keys(saved).forEach((s) => { if (saved[s].deck === (deckLengths[s] ?? null)) lengths[s] = saved[s].minutes; });
    }
    function setLength(session, minutes) {
      const saved = savedLengths();
      minutes = Math.round(minutes);
      if (minutes > 0 && minutes !== deckLengths[session]) {
        lengths[session] = minutes;
        saved[session] = { deck: deckLengths[session] ?? null, minutes };
      } else {   // cleared, or set back to the deck's length
        lengths[session] = deckLengths[session];
        delete saved[session];
      }
      try { localStorage.setItem(LENGTHS_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ }
    }
    function perSlide(session) {   // minutes per in-run slide, or 0 without a length
      const count = notes.filter((n) => n.session === session && inRun(n)).length;
      return lengths[session] > 0 && count ? lengths[session] / count : 0;
    }
    function planned(i) {
      let passed = 0;
      for (let k = i - 1; k >= 0 && notes[k].session === notes[i].session; k--) if (inRun(notes[k])) passed++;
      return passed * perSlide(notes[i].session);
    }
    function renderSession() {
      const session = notes[cur].session, each = perSlide(session), input = q(".rp-length");
      q(".rp-session-name").textContent = session;
      if (document.activeElement !== input) input.value = lengths[session] > 0 ? lengths[session] : "";
      q(".rp-each").textContent = each ? "· " + fmt(each * 60000) + " per slide" : "· enter a length to pace";
    }

    // ── Presenter window: content ──────────────────────────────────
    function elapsed() { return timer.start ? (timer.pausedAt || Date.now()) - timer.start - timer.paused : 0; }
    function tick() {
      q(".rp-timer").textContent = fmt(elapsed());
      q(".rp-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const pace = q(".rp-pace"), plan = planned(cur);
      pace.className = "rp-pace";
      if (!timer.start) { pace.textContent = "Timer starts on the first move"; return; }
      if (!perSlide(notes[cur].session)) { pace.textContent = ""; return; }
      const d = Math.round(elapsed() / 60000 - plan);
      pace.textContent = "Plan " + Math.round(plan) + " min · " + (d === 0 ? "on pace" : Math.abs(d) + " min " + (d > 0 ? "behind" : "ahead"));
      if (d > 1) pace.classList.add("rp-behind");
      else if (d < -1) pace.classList.add("rp-ahead");
    }
    function remainingSteps() {
      const hidden = slides[cur] ? slides[cur].querySelectorAll(".fragment:not(.visible)") : [];
      return new Set(Array.from(hidden, (f) => f.getAttribute("data-fragment-index"))).size;
    }

    // A fully built copy of a slide, with the same structure as the live deck
    // (.reveal > .backgrounds + .slides > section) so the theme CSS applies.
    function slideCopy(slide) {
      const frame = document.createElement("div");
      frame.className = "reveal rp-preview";
      frame.setAttribute("aria-hidden", "true");
      frame.inert = true;
      frame.innerHTML = '<div class="backgrounds"></div><div class="slides"></div>';
      const bg = deck.getSlideBackground(slide);
      if (bg) frame.firstChild.appendChild(showCopy(bg.cloneNode(true), "block"));
      const copy = showCopy(slide.cloneNode(true), deck.getConfig().display || "block");
      copy.querySelectorAll(".fragment").forEach((f) => { f.classList.add("visible"); f.classList.remove("current-fragment"); });
      copy.querySelectorAll("[autoplay]").forEach((m) => m.removeAttribute("autoplay"));
      const slidesEl = frame.lastChild;
      Object.assign(slidesEl.style, { width: slideW + "px", height: slideH + "px", left: "50%", top: "50%", right: "auto", bottom: "auto" });
      slidesEl.appendChild(copy);
      return frame;
    }
    function showCopy(node, display) {
      node.classList.remove("past", "future");
      node.classList.add("present");
      node.removeAttribute("hidden");
      Object.assign(node.style, { display, transition: "none" });
      return node;
    }
    // Scale a copy's slide to a frame w px wide; the copy's .slides sits centred in the frame.
    // The copy is also re-centred from its own height: Reveal sets each live slide's inline
    // `top` when it lays the slide out, and a slide it hasn't shown yet (display: none, beyond
    // the view distance) keeps a stale value, typically half the slide height, which the clone
    // would inherit and show as content shifted down. scrollHeight ignores the scale transform.
    function scaleCopy(frame, w) {
      frame.querySelector(".slides").style.transform = "translate(-50%, -50%) scale(" + w / slideW + ")";
      const sec = frame.querySelector(".slides > section");
      if (sec && sec.offsetParent !== null) sec.style.top = Math.max((slideH - sec.scrollHeight) / 2, 0) + "px";
    }

    // ── Overview: every slide as a thumbnail, grouped by section ───
    // A section-divider slide starts a group, headed by its kicker and title. Slides before
    // the first divider are the opening; a deck with no dividers is one grid. Thumbnails are
    // the same fully built copies the presenter's sidebars use, sized by the grid.
    function overviewOpen() { return document.documentElement.classList.contains("rp-ov-on"); }
    function captionOf(slide) {   // the heading, else the most title-like text a layout has
      for (const sel of ["h1, h2, h3", ".label", "blockquote", ".caption", ".figure"]) {
        const el = slide.querySelector(sel);
        if (el) return el.textContent.replace(/\s+/g, " ").trim();
      }
      return "";
    }
    function groupOf(slide) {
      if (!slide.classList.contains("layout-section")) return null;
      const kick = slide.querySelector(".kicker");
      return { kicker: kick ? kick.textContent.trim() : "", title: titleOf(slide) || "Section" };
    }
    function buildOverview() {
      ov = document.createElement("div");
      ov.className = "rp-ov";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-modal", "true");
      ov.setAttribute("aria-label", "Slide overview");
      ov.style.setProperty("--rp-ratio", slideW + " / " + slideH);
      ov.innerHTML = '<div class="rp-ov-head"><div><h1 class="rp-ov-title"></h1><p class="rp-ov-sub"></p></div>' +
        '<button type="button" class="rp-ov-close" title="Close the overview (Esc)">Close</button></div><div class="rp-ov-body"></div>';
      // Lanes: the deck built in several variants; the switcher opens the same slide in another one.
      const lanes = ((deck.getConfig().presenter || {}).lanes || []).filter((l) => l && l.name && l.file);
      if (lanes.length > 1) {
        const label = document.createElement("label");
        label.className = "rp-ov-lane";
        label.innerHTML = '<span>Lane</span><select aria-label="Lane"></select>';
        const select = label.lastChild, current = lanes.find((l) => l.current);
        const swatch = document.createElement("span");
        swatch.className = "rp-ov-swatch";
        swatch.title = current && current.color ? "This lane's colour" : "The base deck";
        if (current && current.color) swatch.style.setProperty("--rp-lane", current.color);
        label.insertBefore(swatch, select);
        lanes.forEach((l) => {
          const opt = document.createElement("option");
          opt.value = l.file;
          opt.textContent = l.name;
          opt.selected = !!l.current;
          if (l.color) opt.style.color = l.color;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => { location.href = select.value + location.hash; });
        ov.firstChild.insertBefore(label, ov.querySelector(".rp-ov-close"));
      }
      ov.addEventListener("click", (e) => {
        const tool = e.target.closest("button[data-ov]");
        if (tool) { structural(tool.dataset.ov, tool.closest(".rp-ov-cell").dataset.key); return; }
        const th = e.target.closest(".rp-ov-th");
        if (th) { if (+th.dataset.i >= 0) { closeOverview(); goTo(slides[+th.dataset.i]); } }
        else if (e.target.closest(".rp-ov-rebuild")) { if (root.RevealReviewAPI) root.RevealReviewAPI.rebuild(); }
        else if (e.target.closest(".rp-ov-close")) closeOverview();
      });
      // Drag and drop between thumbnails: dropping on the left half of a thumbnail puts the
      // dragged slide before it, on the right half after it. Pending until the rebuild.
      let dragKey = null;
      const clearDrop = () => ov.querySelectorAll(".rp-drop-before, .rp-drop-after").forEach((c) => c.classList.remove("rp-drop-before", "rp-drop-after"));
      ov.addEventListener("dragstart", (e) => {
        const cell = e.target.closest && e.target.closest(".rp-ov-cell[draggable]");
        if (!cell) return;
        dragKey = cell.dataset.key;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragKey);
        cell.classList.add("rp-dragging");
      });
      ov.addEventListener("dragover", (e) => {
        const cell = e.target.closest && e.target.closest(".rp-ov-cell");
        if (!dragKey || !cell || cell.dataset.key === dragKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const r = cell.getBoundingClientRect(), before = e.clientX < r.left + r.width / 2;
        clearDrop();
        cell.classList.add(before ? "rp-drop-before" : "rp-drop-after");
      });
      ov.addEventListener("drop", (e) => {
        const cell = e.target.closest && e.target.closest(".rp-ov-cell");
        if (!dragKey || !cell || cell.dataset.key === dragKey) return;
        e.preventDefault();
        const before = cell.classList.contains("rp-drop-before"), key = dragKey;
        moveSlide(key, cell.dataset.key, before);
      });
      ov.addEventListener("dragend", () => { dragKey = null; clearDrop(); ov.querySelectorAll(".rp-dragging").forEach((c) => c.classList.remove("rp-dragging")); });
      new ResizeObserver(scaleOverview).observe(ov);   // window resizes, and the first display
      document.addEventListener("rp-review-change", () => { if (overviewOpen()) refillOverview(null); });   // review.js restored or dropped its edits
      document.body.appendChild(ov);
    }
    // ── Structural edits in the overview (review mode only) ──
    function moveSlide(key, targetKey, before) {
      const api = root.RevealReviewAPI;
      if (!api) return;
      const keys = api.slides().map((s) => s.key).filter((k) => k !== key);
      const at = keys.indexOf(targetKey);
      if (at < 0) return;
      keys.splice(before ? at : at + 1, 0, key);
      api.reorder(keys);
      refillOverview(key);
    }
    function structural(act, key) {
      const api = root.RevealReviewAPI;
      if (!api || !key) return;
      const s = api.slides().find((x) => x.key === key);
      if (!s) return;
      if (act === "hide") { if (api.setHidden(key, !s.hidden) === false) return; }
      else if (act === "delete") { if (api.setDeleted(key, true) === false) return; }
      else if (act === "undo") api.setDeleted(key, false);
      else if (act === "earlier" || act === "later") {
        const keys = api.slides().map((x) => x.key), i = keys.indexOf(key), j = act === "earlier" ? i - 1 : i + 1;
        if (j < 0 || j >= keys.length) return;
        [keys[i], keys[j]] = [keys[j], keys[i]];
        api.reorder(keys);
      } else return;
      refillOverview(key);
    }
    function refillOverview(focusKey) {
      ovFilled = false;
      fillOverview();
      markCurrent();
      scaleOverview();
      const th = focusKey && ov.querySelector(`.rp-ov-cell[data-key="${root.CSS.escape(focusKey)}"] .rp-ov-th`);   // root.CSS: the stylesheet string above is named CSS too
      if (th) th.focus({ preventScroll: false });
    }
    function fillOverview() {
      const api = root.RevealReviewAPI, body = ov.querySelector(".rp-ov-body");
      body.innerHTML = "";
      // With review mode, every slide as built (hidden ones included) in the pending order;
      // otherwise the live slides. `i` is the live index, -1 for a slide Reveal dropped.
      const list = api ? api.slides().map((s) => ({ ...s, i: slides.indexOf(s.el) })) : slides.map((el, i) => ({ key: null, el, i, hidden: false, deleted: false }));
      const hasSections = list.some((s) => !s.deleted && s.el.classList.contains("layout-section"));
      const lanesCfg = ((deck.getConfig().presenter || {}).lanes || []).filter((l) => l && l.file);
      const currentLane = lanesCfg.find((l) => l.current);
      const laneColor = lanesCfg.length > 1 ? (currentLane && currentLane.color) || null : undefined;   // undefined: no lanes, no bars
      let grid = null, groups = 0, n = 0;
      list.forEach((s) => {
        const slide = s.el, g = s.deleted ? null : groupOf(slide);
        if (g || !grid) {
          const head = g || (hasSections ? { kicker: "", title: OPENING } : null);
          if (head) {
            groups += g ? 1 : 0;
            const h = document.createElement("h2");
            h.className = "rp-ov-grp";
            h.innerHTML = (head.kicker ? '<span class="rp-ov-kick"></span>' : "") + '<span class="rp-ov-grp-title"></span><span class="rp-ov-count"></span>';
            if (head.kicker) h.firstChild.textContent = head.kicker;
            h.querySelector(".rp-ov-grp-title").textContent = head.title;
            body.appendChild(h);
          }
          grid = document.createElement("div");
          grid.className = "rp-ov-grid";
          body.appendChild(grid);
        }
        const caption = captionOf(slide), num = s.deleted || s.hidden ? "" : pad(++n);
        const cell = document.createElement("div"), th = document.createElement("div");
        cell.className = "rp-ov-cell" + (s.hidden ? " rp-hidden" : "") + (s.deleted ? " rp-deleted" : "");
        if (s.key) cell.dataset.key = s.key;
        if (laneColor !== undefined) {   // a deck with lanes: ink for the base deck's slide, the lane's colour for one it changes
          cell.classList.add("rp-laned");
          if (laneColor && slide.hasAttribute("data-lane-changed")) cell.style.setProperty("--rp-lane", laneColor);
        }
        th.className = "rp-ov-th";
        th.setAttribute("role", "button");
        th.tabIndex = 0;
        th.dataset.i = s.i;
        th.setAttribute("aria-label", (s.i >= 0 ? "Go to slide " + (s.i + 1) : "Slide not in this build") + (caption ? ": " + caption : "") +
          (s.hidden ? " (hidden)" : "") + (s.deleted ? " (deleted)" : ""));
        th.innerHTML = '<div class="rp-ov-box"></div><div class="rp-ov-cap"><b></b><span></span></div>';
        th.querySelector(".rp-ov-cap b").textContent = num || "·";
        th.querySelector(".rp-ov-cap span").textContent = caption;
        th.querySelector(".rp-ov-box").appendChild(slideCopy(slide));
        cell.appendChild(th);
        if (api) {
          const mask = document.createElement("div");
          mask.className = "rp-ov-mask";
          mask.innerHTML = EYE_OFF;
          th.querySelector(".rp-ov-box").appendChild(mask);
          const lane = api.lane() ? " in this lane" : "";
          const tools = document.createElement("div");
          tools.className = "rp-ov-tools";
          tools.innerHTML = s.deleted
            ? '<button type="button" data-ov="undo" title="Bring the slide back">Undo</button>'
            : `<button type="button" data-ov="hide" title="${s.hidden ? "Show the slide" + lane : "Hide the slide" + lane} (H)" aria-label="${s.hidden ? "Show" : "Hide"}">${s.hidden ? EYE_ON : EYE_OFF}</button>` +
              '<button type="button" data-ov="delete" title="Delete the slide (Delete)" aria-label="Delete">' + CROSS + "</button>";
          cell.appendChild(tools);
          cell.draggable = true;
        }
        grid.appendChild(cell);
      });
      body.querySelectorAll(".rp-ov-grp").forEach((h) => {
        const k = h.nextElementSibling.querySelectorAll(".rp-ov-cell:not(.rp-deleted):not(.rp-hidden)").length;
        h.querySelector(".rp-ov-count").textContent = k + (k === 1 ? " slide" : " slides");
      });
      ov.querySelector(".rp-ov-title").textContent = titleOf(slides[0]) || document.title.replace(/^Presenter · /, "");
      ov.querySelector(".rp-ov-sub").textContent = n + " slides" + (groups ? " in " + groups + (groups === 1 ? " section" : " sections") : "") +
        ". Click a slide to go to it; Esc closes." + (api ? " Drag to reorder; the eye hides, the X deletes; changes apply at the next rebuild." : "");
      if (api && !ov.querySelector(".rp-ov-rebuild")) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rp-ov-close rp-ov-rebuild";
        b.title = "Save the edits, rebuild the deck and reload (Shift+B)";
        b.textContent = "Rebuild deck";
        ov.firstChild.insertBefore(b, ov.querySelector(".rp-ov-close"));
      }
      ovFilled = true;
    }
    function scaleOverview() {
      if (!overviewOpen()) return;
      ov.querySelectorAll(".rp-ov-box > .rp-preview").forEach((frame) => scaleCopy(frame, frame.parentNode.clientWidth));
    }
    function markCurrent() {
      ov.querySelectorAll(".rp-ov-th").forEach((t) => t.classList.toggle("rp-cur", +t.dataset.i === cur));
    }
    function goTo(slide) {
      const i = deck.getIndices(slide);
      deck.slide(i.h, i.v);
    }
    function openOverview() {
      if (overviewOpen()) return;
      if (!ovFilled || root.RevealReviewAPI) fillOverview();   // with review mode, the pending state may have changed
      document.documentElement.classList.add("rp-ov-on");
      [revealEl, drawer, shell].forEach((el) => { if (el) el.inert = true; });   // the deck behind it takes no clicks or focus
      markCurrent();
      scaleOverview();
      document.addEventListener("keydown", onOverviewKey, true);
      const at = ov.querySelector(".rp-ov-th.rp-cur");
      if (at) { at.scrollIntoView({ block: "center" }); at.focus({ preventScroll: true }); }
    }
    function closeOverview() {
      if (!overviewOpen()) return;
      document.documentElement.classList.remove("rp-ov-on");
      [revealEl, drawer, shell].forEach((el) => { if (el) el.inert = false; });
      document.removeEventListener("keydown", onOverviewKey, true);
      if (document.activeElement && ov.contains(document.activeElement)) document.activeElement.blur();
    }
    function toggleOverview() { if (overviewOpen()) closeOverview(); else openOverview(); }
    // While the overview is open, keys belong to it: Reveal (listening on document, bubbling)
    // and the presenter's own keys don't see them. Tab, Enter and Space keep their defaults.
    function onOverviewKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "o" || e.key === "O") { e.preventDefault(); closeOverview(); return; }
      if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // the lane switcher keeps its own keys
      const ths = Array.from(ov.querySelectorAll(".rp-ov-th")), at = ths.indexOf(document.activeElement);
      if (at >= 0 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ths[at].click(); return; }
      if (at >= 0 && root.RevealReviewAPI) {   // structural edits on the focused thumbnail
        const cell = ths[at].closest(".rp-ov-cell"), key = cell && cell.dataset.key;
        const act = e.key === "h" || e.key === "H" ? "hide" : e.key === "Delete" || e.key === "Backspace" ? (cell.classList.contains("rp-deleted") ? "undo" : "delete")
          : e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowUp") ? "earlier" : e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowDown") ? "later" : null;
        if (act) { e.preventDefault(); structural(act, key); return; }
      }
      let step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      if (at < 0) { if (ths.length) ths[0].focus(); return; }
      if (step === 0) {   // up or down a row: the columns per grid are the thumbnails sharing the focused one's top edge
        const row = ths.filter((t) => t.closest(".rp-ov-grid") === ths[at].closest(".rp-ov-grid") && t.closest(".rp-ov-cell").offsetTop === ths[at].closest(".rp-ov-cell").offsetTop).length;
        step = e.key === "ArrowDown" ? row : -row;
      }
      const next = ths[Math.min(ths.length - 1, Math.max(0, at + step))];
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest" });
    }
    function renderSide(side, i, emptyText) {
      const pane = q(".rp-side-" + side), box = pane.querySelector(".rp-thumb"), slide = slides[i];
      pane.querySelector(".rp-side-num").textContent = slide ? pad(i + 1) + " / " + slides.length : "";
      pane.querySelector(".rp-side-title").textContent = titleOf(slide);
      box.textContent = "";
      if (slide) box.appendChild(slideCopy(slide));
      else box.innerHTML = `<div class="rp-end" style="--chars: ${emptyText.length}">${emptyText}</div>`;
    }
    function render(moved) {
      const n = notes[cur];
      q(".rp-count").textContent = pad(cur + 1) + " / " + slides.length;
      if (moved) {
        const el = q(".rp-notes");
        el.innerHTML = md(n.text);
        el.scrollTop = 0;
        renderSide("prev", cur - 1, "START");
        renderSide("next", cur + 1, "END");
        fitThumbs();
      }
      const steps = remainingSteps();
      q(".rp-steps").textContent = steps ? steps + (steps === 1 ? " more build" : " more builds") + " on this slide first" : "";
      renderSession();
      tick();
    }
    function startPresenter() {
      document.title = "Presenter · " + document.title;
      q(".rp-title").textContent = titleOf(slides[0]) || document.title.replace(/^Presenter · /, "");
      q(".rp-sync").textContent = bc || peer ? "Waiting for the audience window (press S there)" : "Not synced";
      const pauseBtn = q("[data-rp=pause]");
      shell.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-rp]");
        if (!btn) return;
        btn.blur();   // so Space keeps advancing slides instead of pressing the button again
        const act = btn.dataset.rp;
        if (act === "pause" && timer.start) {
          if (timer.pausedAt) { timer.paused += Date.now() - timer.pausedAt; timer.pausedAt = 0; pauseBtn.textContent = "Pause"; }
          else { timer.pausedAt = Date.now(); pauseBtn.textContent = "Resume"; }
        } else if (act === "reset") {
          Object.assign(timer, { start: Date.now(), paused: 0, pausedAt: 0 });
          pauseBtn.textContent = "Pause";
        } else if (act === "smaller" || act === "larger") {
          setFont(prefs.font + (act === "larger" ? FONT.step : -FONT.step));
          savePrefs();
        } else if (act === "prev" || act === "next") toggleSide(act);
        tick();
      });
      const lengthInput = q(".rp-length");
      lengthInput.addEventListener("change", () => { setLength(notes[cur].session, Number(lengthInput.value)); renderSession(); tick(); });
      lengthInput.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") lengthInput.blur(); });
      document.addEventListener("keydown", (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;   // leave browser zoom alone
        if (e.target === lengthInput) return;             // typing a length, not resizing notes
        if (e.key === "+" || e.key === "=") setFont(prefs.font + FONT.step);
        else if (e.key === "-" || e.key === "_") setFont(prefs.font - FONT.step);
        else if (e.key === "[") toggleSide("prev");
        else if (e.key === "]") toggleSide("next");
        else return;
        savePrefs();
      });
      setInterval(tick, 1000);
      loadLengths();
      relayout();
      render(true);
      send("hello");   // ask the audience window where it is
    }

    // ── Plugin entry point ─────────────────────────────────────────
    function onReady() {
      // Reveal drops data-visibility="hidden" slides during start-up, so read the slides now.
      slides = Array.from(deck.getSlidesElement().querySelectorAll("section")).filter((s) => !s.querySelector("section"));
      notes = slides.map(readNote);
      cur = Math.max(0, slides.indexOf(deck.getCurrentSlide()));
      ["slidechanged", "fragmentshown", "fragmenthidden", "overviewhidden"].forEach((ev) => deck.on(ev, onNav));
      ["paused", "resumed"].forEach((ev) => deck.on(ev, () => { if (!applying) send("state"); }));
      if (isPresenter) startPresenter(); else renderHud();
      if (/[?&]overview(?:[=&]|$)/.test(location.search)) openOverview();
    }

    function init(reveal) {
      deck = reveal;
      if (/print-pdf/i.test(location.search)) return;
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
      const cfg = deck.getConfig();
      slideW = Number(cfg.width) || 1280;
      slideH = Number(cfg.height) || 720;
      ratio = slideW / slideH;
      revealEl = deck.getRevealElement();
      if (isPresenter) {
        deck.configure(PRESENTER_CONFIG);   // before Reveal is ready, this only updates the config it starts with
        buildShell();
      } else buildAudience();
      deck.configure({ overview: false });   // Reveal's zoomed-out overview gives way to the section overview
      buildOverview();
      deck.addKeyBinding({ keyCode: 79, key: "O", description: "Slide overview, by section" }, toggleOverview);
      connect();
      if (deck.isReady()) onReady(); else deck.on("ready", onReady);
    }

    return { id: "presenter", init };
  };
})(window);
