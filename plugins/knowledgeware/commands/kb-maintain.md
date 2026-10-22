---
description: Deprecated alias for `/knowledgeware:librarian sweep` — runs a maintenance sweep on one knowledgebase site. Kept so existing scheduled jobs keep working; switch them to the librarian command.
argument-hint: "<site-dir> [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent
---

Run a maintenance sweep against the knowledgebase site at: $ARGUMENTS

This command is a deprecated alias for `/knowledgeware:librarian sweep`. Read `${CLAUDE_PLUGIN_ROOT}/agents/librarian.md` and execute its **sweep** runbook (Phases 0–5) **in this session**, exactly as `/knowledgeware:librarian sweep $ARGUMENTS` would. If `$ARGUMENTS` is empty, ask for the site directory rather than guessing.

End the run report with one line noting that `/knowledgeware:kb-maintain` is deprecated, and the command to schedule instead:

```bash
claude -p "/knowledgeware:librarian sweep '/path/to/site'" --permission-mode acceptEdits --model opus
```
