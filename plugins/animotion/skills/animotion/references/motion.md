# Motion

Values come from the visual language's `motion` block (as `--am-*` tokens in the kit); these are the defaults when it sets none, and the rules for using them. They follow the published motion systems (Material 3, Carbon, Fluent, Atlassian, Primer), which all share one shape: a duration scale on a 50 ms grid, easing by role, and two personalities.

## Tokens

| Token | Default | Used for |
|---|---|---|
| `--am-dur-xs` | 150 ms | colour and state flips, badges, caret |
| `--am-dur-sm` | 250 ms | small enters and exits, fades, ticks |
| `--am-dur-md` | 400 ms | default enter (exit takes 0.7 × this), tweens, clones |
| `--am-dur-lg` | 600 ms | long travel, moves, counters |
| `--am-dur-xl` | 900 ms | the signature move, drawing a long path, a camera move |
| `--am-ease-enter` | `out` | things arriving: decelerate |
| `--am-ease-exit` | `in` | things leaving: accelerate |
| `--am-ease-move` | `inOut` | things travelling while on screen |
| `--am-ease-effect` | `cubic-bezier(0.33, 0, 0.67, 1)` | opacity and colour; never overshoots |

Without tokens the built-in defaults are close to these (enter 0.45 s, exit 0.3 s, move 0.6 s, count 0.8 s, draw 0.9 s). The `expressive` personality (default for slides: watched, not operated) uses the values above; `productive` (dense technical decks) uses 100 / 150 / 250 / 400 / 600 ms, flatter curves and no bounce.

## Rules

1. **Duration follows distance and size.** Pick a step by how far and how big. Exits run at about 0.7 × the entrance. Nothing over 1 s except drawing a long path or a deliberate camera move.
2. **Move, then hold.** Every beat is a short motion followed by a hold long enough to read it: at least 1 s, plus about 0.6 s per line of new text. Too long is rarer than too short.
3. **Ease by role.** Entrances decelerate, exits accelerate, travel uses the move curve, opacity and colour use the effect curve, typing and counters and progress run linear or out. Never ease-in on an entrance.
4. **Cast before timing.** One lead per beat; at most two support groups move with it; decoration only fades; everything else is still. If two things want to lead, split the beat.
5. **Spatial honesty.** Things enter from their cause and leave toward where they go: clones fly out of their source, a finding appears after the input that caused it. Exits mirror their entrances. Unrelated content fades; it doesn't slide.
6. **Stagger by importance.** 70 ms steps by default, the whole stagger under about 0.6 s; order follows reading order or cause. The lead travels, support travels less, decoration fades in place.
7. **Motion must carry meaning.** With motion off, would the explanation feel broken? If not, the motion is decoration: keep it small and rare, or use slideware's `data-a` instead of a scene.
8. **Nothing from zero.** Enter from scale 0.95 (subtle) or 0.82 (pop) with opacity, origin toward the cause; never from scale 0.
9. **Physics only where physical.** Landings, hops and drops get `spring` or `pop`; data, text and UI don't bounce. Overshoot only reads over a large range. Anticipation and follow-through belong to the signature move alone.
10. **One model, transformed.** Reuse the same drawn objects across beats and change them; don't cut to a new drawing when a transform would show the relationship.
11. **Words say why, motion shows how.** On-slide text carries what motion can't (the reason, the number); motion shows where and how. In a deck, the presenter's click is the clock: use `trigger="steps"` when the talk needs to pause between beats.
12. **Reduce, don't remove.** Reduced motion shows the poster; pick a poster that tells the story without the motion.

## Choreographing a scene

- **Beats**: 3 to 6 per scene. Each gets a label; the poster is usually the last resolved beat, not the end of the timeline (which may be a hold or a reset).
- **Length**: under 20 s; a looping scene 6–15 s, holding 1.5 s before it resets.
- **Signature move**: one per language (pop, hop, draw, wipe). Use it for the lead of the key beat, not for everything.
- **Concurrency**: count the groups moving at any instant on the contact sheet (`--at every=0.5`); more than three reads as noise.
- **Text**: type only what the audience should read as it appears (a prompt, a command); set the rest at once. Typing faster than 40 characters a second reads as a blur: for long strings, type a prefix and `set` the rest.
