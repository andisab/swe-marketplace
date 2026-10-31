#!/usr/bin/env python3
"""Fail when the README's catalog tables disagree with marketplace.json.

The README lists every plugin with its version in the Catalog tables
(`| [`name`](./plugins/name/) | 1.2.3 | ...`). The catalog is the source of
truth; this catches a version bumped in one and not the other, a plugin added
or removed in one only, and a row listed twice. Used by CI, validate-all.sh
and the pre-commit hook.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
ROW = re.compile(r"^\| \[`([\w-]+)`\]\(\./plugins/([\w-]+)/\) \| ([0-9][\w.-]*) \|", re.MULTILINE)


def main() -> int:
    catalog = {p["name"]: p["version"] for p in json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text())["plugins"]}
    rows = ROW.findall((ROOT / "README.md").read_text())
    problems = []
    seen = {}
    for name, folder, version in rows:
        if name != folder:
            problems.append(f"README row `{name}` links ./plugins/{folder}/")
        if name in seen:
            problems.append(f"README lists `{name}` twice")
        seen[name] = version
    for name, version in catalog.items():
        if name not in seen:
            problems.append(f"`{name}` {version} is in the catalog but not in the README's catalog tables")
        elif seen[name] != version:
            problems.append(f"`{name}` is {version} in the catalog but {seen[name]} in the README")
    for name in seen.keys() - catalog.keys():
        problems.append(f"README lists `{name}`, which isn't in the catalog")
    if problems:
        print("README.md is out of step with marketplace.json:", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        return 1
    print(f"README catalog tables match marketplace.json ({len(catalog)} plugins)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
