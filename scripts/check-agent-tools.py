#!/usr/bin/env python3
"""Fail when an agent's `tools:` frontmatter names a tool Claude Code doesn't have.

`claude plugin validate` doesn't check tool names, and an agent can't use a
tool that doesn't exist: one listing `MultiEdit` but not `Edit` can only
rewrite whole files. This script catches those names before they ship -- used
by CI and validate-all.sh.

Allowed: the built-in tool names below, `mcp__*` names and wildcards, and
specifiers on a known tool such as `Bash(git:*)`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Tool names the subagent docs list (https://code.claude.com/docs/en/sub-agents).
# `Task` is the pre-v2.1.63 name for `Agent` and still resolves.
KNOWN_TOOLS = {
    "Agent", "Artifact", "AskUserQuestion", "Bash", "CronCreate", "CronDelete",
    "CronList", "Edit", "EndConversation", "EnterPlanMode", "EnterWorktree",
    "ExitPlanMode", "ExitWorktree", "Glob", "Grep", "LSP", "Monitor",
    "NotebookEdit", "PowerShell", "Read", "ScheduleWakeup", "SendMessage",
    "Skill", "SubagentHandback", "Task", "TaskCreate", "TaskGet", "TaskList",
    "TaskStop", "TaskUpdate", "TodoWrite", "ToolSearch", "WaitForMcpServers",
    "WebFetch", "WebSearch", "Workflow", "Write",
}

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
TOOLS_LINE = re.compile(r"^tools:[ \t]*(.*)$", re.M)
SPECIFIER = re.compile(r"^(\w+)\(.*\)$")


def unknown_tools(line: str) -> list[str]:
    bad = []
    for name in (t.strip() for t in line.split(",")):
        if not name or name.startswith("mcp__"):
            continue
        specified = SPECIFIER.match(name)
        if (specified.group(1) if specified else name) not in KNOWN_TOOLS:
            bad.append(name)
    return bad


def main() -> int:
    agents = sorted(REPO_ROOT.glob("plugins/*/agents/*.md"))
    problems = []
    for path in agents:
        frontmatter = FRONTMATTER.match(path.read_text())
        line = frontmatter and TOOLS_LINE.search(frontmatter.group(1))
        if line:
            bad = unknown_tools(line.group(1))
            if bad:
                problems.append((path.relative_to(REPO_ROOT), bad))

    if problems:
        print("agents name tools Claude Code doesn't have:", file=sys.stderr)
        for path, bad in problems:
            print(f"  {path}: {', '.join(bad)}", file=sys.stderr)
        print(
            "\nUse Edit (not MultiEdit), Glob (not LS/Find), Bash (not Docker/Git),"
            " Agent (not Task),\nand mcp__<server>__* for MCP servers such as Context7.",
            file=sys.stderr,
        )
        return 1
    print(f"all {len(agents)} agents name only known tools")
    return 0


if __name__ == "__main__":
    sys.exit(main())
