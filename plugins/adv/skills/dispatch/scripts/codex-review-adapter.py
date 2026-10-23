#!/usr/bin/env python3
"""Turn a `codex review` report into adv's finding format.

`codex review` prints a short summary, then a "Review comment:" list in which
every comment reads `- [P1] Title — /absolute/path:18-21` with the explanation
on the indented lines that follow (Codex CLI 0.163). adv's cross-examination
and synthesis expect one block per finding with File, Severity, Title and
Description, so this script rewrites the comments into that shape, makes the
paths relative to the repository and maps Codex's priorities to adv's tiers:
P0, P1 and P2 are defects Codex says should be fixed (🔴 Bug), P3 is a
low-impact issue (🟡 Nit). The original priority stays in the Severity line so
cross-examination can amend it. A report with no comments is passed through
unchanged.

Usage: codex-review-adapter.py [--root <repo dir>] < report.txt
"""
import argparse
import os
import re
import sys

COMMENT = re.compile(r"^- \[P(?P<p>[0-3])\]\s+(?P<title>.+?)\s+[—–-]+\s+(?P<path>\S+?):(?P<lines>\d+(?:-\d+)?)\s*$")
SEVERITY = {"0": "🔴 Bug", "1": "🔴 Bug", "2": "🔴 Bug", "3": "🟡 Nit"}


def relative(path, root):
    """Make an absolute path relative to root. Both are tried with and without symlinks
    resolved (on macOS a temp dir is /var/... to the shell and /private/var/... to realpath)."""
    if not root or not os.path.isabs(path):
        return path
    roots = {os.path.abspath(root), os.path.realpath(root)}
    for candidate in (path, os.path.realpath(path)):
        for r in roots:
            try:
                rel = os.path.relpath(candidate, r)
            except ValueError:
                continue
            if not rel.startswith(".."):
                return rel
    return path


def adapt(text, root):
    lines = text.splitlines()
    findings = []
    preamble = []
    current = None
    for line in lines:
        m = COMMENT.match(line)
        if m:
            current = {
                "priority": m.group("p"),
                "title": m.group("title").strip(),
                "path": relative(m.group("path"), root),
                "lines": m.group("lines"),
                "body": [],
            }
            findings.append(current)
        elif current is not None and (line.startswith("  ") or line.strip() == ""):
            current["body"].append(line.strip())
        elif current is not None:
            current = None  # text after the list (Codex's closing remarks)
            preamble.append(line)
        else:
            preamble.append(line)
    if not findings:
        return text
    summary = "\n".join(l for l in preamble if l.strip() and l.strip() != "Review comment:").strip()
    out = []
    if summary:
        out.append("## Codex review summary\n\n" + summary + "\n")
    for f in findings:
        body = " ".join(l for l in f["body"] if l).strip()
        out.append(
            f"### Finding: {f['title']}\n"
            f"- **File:** {f['path']}:{f['lines']}\n"
            f"- **Severity:** {SEVERITY[f['priority']]} (Codex P{f['priority']})\n"
            f"- **Title:** {f['title']}\n"
            f"- **Description:** {body or 'See title.'}\n"
        )
    return "\n".join(out).rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", default="", help="repository root to make paths relative to")
    args = ap.parse_args()
    root = args.root
    sys.stdout.write(adapt(sys.stdin.read(), root))


if __name__ == "__main__":
    main()
