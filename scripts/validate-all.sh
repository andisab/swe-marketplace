#!/usr/bin/env bash
# Validate the marketplace manifest and every plugin manifest with `claude plugin validate`.
# Fails on any error or warning.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found on PATH" >&2
  exit 2
fi

failed=0

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
