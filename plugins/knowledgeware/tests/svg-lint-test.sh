#!/usr/bin/env bash
# Tests chartware's svg-lint.py: every shipped template passes, and a deliberately
# broken diagram trips each geometry check once. Needs only python3.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CW="$HERE/../skills/chartware"
LINT="$CW/scripts/svg-lint.py"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
n_ok=0; n_bad=0
ok()   { echo "ok   $1"; n_ok=$((n_ok+1)); }
bad()  { echo "FAIL $1"; n_bad=$((n_bad+1)); }

# 1. Every template is clean (no errors, no warnings)
for f in "$CW"/templates/svg/*.svg; do
  [[ "$(basename "$f")" == "icons.svg" ]] && continue   # the sprite is symbols only, not a chart
  out=$(python3 -I "$LINT" --quiet "$f" 2>&1) && rc=0 || rc=$?
  if [[ $rc -eq 0 ]] && ! grep -q "^warn" <<<"$out"; then ok "template $(basename "$f") is clean"; else bad "template $(basename "$f"): $out"; fi
done

# 2. A broken diagram: diagonal edge, shared attach point, overlapping edges, an edge through a
#    node, a label on a line, a node outside the viewBox, a small font, a missing marker, a
#    duplicate id, a tspan without x, and more nodes than the budget allows.
cat > "$WORK/bad.svg" <<'EOF'
<svg viewBox="0 0 600 300" width="600" height="300" xmlns="http://www.w3.org/2000/svg" class="cw-dg" role="img" aria-labelledby="t d">
  <title id="t">Broken</title><desc id="d">Every rule broken once.</desc>
  <style>.cw-dg .node{fill:#fff;stroke:#999}.cw-dg .edge{fill:none;stroke:#999}.cw-dg .lbl{font-size:13px;text-anchor:middle}.cw-dg .elbl{font-size:11px}.cw-dg .tiny{font-size:8px}</style>
  <rect class="node" x="40" y="40" width="120" height="48" rx="8" id="dup"/>
  <rect class="node" x="240" y="40" width="120" height="48" rx="8" id="dup"/>
  <rect class="node" x="440" y="40" width="120" height="48" rx="8"/>
  <rect class="node" x="40" y="160" width="120" height="48" rx="8"/>
  <rect class="node" x="240" y="160" width="120" height="48" rx="8"/>
  <rect class="node" x="440" y="160" width="120" height="48" rx="8"/>
  <rect class="node" x="40" y="240" width="120" height="48" rx="8"/>
  <rect class="node" x="240" y="240" width="120" height="48" rx="8"/>
  <rect class="node" x="440" y="240" width="120" height="48" rx="8"/>
  <rect class="node" x="560" y="270" width="120" height="48" rx="8"/>
  <!-- diagonal -->
  <path class="edge" d="M160,64 L240,184" marker-end="url(#missing)"/>
  <!-- two edges from the same attach point, overlapping -->
  <path class="edge" d="M100,88 L100,160"/>
  <path class="edge" d="M100,88 L100,160"/>
  <!-- transit: runs straight through the middle node -->
  <path class="edge" d="M160,64 L440,64"/>
  <!-- label sitting on an edge -->
  <text class="elbl" x="300" y="68" text-anchor="middle">on the line</text>
  <text class="lbl" x="90" y="68">Off centre<tspan dy="1.25em">no x</tspan></text>
  <text class="tiny" x="40" y="130">too small</text>
</svg>
EOF
out=$(python3 -I "$LINT" "$WORK/bad.svg" 2>&1) && rc=0 || rc=$?
[[ $rc -eq 1 ]] && ok "broken diagram fails the lint" || bad "broken diagram exit code $rc"
for code in diagonal attach overlap transit label clip text marker ids budget; do
  grep -q " $code " <<<"$out" && ok "reports $code" || bad "did not report $code: $out"
done
grep -q "aria-labelledby names" <<<"$out" && bad "false root error" || ok "root wiring accepted"

# 3. A translate()d chart group is read in page coordinates (no false clip errors)
cat > "$WORK/chart.svg" <<'EOF'
<svg viewBox="0 0 200 100" width="200" height="100" xmlns="http://www.w3.org/2000/svg" class="cw-x" role="img" aria-labelledby="t d">
  <title id="t">Chart</title><desc id="d">Two bars.</desc>
  <g transform="translate(40,10)"><rect x="0" y="0" width="20" height="60"/><text x="-8" y="60" text-anchor="end" font-size="11">0</text></g>
</svg>
EOF
python3 -I "$LINT" --quiet "$WORK/chart.svg" >/dev/null && ok "translated plot group is not flagged as clipped" || bad "translate() handling"

echo "svg-lint-test: $n_ok passed, $n_bad failed"
[[ $n_bad -eq 0 ]]
