---
description: Keep a library of knowledgeware deliverables current — status (what's due across sites and decks), plan (write a dated update plan), or sweep (verify and update one knowledgebase site). Sweeps are designed for weekly scheduled (headless) runs.
argument-hint: "status [library] | plan [library] | sweep <site-dir> [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent
---

Act as the knowledgeware librarian with these arguments: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/agents/librarian.md` and follow it **in this session** (not as a subagent — sweeps need the Agent tool to fan out research subagents, which run on Sonnet). The governing contract for sites is `${CLAUDE_PLUGIN_ROOT}/skills/knowledgebase/references/maintenance.md`; its §5 protocol is binding.

The first word of the arguments picks the mode:

- `status [library]` — report what's due across every site and deck in the library. Writes nothing.
- `plan [library]` — write `librarian-plan.md` at the library root: this week's sweeps, research shared across items, what's coming up, the backlog, and what needs a human.
- `sweep <site-dir> [--dry-run]` — maintain one knowledgebase site through the runbook: verify due facts, apply confirmed deltas, log the changelog, report drift as suggestions. `--dry-run` reports what would change and writes nothing.

The library is the folder given, else `$KNOWLEDGEWARE_LIBRARY`. If the arguments are empty or name no mode, ask which mode and folder rather than guessing.

## Scheduling recipe

Weekly headless runs (cron, launchd, or any scheduler): one sweep per site, plus a plan for the whole library.

```bash
claude -p "/knowledgeware:librarian sweep '/path/to/site'" --permission-mode acceptEdits --model opus
claude -p "/knowledgeware:librarian plan '/path/to/library'" --permission-mode acceptEdits --model opus
```

Sweeps are self-scoping, so running them more often than weekly is safe: rows that aren't due are skipped, and a no-delta sweep still writes its changelog row. Add `--dry-run` inside the quoted sweep command for a report-only pass.
