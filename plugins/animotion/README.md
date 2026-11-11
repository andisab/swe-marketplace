# animotion

animotion adds animated scenes to HTML you already make with Claude: a slideware deck, a knowledgebase page, any single-file page. A scene shows something happening (an agent multiplying into a team, a form failing on inputs nobody planned for, a chat driving a live app preview), built from the page's own HTML, CSS and SVG and played on one clock. It plays while it can be seen and otherwise rests on a chosen **poster** frame, which is also what printing, PDF and PowerPoint export, slide thumbnails and viewers who prefer reduced motion get.

**For a fuller, illustrated guide** (how it works, and how to prompt it for good results), open [README.html](./README.html) from the plugin folder in a browser; its opening scene runs on the plugin's own runtime.

Each scene is one isolated element, `<am-scene>`. Its markup and timeline live inside it, so the rest of the page is untouched and a scene can be copied from one page to another. Scenes follow a **visual language**: drawing rules, a kit of parts and motion timings, derived from your brand, a drawing style you pick, or a reference you point at.

## Install

In Claude Code (v2.1.275 or later):

```
/plugin install animotion --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install animotion@swe-marketplace
```

Needs Node 22 or newer. Checking scenes and drawing their frames also needs Chrome, Edge, Brave or Chromium. With slideware decks, install [knowledgeware](../knowledgeware/) too.

## Try it

The skill starts only when you ask for animation by name:

- *"Create an animated slide after the title of ./deck/index.html: one agent becomes a team of ten; each finishes with a check, one with a warning."*
- *"Animate this diagram in ./guide/pipeline.html: requests flow through the queue to three workers."*
- *"Derive an animotion visual language from https://example.com, then show me a specimen."*

Claude settles the visual language first (and shows you a specimen when it's new), builds each scene's final layout, writes its timeline, checks it in Chrome and reads a contact sheet of its frames before handing it over. A request for a simple reveal ("make these bullets fade in") gets slideware's click builds instead of a scene.

## What's inside

| Part | What it is |
|---|---|
| `skills/animotion/` | The skill: the workflow, the scene contract, the verbs, the visual-language spec, motion rules, how to use outside sources. |
| `runtime/animotion.js` | The runtime copied into each page that has a scene (about 65 KB, no dependencies). |
| `scripts/cli.js` | `inline` (add or refresh the runtime and the kit), `check [--render]`, `frames --sheet`, `list`, `sources`. |
| `index/sources.yaml` | A curated index of about 145 online sources: icon and illustration sets, character systems, palettes, motion systems, animation catalogues, exemplars, style-reference sites and extraction tools, each with its access and licence terms. Nothing is mirrored. [MAINTAINING.md](./index/MAINTAINING.md) says how it was built and how to re-check it. |

## Commands

```bash
AM=~/.claude/plugins/cache/swe-marketplace/animotion/<version>   # or this folder in a checkout
node $AM/scripts/cli.js inline page.html                      # add or refresh the runtime (and animotion/kit.html beside the page)
node $AM/scripts/cli.js check page.html --render              # static and in-browser checks
node $AM/scripts/cli.js frames page.html --scene team --sheet team.png   # a contact sheet: start, each label, end
node $AM/scripts/cli.js sources --idiom line --use fetch-embed # what the index offers for a drawing style
```

## How a scene behaves

| Where | What it does |
|---|---|
| A slideware deck, on its slide | plays from the start each time the slide comes up; click steps can drive it (`trigger="steps"`) |
| Another slide, thumbnails, the presenter window, print and export | shows the poster |
| Blackout or a hidden tab | freezes, then resumes |
| Any other page | plays when it scrolls into view |
| Reduced motion | shows the poster |

Each playing scene has a pause button (on hover); in a deck, `m` pauses or plays the current slide's scenes.

## Troubleshooting

- **The scene shows its final layout and doesn't move.** The runtime isn't in the page: run `inline`. Or the scene's timeline failed: `check` names the line.
- **`check --render` says the poster is blank.** The poster label sits before anything has entered; name a later label in `poster`.
- **Something moves to the wrong place.** Moves go to anchor elements measured in the authored layout; keep the template's layout final and let the timeline hide things.
- **A deck scene doesn't show in slideware's editor.** It does, as one element you can move and resize; edit its contents through Claude.
