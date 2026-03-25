---
description: Deep research query via Gemini with Google Search grounding
argument-hint: "<research question>"
allowed-tools: Bash
---

If `$ARGUMENTS` is empty, respond with: "Usage: `/adv-gemini-research <question>` — provide a research question for Gemini with Google Search grounding."

Otherwise, run the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh" --engine gemini --research --cwd . --prompt "$ARGUMENTS"
```

This uses Gemini's grounded search capability for research queries that benefit from current web information. If the command fails (exit code non-zero), show the error type from the JSON status line and the last 5 lines of `.claude/reviews/.tmp/dispatch.log` for debugging. Otherwise, present the Gemini response directly — do not summarize or reformat it.
