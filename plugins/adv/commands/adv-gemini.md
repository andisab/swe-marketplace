---
description: Send a prompt to Gemini CLI and return the response
argument-hint: "<prompt>"
allowed-tools: Bash
---

If `$ARGUMENTS` is empty, respond with: "Usage: `/adv-gemini <prompt>` — provide a prompt to send to Gemini."

Otherwise, run the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh" --engine gemini --cwd . --prompt "$ARGUMENTS"
```

If the command fails (exit code non-zero), show the error type from the JSON status line and the last 5 lines of `.claude/reviews/.tmp/dispatch.log` for debugging. Otherwise, present the Gemini response directly — do not summarize or reformat it.
