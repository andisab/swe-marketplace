---
name: chartware
description: Generate enterprise-grade architecture diagrams using the draw.io MCP (drawio:open_drawio_xml) with a curated visual style system. Use this skill whenever the user asks to create architecture diagrams, reference architectures, system design diagrams, infrastructure diagrams, technology stack visualizations, or any technical diagram that should look professional and consistent. Also trigger when the user mentions "chartware", "pretty-arrows" (this skill's former name), "draw.io", "drawio", "mxGraph", or asks for diagrams in the style of their reference architecture. Covers agentic AI architectures, cloud architectures, data platform architectures, microservice diagrams, and layered system designs.
---

# draw.io Architecture Diagram Skill

Generate professional, enterprise-grade architecture diagrams using the `drawio:open_drawio_xml` MCP tool with a consistent visual style system derived from a curated reference architecture.

## When to Use

- User requests any architecture or system design diagram
- User asks for draw.io / mxGraph output
- User wants a visual representation of a technology stack, data flow, or system topology
- User says "diagram this", "draw this", "visualize this architecture"

## Before You Start

0. **Brand resolution (optional)**: if the user names a brand or style ("in the AAB style", "Provectus-branded"), resolve it from the registry — `$KNOWLEDGEWARE_BRANDS_DIR/<name>.md` first (if that env var is set — the user's own brands directory), then `styles/brands/<name>.md` (plugin root — two directories above this skill), falling through to `styles/<name>.md` for the generic defaults — and substitute its palette/typography into the style catalog per the **brandware skill's `references/consumer-mappings.md` §chartware**. The mapping is deliberately understated — surface fills with categorical strokes, brand accent in at most two roles, low-saturation tints; a branded diagram should read as the brand's document, not a poster of its colors. For data charts (bars, lines, KPIs) rather than diagrams, follow brandware's `references/chart-styling.md`. If the brand isn't installed, use the default catalog below and say so. When the user names no brand at all, check the `DEFAULT` marker (a one-line file naming a registry entry; `$KNOWLEDGEWARE_BRANDS_DIR/DEFAULT` wins over `styles/brands/DEFAULT`) and apply that identity if it resolves, telling the user; otherwise use the default catalog.
1. **Read the style reference**: `view` the file at `references/styles.md` in this skill's directory. It contains every style string, color constant, and element template you need.
2. **Load the draw.io MCP**: Call `tool_search` with query `"drawio"` to ensure the `open_drawio_xml` tool is available. The plugin bundles the official `@drawio/mcp` server, so the tool is present wherever the plugin is installed (npx fetches it on first use). If the tool truly can't be found, fall back to writing the `.drawio` XML to a file and tell the user to open it in draw.io.
3. **Clarify scope** with the user if the request is ambiguous — ask whether they want a full layered reference architecture or a focused subsystem view.

## Template Selection

Consult `templates/` to start from a template instead of building from scratch:

| Request type | Template |
|---|---|
| Process flow, flowchart, decision flow | `templates/flow.xml` |
| Message passing, API sequence, interaction | `templates/sequence.xml` |
| Reference architecture, system design, layers | `templates/architecture.xml` |
| Org chart, hierarchy, reporting structure | `templates/orgchart.xml` |

Start by reading the appropriate template and adapting node labels, counts, and connections.

## Diagram Composition Workflow

### Step 1: Plan the Layout

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

#### Per-Type Layout Guidance

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

### Step 2: Choose Element Types

Consult `references/styles.md` for the full catalog. Key element types:

| Element | When to Use |
|---------|-------------|
| `header_gray` | Top-level horizontal bars spanning the diagram width (e.g., "Application Layer") |
| `container_outer` | Large dashed outer boundary grouping a full diagram area |
| `container_section_frame` | No-fill frame for outlining a section with a visible border |
| `box_blue_filled` | Blue-filled functional area or highlighted container |
| `memory_bar` | Gray bar for cross-cutting persistent state (e.g., "Memory & Context") |
| `pill_blue_dark` | Items inside the memory bar; labeled badges |
| `box_standard` | Default component box (white fill, blue stroke) |
| `box_red` | Security, governance, infrastructure, compliance concerns |
| `box_green` | Data & knowledge pipeline components |
| `bracket_right` | Right-side integration categories (Agents, Tools, Models) |
| `cylinder_blue` / `cylinder_green` | Database shapes at the bottom layer |
| `arrow_primary` | Main bidirectional navy flow arrows with animation |
| `arrow_classic_blue` | Secondary bidirectional connectors |
| `actor` | User / consumer icon at the top of the diagram |
| `text_protocol` | Small annotation on arrows (e.g., "REST / JSON RPC", "MCP") |
| `frame_label_left` | Rotated vertical text labeling a sidebar group |

### Step 3: Build the XML

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

### Step 4: Render

Call `drawio:open_drawio_xml` with the complete XML string. Set `dark` to `"false"` (these styles are designed for light mode).

### Step 5: Visual Verification Loop (Playwright)

After rendering, use Playwright to inspect the result and iterate. Max **3 rounds**.

If no Playwright browser tools are available (`tool_search` finds none), skip this loop: deliver the diagram anyway, tell the user it wasn't visually verified, and point them to the plugin README's "Optional tooling" section for the Playwright plugin install command.

```
Round N:
  1. mcp__playwright__browser_take_screenshot → inspect visually
  2. If OK → done
  3. If issues → patch XML, re-call drawio:open_drawio_xml, repeat
```

The draw.io editor will be the active tab after `drawio:open_drawio_xml` opens it. No navigation needed — just take the screenshot.

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
| Wrong colors / font | Compare style string against `references/styles.md` |

**Patch strategy:** Edit only the affected cells — adjust `x`, `y`, `width`, `height`, or `style`. Do not regenerate the full XML unless the layout is fundamentally broken. Targeted edits are faster and less error-prone.

## Style Quick Reference

These are the most-used style strings. See `references/styles.md` for the complete catalog.

> **Templates use static hex** — the `light-dark(light, dark)` function is not reliably resolved by the draw.io renderer and causes invisible elements. Always use static hex values (e.g. `#FFFFFF`, `#D4E1F5`) in XML you generate or edit. The `light-dark()` strings in this reference section are for documentation only; substitute the first (light) value when building XML.
> Font is **Quicksand** via Google Fonts. Replace `FONT_SRC` with:
> `https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand`

### Color Reference

```
Text:
  primary text     light-dark(#4D4D4D,#4D4D4D)
  muted text       light-dark(#666666,#666666)
  white text       light-dark(#FFFFFF,#FFFFFF)   (on dark fills)
  arrow text       #EEEEEE  (static, on navy arrows)

Fill:
  standard white   light-dark(#FFFFFF,#FFFFFF)
  gray header      light-dark(#DADADA,#DADADA)
  memory bar       light-dark(#999999,#999999)
  blue light       light-dark(#D4E1F5,#D4E1F5)
  blue pill        light-dark(#000000,#A9C4EB)   (black in light, blue in dark)
  green            light-dark(#B9E0A5,#B9E0A5)
  red              light-dark(#F19C99,#F19C99)
  db blue          light-dark(#6687B4,#6687B4)
  db green         light-dark(#97D077,#97D077)

Stroke:
  standard blue    light-dark(#7EA6E0,#7EA6E0)
  green            light-dark(#97D077,#97D077)
  red              light-dark(#FF0000,#FF0000)
  gray frame       light-dark(#A2A2A2,#A2A2A2)
  arrow navy       #0B4D6A  (static)
```

### Core Style Strings

```
box_standard:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);

box_green:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#97D077,#97D077);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);

box_red:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#FF0000,#FF0000);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);

box_blue_filled:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);

header_gray:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#DADADA,#DADADA);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);

memory_bar:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#999999,#999999);strokeColor=none;strokeWidth=1;rotation=0;fontColor=light-dark(#FFFFFF,#FFFFFF);labelBackgroundColor=none;

pill_blue_dark:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#A9C4EB);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);

container_outer:
  rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,transparent);strokeColor=light-dark(#000000,#C6C6C6);dashed=1;dashPattern=8 8;strokeWidth=2;fontFamily=Quicksand;fontSource=FONT_SRC;

container_section_frame:
  rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);

cylinder_blue:
  shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=light-dark(#6687B4,#6687B4);

cylinder_green:
  shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=light-dark(#97D077,#97D077);

arrow_primary:
  vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=FONT_SRC;flowAnimation=1;strokeWidth=3;startFill=1;
```

## Example: Minimal Two-Layer Diagram

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="Application Layer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#DADADA,#DADADA);strokeColor=none;fontFamily=Quicksand;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand;fontColor=light-dark(#666666,#666666);" vertex="1" parent="1">
      <mxGeometry x="100" y="40" width="600" height="32" as="geometry"/>
    </mxCell>
    <mxCell id="3" value="Service A" style="rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);" vertex="1" parent="1">
      <mxGeometry x="120" y="100" width="160" height="36" as="geometry"/>
    </mxCell>
    <mxCell id="4" value="Service B" style="rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);" vertex="1" parent="1">
      <mxGeometry x="320" y="100" width="160" height="36" as="geometry"/>
    </mxCell>
    <mxCell id="5" value="" style="vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand;flowAnimation=1;strokeWidth=3;startFill=1;" edge="1" source="3" target="4" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>
```

## Tips for High-Quality Output

- **Width consistency**: Layer headers and containers at the same level should share the same width.
- **Vertical rhythm**: Keep consistent spacing between layers. The eye reads top-to-bottom; maintain the layered gravity.
- **Sidebar grouping**: Use a `category_label` (rotated text) alongside a vertical stack of `red_box` or `green_box` items for cross-cutting concerns.
- **Right-side integrations**: Group external systems in a bracketed column on the right with small protocol labels on arrows.
- **Arrow discipline**: Bidirectional arrows for peer interactions, unidirectional for data flow. Use protocol labels sparingly.
- **Container nesting**: Max 2 levels deep. Beyond that, flatten and use visual grouping (background color + proximity) instead.
- **LLM logos**: For foundational model provider logos, use a container with a note like "Cloud-Native LLM Providers" and list names as text. Don't attempt to embed external images unless the user provides URLs.

## Diagram Types Supported

1. **Full Reference Architecture** — Multi-layer enterprise view with sidebars (Security, Ops, Governance) and right-side integrations (Agents, Tools, Models)
2. **Focused Subsystem** — Single-container deep dive (e.g., "Agentic Application" with internal layers)
3. **Data Platform Architecture** — Data sources → processing → serving layer with database icons
4. **Integration Topology** — Service mesh / API gateway with protocol annotations
5. **Deployment Architecture** — Cloud infrastructure with compute, networking, storage tiers
6. **Software Flow** — Process/decision flows with terminals, process boxes, decision diamonds, and swim lanes
7. **Sequence Diagram** — Actor lifelines, sync/async messages, activation bars, alt/loop fragments
8. **Org Chart** — Hierarchical tree of nodes with org_edge connectors, department color-coding

For each type, compose elements from the style catalog in `references/styles.md`.