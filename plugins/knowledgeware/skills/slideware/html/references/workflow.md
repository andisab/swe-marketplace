# Workflow

Two paths — pick by deck stakes.

## Fast path (1-3 slides, throwaway)

```bash
mkdir my-deck && cd my-deck
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js style-1 -o ./style.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/assets/templates/{build-deck.js,presenter.js,review.js,slides.js,package.json} .
npm install
# Edit slides.js — replace placeholder content with yours
node build-deck.js .
open ./index.html   # macOS; xdg-open on Linux, start on Windows
```

Ship after `polish-deck.py` (or a visual scan) reports clean. No iteration loop.

## Full path (≥4 slides, anything shipped)

```bash
# 1. Scaffold
mkdir my-deck && cd my-deck
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js style-N -o ./style.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/assets/templates/{build-deck.js,presenter.js,review.js,slides.js,package.json} .
npm install

# 2. Plan layouts — pick from references/layout-patterns.md, vary across the deck

# 3. Author slides.js — one descriptor per slide

# 4. Build
node build-deck.js .

# 5. Polish check
python ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/polish-deck.py ./index.html

# 6. Visual review — prefer a browser MCP over the Puppeteer script (see FORMAT.md §Visual review):
#    a) Claude in Chrome or Playwright MCP: open the deck (file:// or `python3 -m http.server`),
#       screenshot each slide, advance with ArrowRight.
#    b) No browser MCP available (headless/CI):
#       bash ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/render-slides.sh ./index.html ./preview/

# 7. Inspect every slide capture at full size. Find ≥1 issue per slide.

# 8. Iterate: edit slides.js or style.md, rebuild, re-render, re-inspect.
#    Stop when an inspection finds zero meaningful issues — typically 2-3 cycles.

# 9. Hand-over for the user's own text and notes edits (optional): build with review mode and serve it.
#    node build-deck.js . --review        # or review: true next to slides in slides.js
#    node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/serve-deck.js .   # http://127.0.0.1:8010/
#    E in the deck edits text and notes, Shift+B saves edits.json and rebuilds; every build folds
#    edits.json into slides.js. See reveal.md §Review mode.
```

## Choosing a style

If the user names one (`style-2`, a brandbook like `acmecorp`, etc.), use it — names resolve through the plugin registry per SKILL.md §Style / brandbook resolution (the user's brands directory, the plugin's brands, the five styles).

If they describe an aesthetic ("warm, editorial, serif headings") or point to a website, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js <path-or-name> -o ./style.md
```

If they say nothing, the markers decide first (`.knowledgeware` in the project, then `DEFAULT`); with neither, `style-1` (Editorial Light), and tell them so. Offer to switch.

## Mid-build style swap

If you decide partway through that the chosen style is wrong:

1. Re-stage a different style: `node ${CLAUDE_PLUGIN_ROOT}/skills/slideware/html/scripts/load-style.js <new> -o ./style.md`
2. Re-build: `node build-deck.js .`
3. Re-render PNGs and re-inspect.

Slide content doesn't change — only the theme CSS and font loading do.

## What "done" looks like

- All slides render in a browser at 1280×720 with no visible overflow.
- Layouts are varied per the anti-monotony rule (see SKILL.md).
- Type hierarchy is visible at a glance: hero/title/body sizes feel distinct.
- Palette is consistent — no rogue colors outside the brandbook.
- Network tab on first load shows exactly: Google Fonts. Nothing else (Reveal is inlined).
- The output `index.html` opens cleanly when copied to a different directory (proves self-containment).
