# Workflow

Two paths — pick by deck stakes.

## Fast path (1-3 slides, throwaway)

```bash
mkdir my-deck && cd my-deck
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js style-1 -o ./style.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/assets/templates/{build-deck.js,slides.js,package.json} .
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
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js style-N -o ./style.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/assets/templates/{build-deck.js,slides.js,package.json} .
npm install

# 2. Plan layouts — pick from references/layout-patterns.md, vary across the deck

# 3. Author slides.js — one descriptor per slide

# 4. Build
node build-deck.js .

# 5. Polish check
python ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/polish-deck.py ./index.html

# 6. Render to PNGs
bash ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/render-slides.sh ./index.html ./preview/

# 7. Inspect every PNG at full size. Find ≥1 issue per slide.

# 8. Iterate: edit slides.js or style.md, rebuild, re-render, re-inspect.
#    Stop when an inspection finds zero meaningful issues — typically 2-3 cycles.
```

## Choosing a style

If the user names one (`style-2`, a brandbook like `provectus`, etc.), use it — names resolve from the plugin registry (`styles/` + `styles/brands/`).

If they describe an aesthetic ("warm, editorial, serif headings") or point to a website, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js <path-or-name> -o ./style.md
```

If they say nothing, default to `style-1` (Editorial Light) and tell them so. Offer to switch.

## Mid-build style swap

If you decide partway through that the chosen style is wrong:

1. Re-stage a different style: `node ${CLAUDE_PLUGIN_ROOT}/skills/slideware-revealjs/scripts/load-style.js <new> -o ./style.md`
2. Re-build: `node build-deck.js .`
3. Re-render PNGs and re-inspect.

Slide content doesn't change — only the theme CSS and font loading do.

## What "done" looks like

- All slides render in a browser at 1280×720 with no visible overflow.
- Layouts are varied per the anti-monotony rule (see SKILL.md).
- Type hierarchy is visible at a glance: hero/title/body sizes feel distinct.
- Palette is consistent — no rogue colors outside the brandbook.
- Network tab on first load shows exactly: Google Fonts + Reveal CDN. Nothing else.
- The output `index.html` opens cleanly when copied to a different directory (proves self-containment).
