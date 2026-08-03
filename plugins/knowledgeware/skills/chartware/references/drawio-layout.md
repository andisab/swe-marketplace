# draw.io Layout & Build Reference

The complete mechanics for chartware's draw.io medium: layout arithmetic, XML rules, the verification loop, and headless rendering. Style strings and color constants live in `styles.md` — this file never restates them.

## Layout planning

Architecture diagrams use a **layered vertical layout** with **lateral category sidebars**:

```
[Top]       User / Consumer Layer
[Upper]     Application / Services Layer
[Core]      Agent / Processing / Business Logic
[Mid]       Data Processing / Integration
[Lower]     Data Sources / Storage
[Bottom]    Infrastructure / Databases
[Left]      Cross-cutting concerns (Security, Ops, Governance)
[Right]     External integrations (Agents, Tools, Models, APIs)
```

Use a grid of **multiples of 10px**. Standard spacings:
- Horizontal gap between sibling boxes: 20-30px
- Vertical gap between layers: 40-60px
- Container padding: 20-30px inside edges
- Sidebar offset from main column: 60-80px

### Per-type layout guidance

- **Flow**: top-to-bottom or left-to-right; decision diamonds inline between process boxes; 160×50px process boxes, 160×90px diamonds; "Yes" exits bottom, "No" exits right. **Alignment is critical**: center all elements on the same x-axis (top-to-bottom flow) or y-axis (left-to-right flow) so connectors are perfectly vertical or horizontal. Use `exitX=0.5;exitY=1` + `entryX=0.5;entryY=0` for vertical connections, `exitX=1;exitY=0.5` + `entryX=0;entryY=0.5` for horizontal branches.
  - **Off-branch center invariant**: Any two nodes connected by a vertical edge must share the same horizontal center. Formula: `x + width/2` must be identical for both source and target. Off-branch shapes (error paths, reject paths) AND all their downstream nodes on the same column must use a consistent center. If a side node is `x=660 w=160` (center=740), every node below it on that branch must also be centered at 740 (e.g., END oval at `x=680 w=120`).
  - **Branch labels**: Use `fontSize=11;fontStyle=1` (bold) and `labelBackgroundColor=none` on branching edges so Yes/No labels remain readable when the diagram zooms out.
  - **Loop-back edges**: Route back-edges (retry loops) left of the main column using explicit `<Array as="points">` waypoints. Left waypoint x = (main_column_left_x − 80), minimum x=50 from page left edge. Set `labelBackgroundColor=none;align=right` on the back-edge label to prevent it from rendering outside page bounds. Example: main column at x=410 → waypoints at x=330.
- **Sequence**: strict vertical columns for actors (spacing 300px); horizontal message arrows; activation bars 20px wide centered on lifeline x; messages spaced 100px apart vertically.
  - **Page sizing**: Set `pageWidth = (actors × 300) + 100` and `pageHeight = (messages × 80) + 200`. This prevents draw.io from auto-zooming to an illegible scale. Example: 3 actors, 6 messages → `pageWidth=1000 pageHeight=680`.
  - **4-actor layout**: Actor boxes at x=30, x=330, x=630, x=930 (all w=140); lifelines at x=100, x=400, x=700, x=1000; activation bars x=90, x=390, x=690, x=990 (w=20). `pageWidth` must be at least 1150.
  - **Edge label backgrounds**: All message edges must include `labelBackgroundColor=none` to prevent white highlight boxes appearing on the label text (especially visible on gray backgrounds).
  - **Self-messages / internal processing**: To show an actor processing internally, place a short text annotation (`style="text;html=1;..."`) at the correct y position on the activation bar rather than drawing a self-loop arrow. Alternatively use a self-referencing edge with waypoints that jog right by 50px from the activation bar.
- **Org chart**: top-down tree; 120×50px nodes; 60px vertical gap between rows; 40px horizontal gap between siblings; no arrowheads on edges.

## Building the XML

Structure every diagram as:

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <!-- All elements here, using parent="1" for top-level, or parent="containerId" for nested -->
  </root>
</mxGraphModel>
```

**Critical rules:**
- Always start IDs at `"0"` and `"1"` for the root cells.
- Use sequential string IDs (`"2"`, `"3"`, ...) for all other cells.
- For containers, set `parent="containerId"` on children and use **relative coordinates** (x/y relative to container origin).
- Add `container=1;` to container styles. Use `childLayout=` or manual positioning.
- Add `pointerEvents=0;` to group-style containers that should not intercept connections.
- Use `edgeStyle=orthogonalEdgeStyle;` for right-angle connectors.
- **No doglegs**: edges must run at clean angles — 0°, 45°, 60°, 90°, or their equivalents. Never produce edges that are only a few degrees off from a clean angle (e.g., 7°, 83°, 47°) due to slight element misalignment. Fix by aligning element coordinates on a consistent grid (e.g., all centers on multiples of 10px), and by setting explicit `exitX`/`exitY`/`entryX`/`entryY` anchor points when auto-routing would produce an off-angle segment.
- **Center-alignment invariant**: Before finalizing XML, verify that every vertical edge pair satisfies `source_x + source_width/2 == target_x + target_width/2`. Every horizontal edge pair must satisfy `source_y + source_height/2 == target_y + target_height/2`.
- **Page bounds margin**: No element, waypoint, or label may be placed within 40px of the page boundary. Minimum safe coordinates: x≥40, y≥30.
- **Label background**: All edge labels must include `labelBackgroundColor=none` to prevent white highlight boxes. This applies to flow branch labels, sequence message labels, and all other labeled edges.
- Ensure at least 20px of straight segment before arrowheads.
- Never use double hyphens (`--`) inside XML comments.
- Set the page background to the diagram background color via the `<mxGraphModel>` attributes if needed.
- **Static hex only**: the `light-dark(light, dark)` function is not reliably resolved by the draw.io renderer and causes invisible elements. Always substitute the first (light) value from `styles.md` as plain static hex in generated XML.

## Example: minimal two-layer diagram

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="Application Layer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#DADADA;strokeColor=none;fontFamily=Quicksand;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand;fontColor=#666666;" vertex="1" parent="1">
      <mxGeometry x="100" y="40" width="600" height="32" as="geometry"/>
    </mxCell>
    <mxCell id="3" value="Service A" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#7EA6E0;strokeWidth=1;fontColor=#4D4D4D;" vertex="1" parent="1">
      <mxGeometry x="120" y="100" width="160" height="36" as="geometry"/>
    </mxCell>
    <mxCell id="4" value="Service B" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#7EA6E0;strokeWidth=1;fontColor=#4D4D4D;" vertex="1" parent="1">
      <mxGeometry x="320" y="100" width="160" height="36" as="geometry"/>
    </mxCell>
    <mxCell id="5" value="" style="vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand;flowAnimation=1;strokeWidth=3;startFill=1;" edge="1" source="3" target="4" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>
```

## Visual verification loop

After rendering, use browser tools (Playwright MCP — find its tools via `tool_search`) to inspect the result and iterate. Max **3 rounds**. If no browser tools are available, skip the loop: deliver the diagram anyway, tell the user it wasn't visually verified, and point them to the plugin README's "Optional tooling" section.

```
Round N:
  1. Take a browser screenshot → inspect visually
  2. If OK → done
  3. If issues → patch XML, re-call open_drawio_xml, repeat
```

The draw.io editor will be the active tab after `open_drawio_xml` opens it. No navigation needed — just take the screenshot.

**What to look for:**

| Issue | Fix |
|---|---|
| Elements overlapping | Increase container size or gap between sibling boxes |
| Text clipped / truncated | Increase box height; reduce fontSize if needed |
| Elements off-screen or at canvas edge | Shift x/y coordinates inward |
| Layer headers misaligned | Normalize all headers to a consistent width |
| Connectors crossing through boxes | Adjust `exitX/Y` and `entryX/Y` on the edge |
| Empty container (children invisible) | Check `parent` IDs and verify relative coordinates |
| Arrow missing arrowhead | Verify `endFill=1` and that the target cell ID exists |
| Wrong colors / font | Compare style string against `styles.md` |

**Patch strategy:** Edit only the affected cells — adjust `x`, `y`, `width`, `height`, or `style`. Do not regenerate the full XML unless the layout is fundamentally broken. Targeted edits are faster and less error-prone.

## Rendering without the draw.io MCP (headless / posters)

The canonical workflow for producing a PNG of a draw.io diagram with no MCP available (used e.g. by knowledgebase poster diagrams):

1. Author the mxGraph XML per this reference + the `styles.md` catalog.
2. Wrap in a local HTML page: `<div class="mxgraph" data-mxgraph='{"nav":false,"resize":true,"toolbar":"","edit":null,"xml":"<ESCAPED XML>"}'></div><script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>` (build the JSON with `json.dumps` + `html.escape`).
3. Serve over localhost (`python3 -m http.server`) — browser MCPs commonly block `file://`.
4. Screenshot the `div.mxgraph` element at device scale; inspect; ≤3 patch rounds (typical fixes: `labelBackgroundColor=#FFFFFF` so branch labels lift off edges; box overlaps; center-alignment).
5. Ship the PNG plus the `.drawio.xml` source side by side; kill the server.

## Tips for high-quality output

- **Width consistency**: Layer headers and containers at the same level should share the same width.
- **Vertical rhythm**: Keep consistent spacing between layers. The eye reads top-to-bottom; maintain the layered gravity.
- **Sidebar grouping**: Use a `category_label` (rotated text) alongside a vertical stack of `red_box` or `green_box` items for cross-cutting concerns.
- **Right-side integrations**: Group external systems in a bracketed column on the right with small protocol labels on arrows.
- **Arrow discipline**: Bidirectional arrows for peer interactions, unidirectional for data flow. Use protocol labels sparingly.
- **Container nesting**: Max 2 levels deep. Beyond that, flatten and use visual grouping (background color + proximity) instead.
- **LLM logos**: For foundational model provider logos, use a container with a note like "Cloud-Native LLM Providers" and list names as text. Don't attempt to embed external images unless the user provides URLs.

## Diagram types supported

1. **Full Reference Architecture** — Multi-layer enterprise view with sidebars (Security, Ops, Governance) and right-side integrations (Agents, Tools, Models)
2. **Focused Subsystem** — Single-container deep dive (e.g., "Agentic Application" with internal layers)
3. **Data Platform Architecture** — Data sources → processing → serving layer with database icons
4. **Integration Topology** — Service mesh / API gateway with protocol annotations
5. **Deployment Architecture** — Cloud infrastructure with compute, networking, storage tiers
6. **Software Flow** — Process/decision flows with terminals, process boxes, decision diamonds, and swim lanes
7. **Sequence Diagram** — Actor lifelines, sync/async messages, activation bars, alt/loop fragments
8. **Org Chart** — Hierarchical tree of nodes with org_edge connectors, department color-coding

For each type, compose elements from the style catalog in `styles.md`.
