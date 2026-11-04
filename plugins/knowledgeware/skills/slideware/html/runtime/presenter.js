// presenter.js — presenter view, section overview, rehearsal notes drawer and navigation pill
// for slideware decks. Runs on the slideware runtime (deck.js, window.SW); the engine inlines it
// after deck.js in <script id="sw-runtime">.
//
// Keys are capital letters (Shift, or Caps Lock); the lowercase letter does nothing.
//
// Audience window (the deck itself):
//   P   open the presenter view in a second window; the windows stay in sync (BroadcastChannel
//       plus window.postMessage, so it works from file:// too). Builds play only while a
//       presenter window is connected; on its own, or while editing, the deck shows every
//       slide complete.
//   N   toggle a notes drawer along the bottom, for rehearsal; drag its top edge to resize (anyone who can see the screen
//       can read it). The deck re-fits above it (--sw-reserve-bottom on <html>).
//   O   the overview: every slide as a thumbnail, grouped by section dividers (a section with
//       data-divider, or the older class layout-section; its kicker is the element with class
//       kicker). Click to go, arrows to move, Esc or O to close. ?overview starts in it. With
//       lanes (settings lanes: [{ id, name, file, color }]), a switcher opens the same slide in
//       another lane and each thumbnail carries the lane's colour where the lane changes it
//       (data-lane-changed). While the editor is on (window.SWEditor), the overview edits the
//       deck's structure: hide, delete, drag to reorder; H, Del, Shift+arrows on a thumbnail.
//   Navigation pill: previous, slide number, next, section name, overview, fullscreen, and an i
//       listing every key. Shown for 2.5 s after the mouse moves, or on hover.
//
// Presenter window (the deck opened with ?presenter): previous | current | next slides across
// the top, notes below, a header with the slide number, the session length (editable, remembered
// per browser), time per slide, a pace line, the timer and the clock. Borders drag to resize
// (double-click resets); [ and ] hide the sidebars; + and - size the notes text.
//
// Pacing: deck settings sessions: { "Session 1": 60 } ("" is the session of unlabelled slides).
// Each in-run slide gets an equal share of its session's length.
//
// Notes: <aside class="notes"> in each slide, plain text (blank lines split paragraphs, "- "
// lines form a list, **bold**, *italic*, [pause]). The cue lives on the section:
//   data-session  e.g. "Session 1"; slides with the same label share a length
//   data-module   shown in the cue line
//   data-run      default | cut-first | add-back | backup (only default and cut-first are in the run)
(function () {
  "use strict";
  const SW = window.SW;
  if (!SW) return;
  const doc = document, html = doc.documentElement;

  const NS = "slideware-presenter";
  const PREFS_KEY = NS + ":prefs";
  const RUNS = {
    "default":   { label: "Default run", inRun: true },
    "cut-first": { label: "Default run · cut first if behind", inRun: true },
    "add-back":  { label: "Add-back · use if ahead", inRun: false },
    "backup":    { label: "Backup slide", inRun: false },
  };
  const GUTTER = 8, TOP_H = 56, STATUS_H = 24;
  const SIDE = { def: 18, min: 10, max: 30 };
  const ROW_MIN = 160, NOTES_MIN = 120;
  const FONT = { def: 20, min: 14, max: 34, step: 2 };
  const W = SW.width, H = SW.height, ratio = W / H;

  const MONO = "var(--font-mono, ui-monospace, Menlo, monospace)";
  const SANS = "var(--font-sans, system-ui, sans-serif)";
  const ACCENT = "var(--color-accent, #3B5249)";
  const CSS = `
.rp-drawer { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; max-height: var(--rp-drawer-h, 38vh); overflow-y: auto; box-sizing: border-box;
  padding: 16px 28px 22px; background: rgba(250,250,249,.97); border-top: 1px solid #E3E3DF;
  box-shadow: 0 -8px 24px rgba(26,26,24,.10); color: #1A1A18; font-family: ${SANS}; line-height: 1.55; text-align: left; }
html.rp-drawer-on .rp-drawer { display: block; padding-bottom: 64px; }
html.rp-drawer-sized .rp-drawer { height: var(--rp-drawer-h); }
.rp-drawer-grip { position: fixed; left: 0; right: 0; z-index: 41; height: 10px; margin-top: -5px; cursor: ns-resize; display: none; }
html.rp-drawer-on .rp-drawer-grip { display: block; }
.rp-drawer-grip::after { content: ""; position: absolute; left: 50%; top: 3px; width: 44px; height: 4px; margin-left: -22px; border-radius: 2px; background: #C9C9C3; }
.rp-drawer-grip:hover::after, .rp-drawer-grip.rp-dragging::after { background: ${ACCENT}; }
.rp-cue-text { font-family: ${MONO}; font-size: 11px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rp-drawer .rp-md { margin-top: 8px; font-size: 18px; max-width: 1100px; }
.rp-md p { margin: 0 0 .8em; }
.rp-md ul { margin: 0 0 .8em 1.1em; padding: 0; }
.rp-md b { font-weight: 700; }
.rp-empty { color: #6B6B63; font-style: italic; }
.rp-pause { display: inline-block; padding: 1px 7px; border: 1px solid #E8B892; border-radius: 6px; background: #FAEEE4; color: #A85C32;
  font-family: ${MONO}; font-size: .62em; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; vertical-align: .15em; }

/* Slide copies (sidebars and overview thumbnails): a 1280×720 stage scaled into a frame. */
.rp-preview { position: absolute; overflow: hidden; background: var(--color-bg, #FFFFFF); }
.rp-copy-stage { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
.rp-copy-stage [data-a] { animation: none !important; }

.rp-shell { display: none; }
html.rp-presenter body { background: #F4F4F2; }
html.rp-presenter #sw-slides > section { transition: none !important; }
html.rp-presenter #sw-slides [data-a] { animation: none !important; }
html.rp-presenter .rp-shell { position: fixed; inset: 0; z-index: 1; display: grid;
  grid-template-columns: var(--rp-prev-w, ${SIDE.def}%) var(--rp-prev-g, ${GUTTER}px) minmax(0, 1fr) var(--rp-next-g, ${GUTTER}px) var(--rp-next-w, ${SIDE.def}%);
  grid-template-rows: ${TOP_H}px var(--rp-row, 55%) ${GUTTER}px minmax(0, 1fr) ${STATUS_H}px;
  padding: 0 ${GUTTER}px ${GUTTER}px; color: #1A1A18; font-family: ${SANS}; line-height: 1.4; text-align: left; }
.rp-top { grid-area: 1 / 1 / 2 / -1; }
.rp-side-prev { grid-area: 2 / 1; }
.rp-split[data-split=prev] { grid-area: 2 / 2; }
.rp-current { grid-area: 2 / 3; position: relative; min-width: 0; min-height: 0; }
.rp-split[data-split=next] { grid-area: 2 / 4; }
.rp-side-next { grid-area: 2 / 5; }
.rp-split-y { grid-area: 3 / 1 / 4 / -1; }
.rp-notes-wrap { grid-area: 4 / 1 / 5 / -1; }
.rp-status { grid-area: 5 / 1 / 6 / -1; }
.rp-shell[data-hide-prev] .rp-side-prev, .rp-shell[data-hide-prev] [data-split=prev],
.rp-shell[data-hide-next] .rp-side-next, .rp-shell[data-hide-next] [data-split=next] { display: none; }
html.rp-presenter #sw-slides { box-shadow: 0 0 0 calc(1px / var(--sw-scale, 1)) #E3E3DF; overflow: hidden; border-radius: calc(10px / var(--sw-scale, 1)); }
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
.rp-side > .rp-thumb { position: relative; flex: 0 1 auto; width: 100%; aspect-ratio: ${W} / ${H}; min-height: 0; container-type: size; }
.rp-thumb > .rp-preview { top: 0; border-radius: 8px; box-shadow: 0 0 0 1px #E3E3DF; pointer-events: none; }
.rp-end { position: absolute; inset: 0; display: grid; place-items: center; padding-left: .06em; border: 1px dashed #D5D5D0; border-radius: 8px;
  font-family: ${MONO}; font-size: min(calc(80cqw / (var(--chars, 5) * .66)), 60cqh); font-weight: 600; letter-spacing: .06em;
  line-height: 1; text-transform: uppercase; color: #CFCFC9; }
.rp-steps { font-size: 12px; color: ${ACCENT}; }
.rp-notes-wrap { display: flex; flex-direction: column; min-height: 0; padding: 14px 20px; border: 1px solid #E3E3DF; border-radius: 14px; background: #FFFFFF; }
.rp-notes-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px;
  font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #4A4A43; }
.rp-shell .rp-notes-head button { padding: 2px 8px; margin-left: 4px; font-size: 13px; letter-spacing: 0; }
.rp-notes { flex: 1; min-height: 0; overflow-y: auto; padding-right: 6px; font-size: var(--rp-font, ${FONT.def}px); line-height: 1.55; }
.rp-notes::-webkit-scrollbar { width: 10px; }
.rp-notes::-webkit-scrollbar-track { background: #F1F1EE; border-radius: 5px; }
.rp-notes::-webkit-scrollbar-thumb { background: #C4C4BE; border: 2px solid #F1F1EE; border-radius: 5px; }
@supports not selector(::-webkit-scrollbar) { .rp-notes { scrollbar-width: thin; scrollbar-color: #C4C4BE #F1F1EE; } }
.rp-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 6px; white-space: nowrap;
  font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: #6B6B63; }
.rp-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: ${ACCENT}; }
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

.rp-ov { display: none; position: fixed; inset: 0; z-index: 50; overflow-y: auto; padding: 28px 36px 64px;
  background: var(--color-surface-alt, var(--color-bg, #F4F4F2)); color: var(--color-ink, #1A1A18); font-family: ${SANS}; line-height: 1.4; text-align: left; }
html.rp-ov-on .rp-ov { display: block; }
.rp-ov-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.rp-ov-title { margin: 0 0 4px; font-family: var(--font-serif, ${SANS}); font-size: 22px; font-weight: 600; line-height: 1.2; color: var(--color-ink, #1A1A18); }
.rp-ov-sub { margin: 0; font-size: 13px; color: var(--color-ink-muted, #6B6B63); }
.rp-ov button.rp-ov-btn { all: unset; cursor: pointer; flex: none; padding: 6px 12px; border: 1px solid var(--color-border, #CBD2CB); border-radius: var(--radius, 8px);
  color: ${ACCENT}; font: 500 11px ${MONO}; letter-spacing: .08em; text-transform: uppercase; margin-left: 8px; }
.rp-ov button.rp-ov-btn:hover { background: var(--color-surface, #FFFFFF); }
.rp-ov button.rp-ov-btn:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
html.sw-editing .rp-ov button.rp-ov-edit { background: var(--color-ink, #1A1A18); border-color: var(--color-ink, #1A1A18); color: var(--color-bg, #FFFFFF); }
.rp-ov-actions { display: flex; align-items: center; }
.rp-ov-grp { display: flex; align-items: baseline; gap: 12px; margin: 30px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border, #E3E3DF);
  font-family: var(--font-serif, ${SANS}); font-size: 17px; font-weight: 600; line-height: 1.25; color: var(--color-ink, #1A1A18); }
.rp-ov-body > .rp-ov-grp:first-child { margin-top: 22px; padding-top: 0; border-top: 0; }
.rp-ov-body > .rp-ov-grid:first-child { margin-top: 22px; }
.rp-ov-kick { flex: none; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: ${ACCENT}; }
.rp-ov-count { flex: none; margin-left: auto; font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; color: var(--color-ink-faint, #9E9E97); }
.rp-ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px 16px; }
.rp-ov-cell { position: relative; min-width: 0; }
.rp-ov-cell[draggable] { cursor: grab; }
.rp-ov-cell.rp-dragging { opacity: .35; }
.rp-ov-cell.rp-drop-before .rp-ov-box { box-shadow: -8px 0 0 -4px ${ACCENT}; }
.rp-ov-cell.rp-drop-after .rp-ov-box { box-shadow: 8px 0 0 -4px ${ACCENT}; }
.rp-ov-th { all: unset; display: block; min-width: 0; cursor: pointer; }
.rp-ov-cell[draggable] .rp-ov-th { cursor: grab; }
.rp-ov-mask { display: none; position: absolute; inset: 0; z-index: 20; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--color-ink, #1A1A18) 42%, transparent); }
.rp-ov-mask span { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px;
  background: var(--color-surface, #FFFFFF); color: var(--color-ink, #1A1A18); border: 1px solid var(--color-border, #E3E3DF);
  box-shadow: 0 4px 14px rgba(0, 0, 0, .22); font: 600 11px ${MONO}; letter-spacing: .12em; text-transform: uppercase; }
.rp-ov-mask svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rp-ov-cell.rp-hidden .rp-ov-mask { display: flex; }
.rp-ov-cell.rp-hidden .rp-ov-cap { color: var(--color-ink-muted, #6B6B63); }
.rp-ov-cell.rp-deleted .rp-ov-box { opacity: .3; filter: grayscale(1); }
.rp-ov-cell.rp-deleted .rp-ov-cap { color: var(--color-ink-muted, #6B6B63); text-decoration: line-through; }
.rp-ov-tools { position: absolute; top: 6px; right: 6px; z-index: 22; display: flex; gap: 4px; opacity: 0; transition: opacity .12s; }
.rp-ov-cell:hover .rp-ov-tools, .rp-ov-cell:focus-within .rp-ov-tools, .rp-ov-cell.rp-hidden .rp-ov-tools, .rp-ov-cell.rp-deleted .rp-ov-tools { opacity: 1; }
.rp-ov-tools button { all: unset; cursor: pointer; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;
  background: var(--color-surface, #FFFFFF); border: 1px solid var(--color-border, #E3E3DF); color: var(--color-ink, #1A1A18); box-shadow: 0 2px 8px rgba(0, 0, 0, .14); }
.rp-ov-tools button:hover { color: ${ACCENT}; border-color: ${ACCENT}; }
.rp-ov-tools button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
.rp-ov-tools button[data-ov=undo] { width: auto; padding: 0 9px; border-radius: 13px; font: 500 11px ${MONO}; letter-spacing: .06em; text-transform: uppercase; }
.rp-ov-tools svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rp-ov-box { position: relative; width: 100%; aspect-ratio: ${W} / ${H}; overflow: hidden; border-radius: var(--radius, 6px);
  background: var(--color-bg, #FFFFFF); outline: 1px solid var(--color-border, #E3E3DF); outline-offset: 0; transition: outline-color .12s; }
.rp-ov-box > .rp-preview { inset: 0; pointer-events: none; }
.rp-ov-th:hover .rp-ov-box, .rp-ov-th:focus-visible .rp-ov-box { outline: 2px solid ${ACCENT}; }
.rp-ov-th.rp-cur .rp-ov-box { outline: 3px solid var(--color-ink, #1A1A18); }
.rp-ov-cap { display: flex; gap: 8px; margin-top: 8px; font-size: 12px; line-height: 1.35; color: var(--color-ink-body, #1A1A18); }
.rp-ov-cap b { flex: none; font-family: ${MONO}; font-weight: 500; color: ${ACCENT}; font-variant-numeric: tabular-nums; }
.rp-ov-cap span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rp-ov-lane { display: flex; align-items: center; gap: 8px; margin-right: 4px; font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-ink-muted, #6B6B63); }
.rp-ov-lane select { font: 500 12px ${SANS}; color: var(--color-ink, #1A1A18); background: var(--color-surface, #FFFFFF); border: 1px solid var(--color-border, #E3E3DF); border-radius: var(--radius, 8px); padding: 5px 8px; }
.rp-ov-swatch { width: 12px; height: 12px; border-radius: 50%; background: var(--rp-lane, var(--color-ink, #1A1A18)); box-shadow: 0 0 0 1px var(--color-border, #E3E3DF); }
.rp-ov-cell.rp-laned .rp-ov-box::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; z-index: 21; background: var(--rp-lane, var(--color-ink, #1A1A18)); }

.rp-hud { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 45; display: flex; align-items: center; gap: 4px; padding: 5px;
  border-radius: 12px; border: 1px solid var(--color-border, #E3E3DF);
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
.rp-hud-info { position: relative; display: inline-flex; }
.rp-hud-help { display: none; position: absolute; right: 0; bottom: calc(100% + 6px); width: 330px; padding: 12px 14px 10px; box-sizing: border-box; cursor: default;
  border-radius: 12px; border: 1px solid var(--color-border, #E3E3DF); background: var(--color-surface, #FFFFFF); color: var(--color-ink, #1A1A18);
  box-shadow: 0 8px 30px rgba(0, 0, 0, .18); font-size: 12px; line-height: 1.4; text-align: left; }
.rp-hud-help::after { content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; }
.rp-hud-info:hover .rp-hud-help, .rp-hud-info:focus-within .rp-hud-help, .rp-hud[data-help] .rp-hud-help { display: block; }
.rp-hud-help h3 { margin: 0 0 8px; font: 600 11px/1 ${SANS}; letter-spacing: .1em; text-transform: uppercase; color: var(--color-ink-muted, #6B6B63); }
.rp-hud-help dl { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; margin: 0; }
.rp-hud-help dt { font-family: ${MONO}; font-size: 11px; white-space: nowrap; color: ${ACCENT}; }
.rp-hud-help dd { margin: 0; }
.rp-hud-help p { margin: 8px 0 0; color: var(--color-ink-muted, #6B6B63); }
html.rp-presenter .rp-hud, html.rp-ov-on .rp-hud, html.sw-print .rp-hud, html.sw-capture .rp-hud { display: none !important; }
@media print { .rp-hud, .rp-drawer, .rp-drawer-grip, .rp-ov { display: none !important; } }
`;
  const HUD_HTML = `
<button type="button" data-hud="prev" aria-label="Previous slide" title="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
<span class="rp-hud-count"></span>
<button type="button" data-hud="next" aria-label="Next slide" title="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
<span class="rp-hud-sep"></span>
<span class="rp-hud-name"></span>
<span class="rp-hud-sep"></span>
<button type="button" data-hud="grid" aria-label="Slide overview (O)" title="Overview (O)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button>
<button type="button" data-hud="full" aria-label="Fullscreen (f)" title="Fullscreen (f)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
<span class="rp-hud-info"><button type="button" data-hud="help" aria-label="Keyboard shortcuts" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg></button><div class="rp-hud-help" role="tooltip"></div></span>`;
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.4 10.4 0 0 1 12 5c5 0 9 4 10 7a11.7 11.7 0 0 1-3.2 4.3M6.3 6.3A11.6 11.6 0 0 0 2 12c1 3 5 7 10 7a9.7 9.7 0 0 0 4.4-1"/></svg>';
  const EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const OPENING = "Opening";

  const splitHtml = (name, axis, label) => `<div class="rp-split rp-split-${axis}" data-split="${name}" role="separator"
  aria-label="${label}" aria-orientation="${axis === "x" ? "vertical" : "horizontal"}" tabindex="0" title="Drag to resize · double-click to reset"></div>`;
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
      const lines = para.split("\n").map((l) => l.trim());
      if (lines.every((l) => /^[-•]\s+/.test(l))) return "<ul>" + lines.map((l) => "<li>" + inline(l.replace(/^[-•]\s+/, "")) + "</li>").join("") + "</ul>";
      return "<p>" + inline(lines.join(" ")) + "</p>";
    }).join("");
  }
  function readNote(slide) {
    const aside = slide && slide.querySelector(":scope > aside.notes");
    const d = slide ? slide.dataset : {};
    return { text: aside ? aside.textContent : "", session: d.session || "", module: d.module || "", run: d.run || "" };
  }
  function inRun(n) { return !RUNS[n.run] || RUNS[n.run].inRun; }
  function cueLine(n) { return [n.session, n.module, RUNS[n.run] ? RUNS[n.run].label : n.run].filter(Boolean).join(" · "); }
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

  // ── State ─────────────────────────────────────────────────────────
  const key = location.pathname;
  const isPresenter = new URLSearchParams(location.search).has("presenter");
  let slides = [], notes = [], cur = 0;
  let bc = null, peer = null, applying = false, connected = false;
  let drawer, shell, ov, ovFilled = false, hud, hudTimer = 0;
  const timer = { start: 0, paused: 0, pausedAt: 0 };
  const prefs = { font: FONT.def, prev: SIDE.def, next: SIDE.def, hide: { prev: false, next: false }, soloRow: null };
  const LENGTHS_KEY = NS + ":lengths:" + key;
  let deckLengths = {}, lengths = {};
  const shown = { prev: 0, next: 0, row: 0 };
  const q = (sel) => shell.querySelector(sel);
  const editor = () => window.SWEditor || null;
  const editing = () => !!editor() && html.classList.contains("sw-editing");

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
    const msg = { ns: NS, deck: key, type, i: SW.index(), step: SW.step(), paused: SW.paused() };
    if (bc) try { bc.postMessage(msg); } catch (e) { /* closed */ }
    if (peer && !peer.closed) try { peer.postMessage(msg, "*"); } catch (e) { /* gone */ }
  }
  // Builds play in the presenter window, and in the audience window only while a presenter is
  // connected and nobody is editing; otherwise every slide shows complete.
  function syncBuilds() {
    const was = applying;
    applying = applying || "initial";   // switching builds isn't a move: no sync message, no timer start
    try {
      if (SW.config.builds === "always" || SW.config.builds === "never") SW.builds(SW.config.builds === "always");
      else SW.builds(isPresenter || (connected && !html.classList.contains("sw-editing")));
    } finally { applying = was; }
  }
  function receive(msg) {
    if (!msg || msg.ns !== NS || msg.deck !== key) return;
    const initial = !connected;
    connected = true;
    if (initial) syncBuilds();
    if (isPresenter) q(".rp-sync").textContent = "Synced · either window moves both";
    if (msg.type === "hello") { if (!isPresenter) send("state"); return; }
    if (msg.type !== "state" || typeof msg.i !== "number") return;
    applying = initial ? "initial" : true;
    try {
      if (SW.index() !== msg.i || SW.step() !== msg.step) SW.go(msg.i, msg.step);
      if (typeof msg.paused === "boolean" && SW.paused() !== msg.paused) SW.pause(msg.paused);
    } finally { applying = false; }
  }

  // ── Navigation ─────────────────────────────────────────────────
  function onNav(e) {
    cur = Math.max(0, slides.indexOf(SW.current()));
    if (!applying) send("state");
    if (isPresenter) {
      if (!timer.start && applying !== "initial") timer.start = Date.now();
      render(e && e.moved);
    } else { renderDrawer(); renderHud(); }
    if (overviewOpen()) markCurrent();
  }

  // ── Audience window ────────────────────────────────────────────
  function presenterUrl() {
    const u = new URL(location.href);
    u.searchParams.delete("overview");
    u.searchParams.set("presenter", "");
    return u.href.replace(/presenter=(?=&|#|$)/, "presenter");
  }
  function openPresenter() {
    if (!peer || peer.closed) {
      peer = window.open("", NS + ":" + key, "width=1440,height=900");   // reuses a presenter window that survived a reload
      if (!peer) { console.warn("slideware: the popup was blocked. Allow popups for this page, then press P again."); return; }
      let blank = true;
      try { blank = peer.location.href === "about:blank"; } catch (e) { blank = false; }
      if (blank) peer.location.href = presenterUrl();
    }
    peer.focus();
  }
  function toggleDrawer() {
    html.classList.toggle("rp-drawer-on");
    renderDrawer();
    reserveBottom();
  }
  function reserveBottom() {
    placeGrip();
    if (html.classList.contains("sw-editing")) return;   // the editor's panel owns the space then
    if (html.classList.contains("rp-drawer-on")) html.style.setProperty("--sw-reserve-bottom", drawer.offsetHeight + "px");
    else html.style.removeProperty("--sw-reserve-bottom");
    SW.layout();
  }
  // The drawer's height: drag the grip along its top edge; double-click returns to the default.
  // Remembered per browser.
  const DRAWER_KEY = "sw-presenter:drawer-h";
  let grip = null;
  function placeGrip() { if (grip && drawer) grip.style.top = (innerHeight - drawer.offsetHeight) + "px"; }
  function setDrawerHeight(px) {
    if (px === null) { html.style.removeProperty("--rp-drawer-h"); html.classList.remove("rp-drawer-sized"); try { localStorage.removeItem(DRAWER_KEY); } catch (e) { /* blocked */ } }
    else {
      const h = Math.round(Math.max(80, Math.min(innerHeight * 0.85, px)));
      html.style.setProperty("--rp-drawer-h", h + "px"); html.classList.add("rp-drawer-sized");
      try { localStorage.setItem(DRAWER_KEY, String(h)); } catch (e) { /* blocked */ }
    }
    reserveBottom();
  }
  function buildGrip() {
    grip = doc.createElement("div");
    grip.className = "rp-drawer-grip";
    grip.title = "Drag to resize the notes; double-click to reset";
    doc.body.appendChild(grip);
    let saved = null;
    try { saved = parseInt(localStorage.getItem(DRAWER_KEY), 10); } catch (e) { /* blocked */ }
    if (saved > 0) { html.style.setProperty("--rp-drawer-h", Math.min(saved, innerHeight * 0.85) + "px"); html.classList.add("rp-drawer-sized"); }
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      grip.classList.add("rp-dragging");
      const move = (ev) => setDrawerHeight(innerHeight - ev.clientY);
      const up = () => { grip.classList.remove("rp-dragging"); grip.removeEventListener("pointermove", move); };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up, { once: true });
      grip.addEventListener("pointercancel", up, { once: true });
    });
    grip.addEventListener("dblclick", () => setDrawerHeight(null));
    window.addEventListener("resize", placeGrip);
  }
  function renderDrawer() {
    if (!html.classList.contains("rp-drawer-on")) return;
    const n = notes[cur] || readNote(SW.current()), cue = cueLine(n);
    drawer.firstChild.textContent = (cur + 1) + " / " + slides.length + (cue ? "  ·  " + cue : "");
    drawer.lastChild.innerHTML = md(n.text);
  }
  function buildAudience() {
    drawer = doc.createElement("div");
    drawer.className = "rp-drawer";
    drawer.setAttribute("aria-live", "polite");
    drawer.innerHTML = '<div class="rp-cue-text"></div><div class="rp-md"></div>';
    doc.body.appendChild(drawer);
    buildGrip();
    new ResizeObserver(() => { if (html.classList.contains("rp-drawer-on")) reserveBottom(); }).observe(drawer);
    doc.addEventListener("sw-reserve", reserveBottom);   // the editor closed; the drawer's claim applies again
    SW.key({ key: "P", desc: "Presenter view in a second window" }, openPresenter);
    SW.key({ key: "N", desc: "Notes drawer, for rehearsal" }, toggleDrawer);
    buildHud();
  }

  // ── Navigation pill ────────────────────────────────────────────
  function buildHud() {
    hud = doc.createElement("nav");
    hud.className = "rp-hud";
    hud.setAttribute("aria-label", "Slide navigation");
    hud.innerHTML = HUD_HTML;
    doc.body.appendChild(hud);
    hud.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-hud]");
      if (!btn) return;
      btn.blur();
      const act = btn.dataset.hud;
      if (act === "prev") SW.prev();
      else if (act === "next") SW.next();
      else if (act === "grid") toggleOverview();
      else if (act === "full") { if (doc.fullscreenElement) doc.exitFullscreen(); else if (html.requestFullscreen) html.requestFullscreen(); }
      else if (act === "help") pinHelp(!hud.hasAttribute("data-help"));
    });
    doc.addEventListener("click", (e) => { if (hud.hasAttribute("data-help") && !e.target.closest(".rp-hud-info")) pinHelp(false); });
    doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && hud.hasAttribute("data-help")) pinHelp(false); }, true);
    const show = () => {
      html.classList.add("rp-hud-on");
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => html.classList.remove("rp-hud-on"), 2500);
    };
    doc.addEventListener("mousemove", show);
    doc.addEventListener("touchstart", show, { passive: true });
    show();
  }
  function fillHelp() {
    const keys = SW.keys();
    hud.querySelector(".rp-hud-help").innerHTML = "<h3>Keys</h3><dl>" + keys.map((k) => "<dt>" + esc(k.label) + "</dt><dd>" + esc(k.desc) + "</dd>").join("") + "</dl>" +
      "<p>Capital letters need Shift. Click the i to keep this open.</p>";
  }
  function pinHelp(open) {
    if (open) fillHelp();
    hud.toggleAttribute("data-help", open);
    hud.querySelector("button[data-hud=help]").setAttribute("aria-expanded", String(open));
  }
  function sectionOf(i) {
    for (let k = i; k >= 0; k--) { const g = groupOf(slides[k]); if (g) return g.title; }
    return slides.some((s) => groupOf(s)) ? OPENING : "";
  }
  function renderHud() {
    if (!hud) return;
    hud.querySelector(".rp-hud-count").innerHTML = pad(cur + 1) + " <span>/ " + slides.length + "</span>";
    hud.querySelector(".rp-hud-name").textContent = sectionOf(cur);
  }

  // ── Presenter window: layout ───────────────────────────────────
  function contentWidth() { return shell.clientWidth - 2 * GUTTER; }
  function shownSides() { return ["prev", "next"].filter((s) => !prefs.hide[s]); }
  function panesWidth(w) { return w - GUTTER * shownSides().length; }
  function rowRoom() { return shell.clientHeight - TOP_H - STATUS_H - 3 * GUTTER - NOTES_MIN; }
  function applyLayout() {
    const w = contentWidth(), panes = panesWidth(w), sides = shownSides();
    const width = { prev: 0, next: 0 };
    sides.forEach((s) => { width[s] = (prefs[s] / 100) * w; });
    const total = width.prev + width.next;
    const wanted = sides.length ? (panes - total) / ratio : Math.min(prefs.soloRow || Infinity, panes / ratio);
    const row = Math.max(ROW_MIN, Math.min(rowRoom(), wanted));
    const spare = sides.length ? panes - total - row * ratio : 0;
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
    SW.layout();
    fitThumbs();
  }
  function toggleSide(side) { prefs.hide[side] = !prefs.hide[side]; applyLayout(); savePrefs(); }
  function resizeSide(name, px) {
    const w = contentWidth(), panes = panesWidth(w), other = name === "prev" ? "next" : "prev";
    const lo = Math.max((SIDE.min / 100) * w, panes - shown[other] - rowRoom() * ratio);
    const hi = Math.min((SIDE.max / 100) * w, panes - shown[other] - ROW_MIN * ratio);
    prefs[name] = (Math.min(Math.max(px, lo), Math.max(lo, hi)) / w) * 100;
    prefs[other] = (shown[other] / w) * 100;
    applyLayout();
  }
  function resizeRow(px) {
    const w = contentWidth(), panes = panesWidth(w), sides = shownSides();
    if (!sides.length) { prefs.soloRow = px; applyLayout(); return; }
    const total = sides.reduce((t, s) => t + shown[s], 0), shares = sides.map((s) => shown[s] / total);
    const lo = Math.max(ROW_MIN, (panes - ((SIDE.max / 100) * w) / Math.max(...shares)) / ratio);
    const hi = Math.min(rowRoom(), (panes - ((SIDE.min / 100) * w) / Math.min(...shares)) / ratio);
    const width = panes - Math.min(Math.max(px, lo), Math.max(lo, hi)) * ratio;
    sides.forEach((s, i) => { prefs[s] = ((width * shares[i]) / w) * 100; });
    applyLayout();
  }
  function resetSplit(name) {
    if (name !== "row") resizeSide(name, (SIDE.def / 100) * contentWidth());
    else if (shownSides().length) { prefs.prev = prefs.next = SIDE.def; applyLayout(); }
    else { prefs.soloRow = null; applyLayout(); }
  }
  function loadPrefs() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { /* blocked */ }
    prefs.prev = clamp(saved.prev, SIDE.min, SIDE.max, SIDE.def);
    prefs.next = clamp(saved.next, SIDE.min, SIDE.max, SIDE.def);
    prefs.hide = { prev: !!(saved.hide && saved.hide.prev), next: !!(saved.hide && saved.hide.next) };
    prefs.soloRow = Number(saved.soloRow) > 0 ? Number(saved.soloRow) : null;
    setFont(saved.font);
  }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* blocked */ } }
  function setFont(v) { prefs.font = clamp(v, FONT.min, FONT.max, FONT.def); shell.style.setProperty("--rp-font", prefs.font + "px"); }
  function pointerTarget(name, e) {
    if (name === "row") return e.clientY - q(".rp-current").getBoundingClientRect().top - GUTTER / 2;
    const left = shell.getBoundingClientRect().left + GUTTER;
    return name === "prev" ? e.clientX - left - GUTTER / 2 : left + contentWidth() - e.clientX - GUTTER / 2;
  }
  function wireSplit(name) {
    const handle = q(`[data-split=${name}]`);
    const resizing = name === "row" ? "rp-resizing-y" : "rp-resizing-x";
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("rp-active");
      html.classList.add(resizing);
      const move = (ev) => (name === "row" ? resizeRow : (px) => resizeSide(name, px))(pointerTarget(name, ev));
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
      e.stopPropagation();
      if (name === "row") resizeRow(shown.row + 12 * dir);
      else resizeSide(name, shown[name] + 0.01 * contentWidth() * dir * (name === "next" ? -1 : 1));
      savePrefs();
    });
  }
  function fitThumbs() {
    shell.querySelectorAll(".rp-thumb > .rp-preview").forEach((frame) => {
      const box = frame.parentNode, w = Math.max(0, Math.min(box.clientWidth, box.clientHeight * ratio));
      const left = frame.closest(".rp-side-prev") ? box.clientWidth - w : 0;
      Object.assign(frame.style, { left: left + "px", width: w + "px", height: w / ratio + "px" });
      scaleCopy(frame, w);
    });
  }
  function buildShell() {
    html.classList.add("rp-presenter");
    shell = doc.createElement("div");
    shell.className = "rp-shell";
    shell.innerHTML = SHELL_HTML;
    doc.body.appendChild(shell);
    loadPrefs();
    ["prev", "next", "row"].forEach(wireSplit);
    SW.host(q(".rp-current"), { align: "bottom" });   // the live deck sits in the current pane, on the border above the notes
    new ResizeObserver(applyLayout).observe(shell);
    applyLayout();
  }

  // ── Presenter window: pacing ───────────────────────────────────
  function savedLengths() { try { return JSON.parse(localStorage.getItem(LENGTHS_KEY)) || {}; } catch (e) { return {}; } }
  function loadLengths() {
    deckLengths = Object.assign({}, SW.config.sessions);
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
    } else { lengths[session] = deckLengths[session]; delete saved[session]; }
    try { localStorage.setItem(LENGTHS_KEY, JSON.stringify(saved)); } catch (e) { /* blocked */ }
  }
  function perSlide(session) {
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
    if (doc.activeElement !== input) input.value = lengths[session] > 0 ? lengths[session] : "";
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
  // A fully built, inert copy of a slide on its own scaled stage.
  function slideCopy(slide) {
    const frame = doc.createElement("div");
    frame.className = "rp-preview";
    frame.setAttribute("aria-hidden", "true");
    frame.inert = true;
    const stage = doc.createElement("div");
    stage.className = "rp-copy-stage";
    stage.appendChild(SW.cloneSlide(slide));
    frame.appendChild(stage);
    return frame;
  }
  function scaleCopy(frame, w) { frame.firstChild.style.transform = "scale(" + w / W + ")"; }

  // ── Overview ───────────────────────────────────────────────────
  function overviewOpen() { return html.classList.contains("rp-ov-on"); }
  function captionOf(slide) {
    for (const sel of ["h1, h2, h3", ".label", "blockquote", ".caption", "figcaption"]) {
      const el = slide.querySelector(sel);
      if (el) return el.textContent.replace(/\s+/g, " ").trim();
    }
    return "";
  }
  function groupOf(slide) {
    if (!slide || !(slide.hasAttribute("data-divider") || slide.classList.contains("layout-section"))) return null;
    const kick = slide.querySelector(".kicker");
    return { kicker: kick ? kick.textContent.trim() : "", title: titleOf(slide) || slide.getAttribute("data-divider") || "Section" };
  }
  function lanesCfg() { return (SW.config.lanes || []).filter((l) => l && l.name && l.file); }
  function buildOverview() {
    ov = doc.createElement("div");
    ov.className = "rp-ov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Slide overview");
    ov.innerHTML = '<div class="rp-ov-head"><div><h1 class="rp-ov-title"></h1><p class="rp-ov-sub"></p></div>' +
      '<div class="rp-ov-actions"><button type="button" class="rp-ov-btn rp-ov-close" title="Close the overview (Esc)">Close</button></div></div><div class="rp-ov-body"></div>';
    const actions = ov.querySelector(".rp-ov-actions");
    const lanes = lanesCfg();
    if (lanes.length > 1) {
      const label = doc.createElement("label");
      label.className = "rp-ov-lane";
      label.innerHTML = '<span>Lane</span><span class="rp-ov-swatch"></span><select aria-label="Lane"></select>';
      const select = label.lastChild, here = SW.config.lane || "";
      const current = lanes.find((l) => (l.id || "") === here);
      if (current && current.color) label.querySelector(".rp-ov-swatch").style.setProperty("--rp-lane", current.color);
      lanes.forEach((l) => {
        const opt = doc.createElement("option");
        opt.value = l.file;
        opt.textContent = l.name;
        opt.selected = (l.id || "") === here;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => { location.href = select.value + location.hash; });
      actions.insertBefore(label, actions.firstChild);
    }
    ov.addEventListener("click", (e) => {
      const tool = e.target.closest("button[data-ov]");
      if (tool) { structural(tool.dataset.ov, tool.closest(".rp-ov-cell").dataset.key); return; }
      const th = e.target.closest(".rp-ov-th");
      if (th) { if (+th.dataset.i >= 0) { closeOverview(); SW.go(+th.dataset.i, 0); } }
      else if (e.target.closest(".rp-ov-edit")) doc.dispatchEvent(new CustomEvent("sw-edit-toggle"));
      else if (e.target.closest(".rp-ov-close")) closeOverview();
    });
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
      const r = cell.getBoundingClientRect();
      clearDrop();
      cell.classList.add(e.clientX < r.left + r.width / 2 ? "rp-drop-before" : "rp-drop-after");
    });
    ov.addEventListener("drop", (e) => {
      const cell = e.target.closest && e.target.closest(".rp-ov-cell");
      if (!dragKey || !cell || cell.dataset.key === dragKey) return;
      e.preventDefault();
      moveSlide(dragKey, cell.dataset.key, cell.classList.contains("rp-drop-before"));
    });
    ov.addEventListener("dragend", () => { dragKey = null; clearDrop(); ov.querySelectorAll(".rp-dragging").forEach((c) => c.classList.remove("rp-dragging")); });
    new ResizeObserver(scaleOverview).observe(ov);
    // The editor changed the deck (an edit, a structural change, the mode toggled): re-read, redraw.
    doc.addEventListener("sw-edit-change", (e) => {
      syncBuilds();
      refreshSlides();
      if (overviewOpen()) refillOverview(e.detail && e.detail.key);
    });
    doc.body.appendChild(ov);
  }
  function moveSlide(k, targetKey, before) {
    const api = editor();
    if (!api || !editing()) return;
    const keys = api.slides().map((s) => s.key).filter((x) => x !== k);
    const at = keys.indexOf(targetKey);
    if (at < 0) return;
    keys.splice(before ? at : at + 1, 0, k);
    api.reorder(keys);
  }
  function refreshSlides() {
    slides = SW.slides();
    notes = slides.map(readNote);
    cur = Math.max(0, slides.indexOf(SW.current()));
    renderHud();
    renderDrawer();
  }
  function structural(act, k) {
    const api = editor();
    if (!api || !k || !editing()) return;
    const s = api.slides().find((x) => x.key === k);
    if (!s) return;
    if (act === "hide") api.setHidden(k, !s.hidden);
    else if (act === "delete") api.setDeleted(k, true);
    else if (act === "undo") api.setDeleted(k, false);
    else if (act === "earlier" || act === "later") {
      const keys = api.slides().map((x) => x.key), i = keys.indexOf(k), j = act === "earlier" ? i - 1 : i + 1;
      if (j < 0 || j >= keys.length) return;
      [keys[i], keys[j]] = [keys[j], keys[i]];
      api.reorder(keys);
    }
  }
  function refillOverview(focusKey) {
    ovFilled = false;
    fillOverview();
    markCurrent();
    scaleOverview();
    const th = focusKey && ov.querySelector(`.rp-ov-cell[data-key="${window.CSS.escape(focusKey)}"] .rp-ov-th`);
    if (th) th.focus({ preventScroll: false });
  }
  function fillOverview() {
    const api = editor(), body = ov.querySelector(".rp-ov-body"), edit = editing();
    body.innerHTML = "";
    // While editing: every slide (hidden ones included) in the deck's order; otherwise the visible slides.
    const list = edit ? api.slides().map((s) => ({ ...s, i: slides.indexOf(s.el) })) : slides.map((el, i) => ({ key: el.getAttribute("data-key"), el, i, hidden: false, deleted: false }));
    const hasSections = list.some((s) => !s.deleted && groupOf(s.el));
    const lanes = lanesCfg(), here = SW.config.lane || "";
    const currentLane = lanes.find((l) => (l.id || "") === here);
    const laneColor = lanes.length > 1 ? (currentLane && currentLane.color) || null : undefined;
    let grid = null, groups = 0, n = 0;
    list.forEach((s) => {
      const slide = s.el, g = s.deleted ? null : groupOf(slide);
      if (g || !grid) {
        const head = g || (hasSections ? { kicker: "", title: OPENING } : null);
        if (head) {
          groups += g ? 1 : 0;
          const h = doc.createElement("h2");
          h.className = "rp-ov-grp";
          h.innerHTML = (head.kicker ? '<span class="rp-ov-kick"></span>' : "") + '<span class="rp-ov-grp-title"></span><span class="rp-ov-count"></span>';
          if (head.kicker) h.firstChild.textContent = head.kicker;
          h.querySelector(".rp-ov-grp-title").textContent = head.title;
          body.appendChild(h);
        }
        grid = doc.createElement("div");
        grid.className = "rp-ov-grid";
        body.appendChild(grid);
      }
      const caption = captionOf(slide), num = s.deleted || s.hidden ? "" : pad(++n);
      const cell = doc.createElement("div"), th = doc.createElement("div");
      cell.className = "rp-ov-cell" + (s.hidden ? " rp-hidden" : "") + (s.deleted ? " rp-deleted" : "");
      if (s.key) cell.dataset.key = s.key;
      if (laneColor !== undefined) {
        cell.classList.add("rp-laned");
        if (laneColor && slide.hasAttribute("data-lane-changed")) cell.style.setProperty("--rp-lane", laneColor);
      }
      th.className = "rp-ov-th";
      th.setAttribute("role", "button");
      th.tabIndex = 0;
      th.dataset.i = s.i;
      th.setAttribute("aria-label", (s.i >= 0 ? "Go to slide " + (s.i + 1) : "Slide not shown") + (caption ? ": " + caption : "") + (s.hidden ? " (hidden)" : "") + (s.deleted ? " (deleted)" : ""));
      th.innerHTML = '<div class="rp-ov-box"></div><div class="rp-ov-cap"><b></b><span></span></div>';
      th.querySelector(".rp-ov-cap b").textContent = num || "·";
      th.querySelector(".rp-ov-cap span").textContent = caption;
      th.querySelector(".rp-ov-box").appendChild(slideCopy(slide));
      cell.appendChild(th);
      if (edit) {
        const mask = doc.createElement("div");
        mask.className = "rp-ov-mask";
        mask.innerHTML = "<span>" + EYE_OFF + "Hidden</span>";
        th.querySelector(".rp-ov-box").appendChild(mask);
        const laneNote = api.lane && api.lane() ? " in this lane" : "";
        const tools = doc.createElement("div");
        tools.className = "rp-ov-tools";
        tools.innerHTML = s.deleted
          ? '<button type="button" data-ov="undo" title="Bring the slide back (Del)">Undo</button>'
          : `<button type="button" data-ov="hide" title="${s.hidden ? "Show the slide" + laneNote : "Hide the slide" + laneNote} (H)" aria-label="${s.hidden ? "Show" : "Hide"}">${s.hidden ? EYE_ON : EYE_OFF}</button>` +
            '<button type="button" data-ov="delete" title="Delete the slide (Del)" aria-label="Delete">' + CROSS + "</button>";
        cell.appendChild(tools);
        cell.draggable = true;
      }
      grid.appendChild(cell);
    });
    body.querySelectorAll(".rp-ov-grp").forEach((h) => {
      const k = h.nextElementSibling.querySelectorAll(".rp-ov-cell:not(.rp-deleted):not(.rp-hidden)").length;
      h.querySelector(".rp-ov-count").textContent = k + (k === 1 ? " slide" : " slides");
    });
    ov.querySelector(".rp-ov-title").textContent = SW.config.title || titleOf(slides[0]) || doc.title.replace(/^Presenter · /, "");
    ov.querySelector(".rp-ov-sub").textContent = n + " slides" + (groups ? " in " + groups + (groups === 1 ? " section" : " sections") : "") +
      ". Click a slide to go to it; Esc closes." + (edit ? " Drag to reorder; the eye hides, the X deletes." : api ? " Press E to edit the deck's structure here." : "");
    if (api && !ov.querySelector(".rp-ov-edit")) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "rp-ov-btn rp-ov-edit";
      b.title = "Edit: reorder, hide and delete slides here, edit text on the slides (E)";
      ov.querySelector(".rp-ov-actions").insertBefore(b, ov.querySelector(".rp-ov-close"));
    }
    const editBtn = ov.querySelector(".rp-ov-edit");
    if (editBtn) editBtn.textContent = edit ? "Done" : "Edit";
    ovFilled = true;
  }
  function scaleOverview() {
    if (!overviewOpen()) return;
    ov.querySelectorAll(".rp-ov-box > .rp-preview").forEach((frame) => scaleCopy(frame, frame.parentNode.clientWidth));
  }
  function markCurrent() { ov.querySelectorAll(".rp-ov-th").forEach((t) => t.classList.toggle("rp-cur", +t.dataset.i === cur)); }
  function openOverview() {
    if (overviewOpen()) return;
    if (!ovFilled || editor()) fillOverview();
    html.classList.add("rp-ov-on");
    [SW.stage, drawer, shell].forEach((el) => { if (el) el.inert = true; });
    markCurrent();
    scaleOverview();
    doc.addEventListener("keydown", onOverviewKey, true);
    const at = ov.querySelector(".rp-ov-th.rp-cur");
    if (at) { at.scrollIntoView({ block: "center" }); at.focus({ preventScroll: true }); }
  }
  function closeOverview() {
    if (!overviewOpen()) return;
    html.classList.remove("rp-ov-on");
    [SW.stage, drawer, shell].forEach((el) => { if (el) el.inert = false; });
    doc.removeEventListener("keydown", onOverviewKey, true);
    if (doc.activeElement && ov.contains(doc.activeElement)) doc.activeElement.blur();
  }
  function toggleOverview() { if (overviewOpen()) closeOverview(); else openOverview(); }
  // While the overview is open, keys belong to it.
  function onOverviewKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    const cap = SW.capitalOf(e);
    if (e.key === "Escape" || cap === "O") { e.preventDefault(); closeOverview(); return; }
    if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (cap === "E" && editor()) { e.preventDefault(); doc.dispatchEvent(new CustomEvent("sw-edit-toggle")); return; }
    const ths = Array.from(ov.querySelectorAll(".rp-ov-th")), at = ths.indexOf(doc.activeElement);
    if (at >= 0 && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ths[at].click(); return; }
    if (at >= 0 && editing()) {
      const cell = ths[at].closest(".rp-ov-cell"), k = cell && cell.dataset.key;
      const act = cap === "H" ? "hide" : e.key === "Delete" || e.key === "Backspace" ? (cell.classList.contains("rp-deleted") ? "undo" : "delete")
        : e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowUp") ? "earlier" : e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowDown") ? "later" : null;
      if (act) { e.preventDefault(); structural(act, k); return; }
    }
    let step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    if (at < 0) { if (ths.length) ths[0].focus(); return; }
    if (step === 0) {
      const row = ths.filter((t) => t.closest(".rp-ov-grid") === ths[at].closest(".rp-ov-grid") && t.closest(".rp-ov-cell").offsetTop === ths[at].closest(".rp-ov-cell").offsetTop).length;
      step = e.key === "ArrowDown" ? row : -row;
    }
    const nextTh = ths[Math.min(ths.length - 1, Math.max(0, at + step))];
    nextTh.focus({ preventScroll: true });
    nextTh.scrollIntoView({ block: "nearest" });
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
    const steps = SW.stepsLeft();
    q(".rp-steps").textContent = steps ? steps + (steps === 1 ? " more build" : " more builds") + " on this slide first" : "";
    renderSession();
    tick();
  }
  function startPresenter() {
    doc.title = "Presenter · " + doc.title;
    q(".rp-title").textContent = SW.config.title || titleOf(slides[0]) || doc.title.replace(/^Presenter · /, "");
    q(".rp-sync").textContent = bc || peer ? "Waiting for the audience window (press P there)" : "Not synced";
    const pauseBtn = q("[data-rp=pause]");
    shell.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-rp]");
      if (!btn) return;
      btn.blur();
      const act = btn.dataset.rp;
      if (act === "pause" && timer.start) {
        if (timer.pausedAt) { timer.paused += Date.now() - timer.pausedAt; timer.pausedAt = 0; pauseBtn.textContent = "Pause"; }
        else { timer.pausedAt = Date.now(); pauseBtn.textContent = "Resume"; }
      } else if (act === "reset") { Object.assign(timer, { start: Date.now(), paused: 0, pausedAt: 0 }); pauseBtn.textContent = "Pause"; }
      else if (act === "smaller" || act === "larger") { setFont(prefs.font + (act === "larger" ? FONT.step : -FONT.step)); savePrefs(); }
      else if (act === "prev" || act === "next") toggleSide(act);
      tick();
    });
    const lengthInput = q(".rp-length");
    lengthInput.addEventListener("change", () => { setLength(notes[cur].session, Number(lengthInput.value)); renderSession(); tick(); });
    lengthInput.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") lengthInput.blur(); });
    doc.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target === lengthInput) return;
      if (e.key === "+" || e.key === "=") setFont(prefs.font + FONT.step);
      else if (e.key === "-" || e.key === "_") setFont(prefs.font - FONT.step);
      else if (e.key === "[") toggleSide("prev");
      else if (e.key === "]") toggleSide("next");
      else return;
      savePrefs();
    });
    setInterval(tick, 1000);
    loadLengths();
    render(true);
    send("hello");
  }

  // ── Start ──────────────────────────────────────────────────────
  SW.ready(() => {
    if (html.classList.contains("sw-print")) return;
    const style = doc.createElement("style");
    style.id = "sw-presenter-css";
    style.textContent = CSS;
    doc.head.appendChild(style);
    if (isPresenter) buildShell(); else buildAudience();
    buildOverview();
    SW.key({ key: "O", desc: "Overview of every slide, by section" }, toggleOverview);
    connect();
    slides = SW.slides();
    notes = slides.map(readNote);
    cur = Math.max(0, slides.indexOf(SW.current()));
    SW.on("change", onNav);
    SW.on("refresh", refreshSlides);
    SW.on("pause", () => { if (!applying) send("state"); });
    syncBuilds();
    if (isPresenter) startPresenter(); else renderHud();
    if (new URLSearchParams(location.search).has("overview")) openOverview();
  });
  window.SWPresenter = { openOverview, closeOverview, toggleOverview, openPresenter };
})();
