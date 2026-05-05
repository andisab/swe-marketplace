#!/usr/bin/env python3
"""Generate per-plugin plugin.json files from .claude-plugin/marketplace.json.

marketplace.json is the source of truth. For each entry under "plugins", this
script writes <source>/.claude-plugin/plugin.json with the marketplace-only
fields stripped. Run with --check to fail (without writing) when any generated
file would differ from what's on disk -- used by CI to catch drift.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE_MANIFEST = REPO_ROOT / ".claude-plugin" / "marketplace.json"

# Fields that belong only in marketplace.json -- stripped from plugin.json.
# `claude plugin validate` warns when any of these appear in plugin.json.
MARKETPLACE_ONLY_FIELDS = {"source", "category", "strict"}


def synthesize_plugin_manifest(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in MARKETPLACE_ONLY_FIELDS}


def plugin_manifest_path(entry: dict) -> Path:
    source = entry.get("source")
    if not source:
        raise ValueError(f"plugin entry {entry.get('name')!r} has no 'source' field")
    return (REPO_ROOT / source / ".claude-plugin" / "plugin.json").resolve()


def render(manifest: dict) -> str:
    return json.dumps(manifest, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if any plugin.json is missing or out of sync; do not write",
    )
    args = parser.parse_args()

    catalog = json.loads(MARKETPLACE_MANIFEST.read_text())
    plugins = catalog.get("plugins", [])
    if not plugins:
        print(f"no plugins found in {MARKETPLACE_MANIFEST}", file=sys.stderr)
        return 1

    drift: list[str] = []
    written = 0
    for entry in plugins:
        manifest = synthesize_plugin_manifest(entry)
        target = plugin_manifest_path(entry)
        rendered = render(manifest)

        if args.check:
            existing = target.read_text() if target.exists() else None
            if existing != rendered:
                drift.append(str(target.relative_to(REPO_ROOT)))
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_text() != rendered:
            target.write_text(rendered)
            written += 1

    if args.check:
        if drift:
            print("plugin.json files are out of sync with marketplace.json:", file=sys.stderr)
            for path in drift:
                print(f"  {path}", file=sys.stderr)
            print(
                "\nRun: python scripts/synthesize-plugin-manifests.py",
                file=sys.stderr,
            )
            return 1
        print(f"all {len(plugins)} plugin.json files are in sync")
        return 0

    print(f"synthesized {len(plugins)} plugin manifests ({written} updated)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
