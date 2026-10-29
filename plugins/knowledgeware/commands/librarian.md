---
description: Keep a library of knowledgeware deliverables current — status (what's due across sites and decks), plan (write a dated update plan), or sweep (verify one knowledgebase site and write an audit of proposed changes; --apply to edit the site). Sweeps are designed for weekly scheduled (headless) runs.
argument-hint: "status [library] | plan [library] | sweep <site-dir> [--apply [audit-file]] [--dry-run]"
allowed-tools: Read, Glob, Grep, WebFetch, WebSearch, Agent
---

Act as the knowledgeware librarian with these arguments: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/agents/librarian.md` and follow it **in this session** (not as a subagent — sweeps need the Agent tool to fan out research subagents, which run on Sonnet). The governing contract for sites is `${CLAUDE_PLUGIN_ROOT}/skills/knowledgebase/references/maintenance.md`; its §5 protocol is binding.

The first word of the arguments picks the mode:

- `status [library]` — report what's due across every site and deck in the library. Writes nothing.
- `plan [library]` — write `librarian-plan.md` at the library root: this week's sweeps, research shared across items, what's coming up, the backlog, and what needs a human.
- `sweep <site-dir>` — verify one knowledgebase site's due facts and write `librarian-audit-<date>.md` in its folder: every verdict with its source and every proposed edit as an exact old → new string. The site is untouched.
- `sweep <site-dir> --apply [audit-file]` — edit the site: with an audit file, apply its reviewed proposals (no new research); without one, research and apply in one run, then log the changelog and report drift as suggestions.
- `sweep <site-dir> --dry-run` — report what would change and write nothing.

The library is the folder given, else `$KNOWLEDGEWARE_LIBRARY`. If the arguments are empty or name no mode, ask which mode and folder rather than guessing.

## Scheduling recipe

Weekly headless runs (cron, launchd, or any scheduler): one sweep per site, which leaves an audit to review, plus a plan for the whole library, which lists the audits waiting.

```bash
claude -p "/knowledgeware:librarian sweep '/path/to/site'" --permission-mode acceptEdits --model opus
claude -p "/knowledgeware:librarian plan '/path/to/library'" --permission-mode acceptEdits --model opus
```

Then, after reading an audit: `claude -p "/knowledgeware:librarian sweep '/path/to/site' --apply '/path/to/site/librarian-audit-2026-10-27.md'"`. For a site you trust to be maintained unattended, schedule `sweep '<site>' --apply` instead and the edits land in the same run. Sweeps are self-scoping, so running them more often than weekly is safe: rows that aren't due are skipped, and a no-delta sweep still writes its audit (or, with `--apply`, its changelog row). Add `--dry-run` inside the quoted sweep command for a report-only pass.
