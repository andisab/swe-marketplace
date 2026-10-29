#!/usr/bin/env bash
# Validate the marketplace manifest and every plugin manifest with `claude plugin validate`,
# and check that agents name only real tools.
# Fails on any error or warning.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found on PATH" >&2
  exit 2
fi

failed=0

# `claude plugin validate` doesn't check agent tool names; this does.
if ! python3 scripts/check-agent-tools.py; then
  failed=1
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
