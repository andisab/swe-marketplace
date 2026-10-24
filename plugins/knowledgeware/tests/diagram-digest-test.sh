#!/usr/bin/env bash
# Tests chartware's diagram-digest.py: extraction from draw.io (plain and compressed), Mermaid,
# Excalidraw and a chartware SVG, and the fidelity ledger between an original and a redraw.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CW="$HERE/../skills/chartware"
DD="$CW/scripts/diagram-digest.py"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
n_ok=0; n_bad=0
ok()  { echo "ok   $1"; n_ok=$((n_ok+1)); }
bad() { echo "FAIL $1"; n_bad=$((n_bad+1)); }
jq_() { python3 "$HERE/json-eval.py" "$1"; }

# 1. draw.io, plain XML (the flow template): nodes, an edge label, a decision shape
out=$(python3 -I "$DD" extract "$CW/templates/flow.xml")
[[ "$(jq_ "d['stats']['nodes']" <<<"$out")" == "8" ]] && ok "draw.io: 8 nodes from flow.xml" || bad "draw.io node count: $out"
[[ "$(jq_ "[e['label'] for e in d['edges'] if e['label']]" <<<"$out")" == "['Yes', 'No']" ]] && ok "draw.io: edge labels Yes/No" || bad "draw.io edge labels"
[[ "$(jq_ "[n['shape'] for n in d['nodes'] if n['label']=='Data Valid?'][0]" <<<"$out")" == "rhombus" ]] && ok "draw.io: decision is a rhombus" || bad "draw.io shape"

# 2. draw.io, compressed <diagram> payload (deflate + base64 + urlencode, as draw.io saves by default)
python3 - "$CW/templates/flow.xml" "$WORK/flow.drawio" <<'EOF'
import sys, zlib, base64, urllib.parse
xml = open(sys.argv[1]).read()
c = zlib.compressobj(9, zlib.DEFLATED, -15)
payload = base64.b64encode(c.compress(urllib.parse.quote(xml, safe="").encode()) + c.flush()).decode()
open(sys.argv[2], "w").write(f'<mxfile host="test"><diagram id="x" name="Page-1">{payload}</diagram></mxfile>')
EOF
out2=$(python3 -I "$DD" extract "$WORK/flow.drawio")
[[ "$(jq_ "d['stats']" <<<"$out2")" == "$(jq_ "d['stats']" <<<"$out")" ]] && ok "draw.io: compressed file gives the same digest" || bad "compressed drawio"

# 3. Mermaid: direction, subgraph, labelled and dashed edges, chains, shapes
cat > "$WORK/arch.mmd" <<'EOF'
flowchart LR
  subgraph app [Application layer]
    GW[API Gateway] -->|REST| CORE[Agent Core]
    CORE -- MCP --> TOOLS[Tool Runtime]
  end
  GW -.->|publish| KAFKA[(Kafka)]
  CORE --> VEC[(Vector Store)] --> OBJ{Object Store?}
  classDef x fill:#fff
EOF
m=$(python3 -I "$DD" extract "$WORK/arch.mmd")
[[ "$(jq_ "d['direction']" <<<"$m")" == "LR" ]] && ok "mermaid: direction LR" || bad "mermaid direction"
[[ "$(jq_ "d['stats']['nodes']" <<<"$m")" == "6" ]] && ok "mermaid: 6 nodes" || bad "mermaid nodes: $m"
[[ "$(jq_ "d['stats']['edges']" <<<"$m")" == "5" ]] && ok "mermaid: 5 edges (chain split)" || bad "mermaid edges: $m"
[[ "$(jq_ "sorted(e['label'] for e in d['edges'] if e['label'])" <<<"$m")" == "['MCP', 'REST', 'publish']" ]] && ok "mermaid: edge labels in both syntaxes" || bad "mermaid labels: $m"
[[ "$(jq_ "[e['style'] for e in d['edges'] if e['label']=='publish'][0]" <<<"$m")" == "dashed" ]] && ok "mermaid: dotted edge is dashed" || bad "mermaid dashed"
[[ "$(jq_ "d['groups'][0]['label'] + ':' + str(len(d['groups'][0]['members']))" <<<"$m")" == "Application layer:3" ]] && ok "mermaid: subgraph with 3 members" || bad "mermaid subgraph: $m"
[[ "$(jq_ "[n['shape'] for n in d['nodes'] if n['id']=='KAFKA'][0]" <<<"$m")" == "cylinder" ]] && ok "mermaid: [( )] is a cylinder" || bad "mermaid shape"

# 4. Excalidraw: bound text labels, arrows bound to shapes, a frame
cat > "$WORK/scene.excalidraw" <<'EOF'
{"type":"excalidraw","elements":[
 {"id":"r1","type":"rectangle","x":0,"y":0,"width":100,"height":50,"boundElements":[{"id":"t1","type":"text"}],"frameId":"f1"},
 {"id":"t1","type":"text","text":"Web app","containerId":"r1"},
 {"id":"r2","type":"ellipse","x":200,"y":0,"width":100,"height":50},
 {"id":"t2","type":"text","text":"Users","containerId":"r2"},
 {"id":"a1","type":"arrow","strokeStyle":"dashed","startBinding":{"elementId":"r2"},"endBinding":{"elementId":"r1"},"endArrowhead":"arrow"},
 {"id":"t3","type":"text","text":"HTTPS","containerId":"a1"},
 {"id":"f1","type":"frame","name":"Edge"},
 {"id":"old","type":"rectangle","isDeleted":true}
]}
EOF
x=$(python3 -I "$DD" extract "$WORK/scene.excalidraw")
[[ "$(jq_ "sorted(n['label'] for n in d['nodes'])" <<<"$x")" == "['Users', 'Web app']" ]] && ok "excalidraw: labels from bound text, deleted element skipped" || bad "excalidraw nodes: $x"
[[ "$(jq_ "d['edges'][0]['label'] + '/' + d['edges'][0]['style']" <<<"$x")" == "HTTPS/dashed" ]] && ok "excalidraw: arrow label and dashed style" || bad "excalidraw edge: $x"
[[ "$(jq_ "d['groups'][0]['label'] + ':' + ','.join(d['groups'][0]['members'])" <<<"$x")" == "Edge:r1" ]] && ok "excalidraw: frame is a group" || bad "excalidraw frame: $x"

# 5. chartware SVG: the diagram template
s=$(python3 -I "$DD" extract "$CW/templates/svg/diagram-flow.svg")
[[ "$(jq_ "d['stats']['nodes'],d['stats']['edges'],d['stats']['groups']" <<<"$s")" == "6 5 1" ]] && ok "svg: 6 nodes, 5 edges, 1 group from diagram-flow.svg" || bad "svg digest: $s"
[[ "$(jq_ "sorted(e['label'] for e in d['edges'])" <<<"$s")" == "['MCP', 'REST', 'artifacts', 'embeds', 'publish']" ]] && ok "svg: edge labels attached to the nearest edge" || bad "svg edge labels: $s"

# 6. Ledger: the SVG template redrawn as Mermaid with one node renamed and one dropped
cat > "$WORK/redraw.mmd" <<'EOF'
flowchart LR
  GW[API Gateway] -->|REST| CORE[Agent Core / Claude API]
  CORE -->|MCP| TOOLS[Tool runtime over MCP]
  GW -.->|publish| KAFKA[(Kafka / events.raw)]
  CORE -->|embeds| VEC[(Vector Store / pgvector)]
EOF
L=$(python3 -I "$DD" ledger "$CW/templates/svg/diagram-flow.svg" "$WORK/redraw.mmd")
[[ "$(jq_ "d['counts']['nodes']" <<<"$L")" == "{'kept': 4, 'renamed': 1, 'merged': 0, 'dropped': 1, 'added': 0}" ]] && ok "ledger: 4 kept, 1 renamed, 1 dropped" || bad "ledger nodes: $(jq_ "d['counts']" <<<"$L")"
[[ "$(jq_ "d['counts']['edges']['dropped']" <<<"$L")" == "1" ]] && ok "ledger: the dropped node's edge is dropped" || bad "ledger edges: $(jq_ "d['counts']" <<<"$L")"
[[ "$(jq_ "[r['original'] for r in d['nodes'] if r['status']=='dropped'][0]" <<<"$L")" == "Object Store" ]] && ok "ledger: names the dropped node" || bad "ledger dropped name"
python3 -I "$DD" ledger "$CW/templates/svg/diagram-flow.svg" "$WORK/redraw.mmd" --md | grep -q "^| renamed | Tool Runtime | Tool runtime over MCP |" && ok "ledger: markdown table row for the rename" || bad "ledger markdown"

echo "diagram-digest-test: $n_ok passed, $n_bad failed"
[[ $n_bad -eq 0 ]]
