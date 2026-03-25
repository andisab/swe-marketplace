---
description: Send a prompt to Codex CLI and return the response
argument-hint: "<prompt>"
allowed-tools: Bash
---

If `$ARGUMENTS` is empty, respond with: "Usage: `/adv-codex <prompt>` — provide a prompt to send to Codex."

Otherwise, run the following command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/dispatch/scripts/dispatch.sh" --engine codex --cwd . --prompt "$ARGUMENTS"
```

If the command fails (exit code non-zero), show the error type from the JSON status line and the last 5 lines of `.claude/reviews/.tmp/dispatch.log` for debugging. Otherwise, present the Codex response directly — do not summarize or reformat it.
