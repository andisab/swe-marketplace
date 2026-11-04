# Runtime and editor reference

The runtime (`runtime/deck.js` with `runtime/presenter.js`, inlined into every deck as `#sw-runtime`) shows the deck. The editor (`editor/`, loaded from the plugin on E) changes it. This page is the reference for both; [../FORMAT.md](../FORMAT.md) is the guide.

## Keys

Capital letters need Shift (or Caps Lock); a lowercase letter does nothing. `?` lists every key in the deck.

| Key | Does |
|---|---|
| → ↓ Space PageDown | next build, then next slide |
| ← ↑ PageUp | previous build, then previous slide (shown complete) |
| Home, End | first and last slide |
| P | presenter view in a second window |
| N | the notes panel along the bottom, for rehearsal; drag its top edge to resize it (double-click resets), remembered per browser. While editing it is always shown and editable |
| O | overview of every slide, by section |
| E | the editor; listed last in the key list, with a note that editing requires the knowledgeware plugin (the word links to its install guide) |
| f | fullscreen |
| b or . | black out the screen |
| ? | the key list |

Touch: a horizontal swipe moves a step. The navigation pill (bottom centre, shown for a few seconds after the mouse moves) has previous, the slide number, next, the section's name, the overview, fullscreen, and the key list.

## The stage

Slides are drawn at 1280 × 720 and scaled to fit the window, letterboxed in the brand's background colour. Each `<section data-key>` is absolutely positioned on that canvas; the brand's base CSS (or its own `slideware.css`) lays out what's inside. Slides fade between each other.

## Builds

Elements with `data-step="n"` or `class="fragment"` appear one step at a time. Steps are the distinct numbers on the slide, in order; elements that share a number arrive together and stagger among themselves. A `.fragment` without a number takes its position among the slide's builds. Builds work inside figures too: `data-step` on SVG groups in the asset block.

Builds play only while presenting: in the presenter window, and in the audience window while a presenter window is connected. A deck opened on its own, or being edited, shows every slide complete. `"builds": "always"` or `"never"` in the settings overrides that. To preview builds without a second window, open the deck with `?presenter`.

## Entrance motion

`data-a` animates an element in each time its slide becomes current, staggered by `--i` (100 ms, then 70 ms per step): `up`, `fade`, `left`, `right`, `pop`, `grow-x`, `grow-y`, `wipe`, and `draw` for SVG strokes (the shape needs `pathLength="1"`). A build with motion waits for its step, then plays. Motion is off for viewers who prefer reduced motion, in print, in the presenter window and while editing.

## The running footer

With `footer` in the settings (a string or a list), every slide except those with `data-chrome="none"` gets the deck's text on the left and the logo and page number on the right. A slide's `data-footer` adds its own part after the deck's text. `"logo": "<asset>"` names another logo asset, `false` leaves it out; `"pageNumbers": false` drops the numbers. Hidden slides aren't numbered. Brands restyle it through `.sw-chrome`, `.sw-chrome-l`, `.sw-chrome-r`, `.sw-chrome-logo` and `.sw-chrome-pg`.

## URLs and print

`#/<key>` opens a slide, `#/<key>/<step>` a build on it; old numeric links (`#/3`) still work. `?overview` opens in the overview, `?presenter` is the presenter window, `?edit` opens the editor, `?print` lays every slide out for printing. Printing (and PDF) puts each shown slide on its own 1280 × 720 page, fully built. `?capture` is what the engine's headless tools use: no motion, no transitions, no navigation chrome.

## Presenter view

P opens it in a second window; the windows stay in sync (slide, build, blackout) from `file://` or a server. Previous, current and next slides sit across the top, notes below. The header shows the slide number, the session's length (editable, remembered per browser until the deck's own length changes), the time each slide gets, a pace line ("Plan 12 min · 2 min behind"), the timer (it starts on the first move; Pause, Reset) and the clock. Drag a border to resize panes (double-click resets); `[` and `]` hide the sidebars; `+` and `-` size the notes text. Pane sizes are remembered per browser.

## Overview

O shows every slide as a thumbnail, grouped under section dividers (`data-divider`, or the older class `layout-section`); slides before the first divider are "Opening". Click a slide to go there; arrows move between thumbnails, Enter goes, Esc or O closes. With lanes, a switcher opens the same slide in another lane, and each thumbnail carries the lane's colour where the lane changes it. While editing, every slide is shown, hidden ones under a mask, with tools to hide, delete and drag to reorder (H, Del, Shift+arrows on a focused thumbnail).

## Pacing and notes

`"sessions": { "Session 1": 60 }` in the settings sets each session's length in minutes (`""` is the session of slides without `data-session`). Each in-run slide (run `default` or `cut-first`, not hidden) gets an equal share. `check` prints the pacing summary.

Notes are the text of `<aside class="notes">`: blank lines split paragraphs, `- ` lines form a list, `**bold**` and `*italic*` mark emphasis, `[pause]` marks a beat. The presenter and the drawer render that markup; PowerPoint export carries the text with the cue line above it.

## Editor

E loads the editor from the plugin. A bar along the top and a panel along the bottom appear; the slide re-fits between them.

| Action | How |
|---|---|
| Format text | the bar over the selection: bold, italic, underline (Cmd/Ctrl+B, I, U), code, link (Cmd/Ctrl+K), font (the brand's sans, serif, mono), size (A− A+), colour, alignment, Clear. Colour opens the brand's colours (every `--color-*` the theme declares, round the colour wheel and then the neutrals dark to light, each named as the brandbook names it; saved as the variable, so they follow the brand), recent custom colours, a hex field, the browser's picker (the rainbow circle) and, in Chrome, an eyedropper; custom colours are saved as hex. With words selected while typing it formats those words; otherwise the whole element. The bar says which (Words or Element) |
| Edit text | double-click any text (or select and press Enter); Esc cancels, Enter commits single lines, Shift+Enter breaks a line; paste is plain text |
| Select | click an element; Alt+click or Parent selects the parent; Esc clears |
| Move | drag (snaps to slide edges, centres and other elements; Alt drag skips snapping), or arrows (Shift: 10 px) |
| Resize | corner handles: width (pictures keep their ratio); Alt drag also sets the height; Shift drag scales uniformly |
| Pin | "Pin in place" makes the element absolutely positioned where it is |
| Reset | removes the element's position and size edits |
| Delete | Del, or the Delete button |
| Notes | the notes panel (the same one N shows) turns editable while editing; drag its top edge to make it taller, double-click to reset; one height for both, remembered per browser |
| Side column | Hide folds the comment and selection column to a tab, so the notes take the width; the tab opens it again |
| Navigate | the navigation pill stays above the notes panel; its overview opens below the editor's bar with the notes panel hidden, with hide, delete and drag to reorder |
| Comment for Claude | the panel's comment box; saved as `<!-- @claude: … -->` in the slide |
| Structure | the overview (O): hide, delete, drag to reorder; Duplicate slide in the bar |
| Undo | Cmd/Ctrl+Z |
| Save | S, or Save; also automatic after each edit |
| Folder | the chip at the left of the bar: a dot (amber not connected, green a folder, blue the local server) and the folder's name; point at it for the full location, the last save, Connect or Change folder, and Copy path |
| Build | B: rebuilds every lane file and runs the checks (overflow, footer band) |
| Copy | the unsaved edits as JSON, for Claude, where a browser can't save |
| Discard | drops every unsaved edit |
| Done | E |

A move is stored on the element as `translate` (an offset from where the layout puts it); a pinned element stores `left` and `top`; sizes are `width`, `height` or `scale`. These don't interfere with motion.

**Saving.** Through `serve` (the default when Claude hands a deck over for editing) saving needs nothing. Opened from the file, the first save asks Chrome (or Edge, Brave) for the deck folder, once per browser session; the folder is remembered per deck. A page can't open the picker at its own folder, so the editor names the folder and copies its path (on a Mac, Cmd+Shift+G in the picker, then paste); the picker reopens where this deck's folder was chosen last, and a folder holding another deck is refused. Every edit is recorded against the slide's key and the element's id (or its position among its parent's elements), applied to the page at once, and replayed onto the file when saving: the editor re-reads `index.html`, applies the edits, and writes back only the slides they touched. If the file changed meanwhile (Claude edited it), the edits go onto that version; an edit whose element is gone stays pending and the bar says so. Saving the base rebuilds every lane file. Unsaved edits survive a reload in the browser's storage; the editor offers to save or drop them next time.

**Lanes.** The lane picker in the bar shows a lane. Edits there are written to `lanes/<id>.json` as overrides (by id when the element has one), never to the base; notes, comments, deleting and reordering happen in the base view.

**Claude's changes.** While the folder is connected, the editor watches the file; when it changes, the page reloads on the same slide (saving pending edits first).

**Other browsers.** Safari and Firefox can't write files from a page; they save through `serve`, as every browser does there.

**A recipient's copy.** On a machine without the plugin, E shows a short note and nothing else loads.

## For the engine's tools

`window.SW` is the runtime's API: `slides()`, `allSlides()`, `current()`, `index()`, `step()`, `steps(slide)`, `stepsLeft()`, `go(i, step | "end")`, `next()`, `prev()`, `builds(on)`, `pause(on)`, `on(type, fn)` (`ready`, `change`, `pause`, `layout`, `refresh`), `key(spec, fn)`, `keys()`, `layout()`, `host(el, { align })`, `scale()`, `refresh()`, `expand(root)`, `asset(name)`, `cloneSlide(slide)`, `measure()`. Everything the runtime adds to the page is marked (`sw-` classes, `data-sw-` attributes, `--sw-` properties), and the editor strips it, so it never reaches the file.
