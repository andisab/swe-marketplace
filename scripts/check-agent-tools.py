#!/usr/bin/env python3
"""Fail when an agent's tool grant is missing or names a tool its users won't have.

`claude plugin validate` doesn't check tool names, and an agent can't use a
tool that doesn't exist: one listing `MultiEdit` but not `Edit` can only
rewrite whole files. This script catches those before they ship -- used by CI,
validate-all.sh and nothing else. Three rules, per agent:

1. It has a `tools:` or `allowed-tools:` line. Without one an agent gets every
   tool, MCP tools included, which no agent here needs.
2. Every built-in name is one Claude Code has (KNOWN_TOOLS), optionally with a
   specifier such as `Bash(git:*)`.
3. Every `mcp__<server>__...` name belongs to a server its own plugin declares
   in the catalog's `mcpServers` (as `<server>` or the plugin-installed form
   `plugin_<plugin>_<server>`), or to one of OPTIONAL_MCP_SERVERS, which an
   agent may use when the user has it and must work without.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG = REPO_ROOT / ".claude-plugin" / "marketplace.json"

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

# MCP servers no plugin ships, that an agent may call when the user has them.
# Each needs a README section saying how to add it and what the agent does without it.
OPTIONAL_MCP_SERVERS = {
    "conventions": "context-engineering's agent searches conventions-mcp for examples (README: Optional: conventions-mcp)",
}

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
TOOLS_LINE = re.compile(r"^(?:allowed-)?tools:[ \t]*(.*)$", re.MULTILINE)   # agents use either key
SPECIFIER = re.compile(r"^(\w+)\(.*\)$")
MCP_NAME = re.compile(r"^mcp__(.+?)__")


def declared_servers() -> dict[str, set[str]]:
    """Plugin name -> the MCP server names its agents may call."""
    plugins = json.loads(CATALOG.read_text())["plugins"]
    servers = {}
    for p in plugins:
        own = set(p.get("mcpServers") or {})
        servers[p["name"]] = own | {f"plugin_{p['name']}_{s}" for s in own}
    return servers


def problems_in(line: str, allowed_servers: set[str]) -> list[str]:
    bad = []
    for name in (t.strip() for t in line.split(",")):
        if not name:
            continue
        if name.startswith("mcp__"):
            server = MCP_NAME.match(name)
            if not server or (server.group(1) not in allowed_servers and server.group(1) not in OPTIONAL_MCP_SERVERS):
                bad.append(f"{name} (server not declared by this plugin)")
            continue
        specified = SPECIFIER.match(name)
        if (specified.group(1) if specified else name) not in KNOWN_TOOLS:
            bad.append(name)
    return bad


def main() -> int:
    servers = declared_servers()
    agents = sorted(REPO_ROOT.glob("plugins/*/agents/*.md"))
    problems = []
    for path in agents:
        plugin = path.parent.parent.name
        frontmatter = FRONTMATTER.match(path.read_text())
        lines = list(TOOLS_LINE.finditer(frontmatter.group(1))) if frontmatter else []
        if not lines:
            problems.append((path.relative_to(REPO_ROOT), ["no tools: line (the agent would get every tool)"]))
        for line in lines:
            bad = problems_in(line.group(1), servers.get(plugin, set()))
            if bad:
                problems.append((path.relative_to(REPO_ROOT), bad))

    if problems:
        print("agents with a tool grant their users can't rely on:", file=sys.stderr)
        for path, bad in problems:
            print(f"  {path}: {', '.join(bad)}", file=sys.stderr)
        print(
            "\nUse Edit (not MultiEdit), Glob (not LS/Find), Bash (not Docker/Git),"
            " Agent (not Task).\nAn MCP tool needs its server in the plugin's mcpServers,"
            " or in OPTIONAL_MCP_SERVERS with a reason.",
            file=sys.stderr,
        )
        return 1
    print(f"all {len(agents)} agents state their tools and name only tools their users will have")
    return 0


if __name__ == "__main__":
    sys.exit(main())
