# Privacy

This page covers every plugin in the swe-marketplace repository. Last updated 2026-10-24.

**The plugins collect nothing.** They are instructions, scripts and templates that run inside Claude Code, Claude Desktop or claude.ai on your machine or in your Claude session. They have no server of their own, send no telemetry, keep no logs anywhere but in the files they write for you, and read no credential, token or key from your environment or files.

**What leaves your machine, and to whom.** Each request goes to the model provider you already use:

- Everything you type and every file Claude reads goes to Anthropic through your own Claude account or API key, as in any Claude session. Anthropic's handling of that data is set by [Anthropic's privacy policy](https://www.anthropic.com/privacy), not by these plugins.
- **adv** also sends the code under review to OpenAI through Codex CLI and to Google through Gemini CLI, each under your own account with that service, and only when you run a review or one of its commands. The [adv README](./plugins/adv/README.md#questions-and-troubleshooting) lists the calls.
- **knowledgeware** fetches the pinned draw.io MCP server from the npm registry, fonts from Google Fonts, Mermaid from jsDelivr, and the one URL you ask it to download, as its README's [What it runs, and what leaves your machine](./plugins/knowledgeware/README.md#what-it-runs-and-what-leaves-your-machine) section describes.
- **research-team** runs web searches and fetches the pages they return, through Claude's own WebSearch and WebFetch tools.
- The agent packs, **context-engineering** and the rest run no scripts and make no network requests of their own.

**What stays on your machine.** Reports, decks, sites, diagrams and research notes are written where you ask, under your own folders, and nothing is uploaded unless you share it.

**Questions.** Open an [issue](https://github.com/andisab/swe-marketplace/issues).
