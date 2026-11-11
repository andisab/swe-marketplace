---
animotion: 1
idiom: blocky
principles: [engineered, warm, plain]
unit: 8
radius: [0, 2]
strokes: [1, 2]
fills: flat
shadow: ground-ellipse
tints: [100, 60, 30]
fidelity: low
motion:
  personality: expressive
  dur: { xs: 150, sm: 250, md: 400, lg: 600, xl: 900 }
  ease: { enter: "cubic-bezier(0.05, 0.7, 0.1, 1)", exit: "cubic-bezier(0.3, 0, 0.8, 0.15)", move: "cubic-bezier(0.2, 0, 0, 1)", effect: "cubic-bezier(0.33, 0, 0.67, 1)" }
  signature: pop
  stagger: 70
  concurrency: 3
sources: []
references: []
---

## Principles
- Engineered: every drawn edge sits on the 8 px grid; no curves except state badges (circles).
- Warm: the accent carries the subject; neutrals are warm greys.
- Plain: no gradients, no outlines on drawn shapes, one ground shadow under characters.

## Emphasis
- 100% accent: the subject of the beat (the lead agent, the bar that matters).
- 60% (`--am-tint-60`): secondary or "many of" (sub-agents, other bars).
- 30% (`--am-tint-30`): background shapes and tracks not yet travelled.

## States
| State | Drawn as (kit class) |
|---|---|
| ok | `.am-badge[data-state=ok]`: green circle, white check |
| warn | `.am-badge[data-state=warn]`: amber circle, `!` |
| error | `.am-badge[data-state=error]`: red circle, `!` |
| pending | `.am-badge[data-state=pending]`: grey ring |
| idle | `.am-badge[data-state=idle]`: short accent bar |

## Ladder
- Document: `.am-doc` card, grey bars of varying length (greeked).
- List: `.am-row` items: a dot and a greeked bar, or real short text.
- App: `.am-window` with `.am-window-bar` (three dots and a URL pill) and plain minimal HTML inside.
- Agent: the kit's sprite, `<i class="am-agent" data-am-sprite="agent:neutral"></i>`; sub-agents add `am-sub` (60% tint); beyond 12 agents on screen, the extra ones also take `scale: 0.6`.
- Person: `<svg><use href="#am-person"/></svg>`, grey.
- Message: `.am-bubble`, white box, 1 px border, pointer below.

## Characters
- Agent: the kit's `agent` sprite, a block body with two ear nubs and four legs on a 16 × 8 grid; expression only in the eyes, through its poses `neutral` (dots), `happy` (^ ^) and `waiting` (dashes), swapped with `s.pose`; identity through accessories; rank through scale and tint.

## Type roles
- Labels: `var(--font-sans)`. Machine text (URLs, commands, counts like "~10 agents"): `var(--font-mono)`.
- A title highlights one phrase in the accent.

## Motion
- Signature: `pop` for the lead of the key beat; clones fly out of their source.
- Agents hop (arc 24–40 px, land with `spring`); nothing else bounces.
- Hold at least 1 s after each beat.

## Density
- At most 12 agents drawn full size; more become 60% sub-agents.
- One focal point per beat.

## Do not reproduce
- No third-party mascots or logos.

## Credits
- None.
