#!/usr/bin/env bash
# Everything CI checks, in one run: generated manifests in sync, the README's catalog tables,
# agent tool grants, shellcheck and ruff, every plugin's tests, and `claude plugin validate` on
# the marketplace and each plugin. Fails on any error or warning.

set -euo pipefail

cd "$(dirname "$0")/.."

# An inherited NODE_OPTIONS (cmux and some IDE terminals preload their own module) makes every
# node call here fail before it starts; nothing in this repo needs one.
unset NODE_OPTIONS

# Finder writes .DS_Store files into folders it shows. They're gitignored, so they never ship,
# but `claude plugin validate` reads the folder on disk and warns on each.
find plugins -name .DS_Store -delete

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found on PATH" >&2
  exit 2
fi

failed=0

# plugin.json is generated from marketplace.json; the README's catalog tables mirror it by hand.
if ! python3 scripts/synthesize-plugin-manifests.py --check; then
  failed=1
fi
if ! python3 scripts/check-readme-catalog.py; then
  failed=1
fi

# `claude plugin validate` doesn't check agent tool grants; this does.
if ! python3 scripts/check-agent-tools.py; then
  failed=1
fi

# Linters. CI installs both; locally a missing one is skipped with a note, not failed.
if command -v shellcheck >/dev/null 2>&1; then
  if git ls-files -z '*.sh' 'scripts/git-hooks/*' | xargs -0 shellcheck -S warning; then
    echo "shellcheck: OK"
  else
    failed=1
  fi
else
  echo "shellcheck: skipped (not installed; brew install shellcheck)"
fi
if command -v ruff >/dev/null 2>&1; then
  if ! ruff check --quiet . ; then
    failed=1
  else
    echo "ruff: OK"
  fi
else
  echo "ruff: skipped (not installed; brew install ruff)"
fi

run_validate() {
  local target="$1"
  local label="$2"
  local out
  if ! out=$(claude plugin validate "$target" 2>&1); then
    echo "=== $label: FAILED ==="
    echo "$out"
    failed=1
    return
  fi
  if echo "$out" | grep -qE '⚠|✖|warning|error'; then
    echo "=== $label: WARNINGS ==="
    echo "$out"
    failed=1
    return
  fi
  echo "$label: OK"
}

run_validate "." "marketplace"

# adv's dispatcher against fake engines (no accounts or network needed)
if ! bash plugins/adv/tests/dispatch-test.sh; then
  failed=1
fi

# knowledgeware's style registry: both layouts, shadowing, markers, loaders
if ! node plugins/knowledgeware/tests/registry-test.js; then
  failed=1
fi

# chartware's SVG geometry lint: templates pass, a broken diagram trips every rule
if ! bash plugins/knowledgeware/tests/svg-lint-test.sh; then
  failed=1
fi

# chartware's diagram digest and fidelity ledger
if ! bash plugins/knowledgeware/tests/diagram-digest-test.sh; then
  failed=1
fi

# slideware's HTML review flow: addressable markup, edits.json folded into slides.js, serve-deck.js
if ! node plugins/knowledgeware/tests/deck-review-test.js; then
  failed=1
fi

for dir in plugins/*/; do
  [ -d "$dir" ] || continue
  run_validate "$dir" "$(basename "$dir")"
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "validation failed" >&2
  exit 1
fi

echo
echo "all manifests passed"
