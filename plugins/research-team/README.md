# research-team

research-team turns one research question into a short, cited report. It splits the topic into two to five subtopics, has a separate agent search the web for each one in parallel, and then has a writer agent combine their notes into a Markdown report of 500 to 800 words, optionally formatted for Joplin. Use it for questions that need several sources, such as comparing tools, surveying a market or catching up on a field.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install research-team --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install research-team@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **research-team**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

The coordinator starts only when you name the plugin in your request. Paste one of these into Claude Code:

- *"Use research-team to research vector database pricing."*
  The coordinator names the subtopics it picked and starts one researcher for each. When the writer finishes, the coordinator prints the report's path, such as `~/Documents/Claude/Research/reports/vector-database-pricing_summary_20261022.md`.
- *"research-team: compare Django, Flask and FastAPI for a new internal API."*
  Each framework becomes a subtopic, usually with one more for selection criteria. The report compares them with a citation for every claim.
- *"Use research-team to research the EU AI Act's obligations for model providers, for my Joplin notes."*
  Because the request mentions Joplin, the writer loads the `joplin-research` skill and follows its heading and table-of-contents rules. The report is still a `.md` file in the same `reports/` folder.

## How it works

1. **Split.** The coordinator creates a notes folder for this run, named after the topic and the date, such as `research_notes/quantum-computing_20261022/`. It picks two to five subtopics that don't overlap and gives each one a file name in that folder, such as `01_quantum-hardware.md`.
2. **Research.** It starts one `research-specialist` agent per subtopic, all at the same time. Each researcher runs 3 to 7 web searches, keeps the 3 to 5 most authoritative sources, and saves a note of 3 to 4 paragraphs with the source URLs.
3. **Check.** Each researcher ends its reply with a short `output-manifest` block that names the file it wrote. The coordinator confirms that every named file exists on disk, and it restarts a researcher once if its file is missing.
4. **Write.** One `research-report-writer` agent reads the notes in this run's folder and writes the report. The coordinator confirms that the report exists, then gives you its path.

The researchers run in parallel, so a run takes about as long as the slowest researcher plus the writer, not the sum of every researcher's time. A run starts up to six subagents on Sonnet (five researchers and the writer), and they count toward your usage like any other subagent work.

The coordinator is a skill rather than an agent because of how Claude Code runs agents. Every agent runs as a subagent, and a subagent can't start subagents of its own. A skill runs in your main conversation, so the coordinator can start the researchers and the writer itself.

## What's inside

| Component | Kind | What it does | Tools |
|---|---|---|---|
| `coordinator` | Skill | Splits the topic, starts and checks the agents, and reports the path. | `Task` (the Agent tool's former name, still accepted), `Bash` limited to `mkdir`, `Glob`, `Read` |
| `research-specialist` | Agent, Sonnet | Researches one subtopic through web search and saves a note. | `WebSearch`, `Write` |
| `research-report-writer` | Agent, Sonnet | Reads this run's notes and writes the report. | `Glob`, `Read`, `Write`, `Skill` |
| `joplin-research` | Skill | Formatting rules and templates for Joplin notes: technical surveys and rundowns, what's-new notes, and summaries of books, articles and whitepapers. | — |

The `joplin-research` description asks Claude to load it whenever a prompt mentions Joplin, so it also formats Joplin notes outside a research run. The `patterns/` folder documents the orchestration design, and `templates/` holds sample research requests, notes and reports for anyone changing the plugin.

## Requirements

The researchers and the writer are agents, so research-team needs Claude Code or Cowork in Claude Desktop. Chat in Claude Desktop and on claude.ai doesn't run plugin agents. The researchers search with the `WebSearch` tool, so a run also needs a session where that tool is available.

## Questions and troubleshooting

**Where do the notes and the report go?** Each run's notes go to a folder of their own under `~/Documents/Claude/Research/research_notes/`, such as `research_notes/vector-database-pricing_20261022/`, and reports go to `~/Documents/Claude/Research/reports/`. The coordinator creates the folders as it needs them. The paths are written into the coordinator skill and both agents, so to use another folder you have to change all three in your own copy of the plugin. Edits to the installed copy are replaced the next time the plugin updates.

**Why didn't "research X" start a research run?** The coordinator starts only when you name the plugin, as in "use research-team to …" or "research-team: …". That way a question that one web search can answer doesn't start six agents.

**Can notes from an earlier run end up in a new report?** No. The writer reads only the current run's folder. A second run on the same topic on the same day gets a new folder whose name ends in `-2`, and its report name ends in `-2` too, so it doesn't replace the first report. Nothing deletes old notes, so clear out `research_notes/` when you no longer need them. Versions before 1.2.4 kept every run's notes in one folder and could mix topics.

**What happens when a researcher fails?** The coordinator restarts each researcher whose note is missing, once. If a note is still missing after that, the coordinator doesn't start the writer. It tells you which subtopics failed and whether the researcher returned no manifest or named a file that isn't on disk. Run the request again to retry.

**How do I get the report into Joplin?** Mention Joplin in your request so the writer formats the report for Joplin. The plugin saves a Markdown file and doesn't create the note itself, so bring the file in with Joplin's Markdown import (**File → Import**).

**Can I get a longer report?** The writer aims for 500 to 800 words unless its instructions ask for a longer synthesis. Say in your request that you want a detailed report, so the coordinator can pass that on.

For installing, updates, context cost and safety, see the [marketplace FAQ](../../README.md#faq). To request a feature or report a problem, open an [issue](https://github.com/andisab/swe-marketplace/issues).

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). MIT license.
