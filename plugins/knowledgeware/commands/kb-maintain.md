---
description: Run a maintenance sweep on a knowledgebase site — verify due volatile facts against primary sources, apply confirmed deltas, log the changelog, report drift. Designed for weekly scheduled (headless) runs.
argument-hint: "<site-dir> [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent
---

Run a maintenance sweep against the knowledgebase site at: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/agents/kb-maintainer.md` and execute its runbook **in this session** (not as a subagent — you need the Agent tool to fan out research subagents, which run on Sonnet). The governing contract is `${CLAUDE_PLUGIN_ROOT}/skills/knowledgebase/references/maintenance.md`; its §5 protocol is binding.

Summary of what you will do (the runbook is authoritative):
1. Parse the site's maintenance page — the master volatility table is your work order.
2. Compute the due-list by cadence. Touch nothing that is not due.
3. Fan out research subagents on Sonnet, clustered by authoritative source.
4. Apply confirmed deltas surgically: research file → fan-out pages → earned stamps → one changelog row. With `--dry-run`, report instead of writing.
5. Report drift as suggestions only — never restructure or rewrite the site.

If `$ARGUMENTS` is empty, ask for the site directory rather than guessing.

## Scheduling recipe

Weekly headless run (cron, launchd, or any scheduler):

```bash
claude -p "/knowledgeware:kb-maintain '/path/to/site'" \
  --permission-mode acceptEdits --model opus
```

Add `--dry-run` inside the quoted command for a report-only pass. Point one job per site; the sweep is self-scoping, so running it more often than weekly is safe — non-due rows are skipped, and a no-delta sweep still writes its changelog row.
