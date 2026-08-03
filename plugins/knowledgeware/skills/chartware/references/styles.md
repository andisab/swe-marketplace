# draw.io Style Reference — Enterprise Architecture Catalog

Extracted from a production enterprise reference architecture (90 unique styles). All color
values use the `light-dark(light_color, dark_color)` CSS function for reference purposes.

> **IMPORTANT — Generated XML must use static hex, not `light-dark()`.**
> The `light-dark()` function is not resolved by app.diagrams.net and causes invisible elements.
> When writing XML, always substitute the first (light mode) value as a plain static hex.
> Example: `light-dark(#D4E1F5,#D4E1F5)` → use `#D4E1F5`.

---

## Critical Constants

### Font Source
All Quicksand cells require this exact `fontSource` value (URL-encoded):
```
fontSource=https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DQuicksand
```
Abbreviated as `FONT_SRC` in all style strings below. Replace literally when copying.

### Global Requirements
- `html=1` — required on all non-group, non-edge vertex cells
- `rounded=1` — standard for boxes and containers
- `whiteSpace=wrap` — standard for all boxes

---

## Color Palette

All colors as they appear in the `light-dark()` function:

### Text Colors
| Role | light-dark() value | Notes |
|---|---|---|
| Primary text | `light-dark(#4D4D4D,#4D4D4D)` | All standard boxes |
| Muted text | `light-dark(#666666,#666666)` | Section labels, pills |
| Dense text | `light-dark(#3C3C3C,#3C3C3C)` | Rich text areas |
| Subtle text | `light-dark(#989898,#989898)` | Subdued frames |
| White text | `light-dark(#FFFFFF,#FFFFFF)` | On dark fills |
| Memory text | `light-dark(#FFFFFF,#9F9F9F)` | Memory section headers |
| Inner header | `light-dark(#FFFFFF,#A9C4EB)` | Blue tinted on dark |
| Purple title | `light-dark(#000000,#CDA2BE)` | Section accent |
| Arrow text | `#EEEEEE` (static) | On primary navy arrows |

### Fill Colors
| Role | light-dark() value | Notes |
|---|---|---|
| Standard white | `light-dark(#FFFFFF,#FFFFFF)` | Most boxes |
| Adaptive white | `light-dark(#FFFFFF,#DADADA)` | White→gray in dark mode |
| Outer transparent | `light-dark(#FFFFFF,transparent)` | Outer boundary fill |
| Gray header | `light-dark(#DADADA,#DADADA)` | Section/layer headers |
| Memory bar | `light-dark(#999999,#999999)` | Memory & Context bar |
| Blue light | `light-dark(#D4E1F5,#D4E1F5)` | Blue containers |
| Blue pill dark | `light-dark(#000000,#A9C4EB)` | Dark pill (blue in dark mode) |
| Blue pill medium | `light-dark(#A9C4EB,#A9C4EB)` | Consistent blue across modes |
| Green | `light-dark(#B9E0A5,#B9E0A5)` | Filled green boxes |
| Red | `light-dark(#F19C99,#F19C99)` | Filled red boxes |
| Red adaptive | `light-dark(#FFFFFF,#F19C99)` | White in light, red in dark |
| Strong dark | `light-dark(#515151,#515151)` | Heavy bordered boxes |
| User icon gray | `light-dark(#989898,#989898)` | Actor shape |
| DB blue | `light-dark(#6687B4,#6687B4)` | Blue cylinders |
| DB green | `light-dark(#97D077,#97D077)` | Green cylinders |
| Purple pill | `light-dark(#000000,#CDA2BE)` | Dark pill (purple in dark) |

### Stroke Colors
| Role | light-dark() value | Notes |
|---|---|---|
| Standard blue | `light-dark(#7EA6E0,#7EA6E0)` | Primary stroke, most boxes |
| Blue+green adaptive | `light-dark(#7EA6E0,#97D077)` | Changes color per mode |
| Green | `light-dark(#97D077,#97D077)` | Green boxes |
| Red standard | `light-dark(#FF0000,#FF0000)` | Security/infra boxes |
| Red alt | `light-dark(#FF0000,#FF5C55)` | Slight dark-mode variation |
| Purple | `light-dark(#CDA2BE,#CDA2BE)` | Purple accent containers |
| Dark | `light-dark(#515151,#515151)` | Strong borders |
| Gray | `light-dark(#777777,#777777)` | Sub-containers |
| Light gray | `light-dark(#A2A2A2,#A2A2A2)` | Section frames |
| Very light | `light-dark(#D8D8CF,#D8D8CF)` | Outermost frames |
| Ghost | `light-dark(#F1F1F1,#F1F1F1)` | Near-invisible |
| Dashed outer | `light-dark(#000000,#C6C6C6)` | Outer boundary dashed |
| Bracket | `light-dark(#000000,#C3C3C3)` | Curly brackets |
| None | `none` | Pills, no-border elements |

### Arrow Colors
| Role | Value | Notes |
|---|---|---|
| Primary arrow | `#0B4D6A` (static) | Main flow, navy blue |
| Arrow text | `#EEEEEE` (static) | Label on primary arrows |
| Classic blue | `light-dark(#000000,#99CCFF)` | Secondary bidirectional |

---

## Box Styles

### box_standard
Default component box — white fill, blue stroke.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```
Typical size: `~146×35`. Used for: Applications, Agents, Workflows, Orchestration, generic components.

### box_standard_qs
Same as box_standard with explicit Quicksand font.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_bold_large
Section title or banner box with bold + large font.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);fontStyle=1;fontSize=16;
```
Typical size: `~614×45` (User), `~1036×41` (wide banners).

### box_green
White fill with green stroke — data/knowledge layer.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#97D077,#97D077);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```
Typical size: `~146×30`. Used for: Vector/Hybrid Search, Embedding Store, Graph, data layer items.

### box_green_qs
Green box with explicit Quicksand.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#97D077,#97D077);strokeWidth=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_green_filled
Filled green box.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#B9E0A5,#B9E0A5);strokeColor=light-dark(#97D077,#97D077);strokeWidth=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_red
White fill with red stroke — security, infrastructure, compliance.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#FF0000,#FF0000);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```
Typical size: `~146×35`. Used for: Containerization, Infrastructure as Code, security controls.

### box_red_qs
Red box with explicit Quicksand.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#FF0000,#FF0000);strokeWidth=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_red_adaptive
White in light mode → red fill in dark mode.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#F19C99);strokeColor=light-dark(#FF0000,#FF0000);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_red_filled
Filled red box.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#F19C99,#F19C99);strokeColor=light-dark(#FF0000,#FF0000);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_red_filled_alt
Red filled, alt dark-mode stroke.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#F19C99,#F19C99);strokeColor=light-dark(#FF0000,#FF5C55);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_blue_filled
Blue filled box.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_mixed_stroke
Stroke adapts: blue in light, green in dark.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#97D077);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_mixed_stroke_qs
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#97D077);strokeWidth=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### box_purple
Purple-bordered container (2px stroke).
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#CDA2BE,#CDA2BE);strokeWidth=2;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~313×172`.

### box_dark_border
Heavy dark border, no rounded (square corners).
```
rounded=0;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#515151,#515151);strokeWidth=3;rotation=0;fontColor=light-dark(#4D4D4D,#4D4D4D);
```
Typical size: `~427×380`. Used for large framing elements.

### box_shadow
White box with shadow effect.
```
whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);shadow=1;
```
Typical size: `~447×292`.

---

## Section Headers & Pill Labels

### header_gray
Horizontal section/layer header — gray fill, no stroke.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#DADADA,#DADADA);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```
Typical size: `~413×31.5`.

### header_gray_rot0
Same with explicit `rotation=0`.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#DADADA,#DADADA);strokeColor=none;rotation=0;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```

### header_adaptive
White→gray fill adaptive header.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#DADADA);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```

### header_adaptive_wide
Wide adaptive header (no explicit fontColor).
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#DADADA);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~413×31.5`.

### memory_bar
Memory & Context bar.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#999999,#999999);strokeColor=none;strokeWidth=1;rotation=0;fontColor=light-dark(#FFFFFF,#FFFFFF);labelBackgroundColor=none;
```
Typical sizes: `~110×30`, `~457×30`. Children positioned relative to this container.

### pill_blue_dark
Dark pill — appears blue in dark mode. Used for memory sub-items and badge labels.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#A9C4EB);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```
Typical size: `~168×31.5`.

### pill_blue_dark_rot0
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#A9C4EB);strokeColor=none;rotation=0;fontFamily=Quicksand;fontSource=FONT_SRC;
```

### pill_blue_medium
Blue pill consistent across modes.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#A9C4EB,#A9C4EB);strokeColor=none;rotation=0;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```

### pill_purple_dark
Purple-tinted dark pill.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#CDA2BE);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;
```

### pill_purple_dark_labeled
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#CDA2BE);strokeColor=none;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```

---

## Container Styles

### container_outer
Large outer boundary of entire diagram. Dashed border, fills transparent in dark.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,transparent);strokeColor=light-dark(#000000,#C6C6C6);dashed=1;dashPattern=8 8;strokeWidth=2;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~1158×780`.

### container_white_plain
White→transparent outer with plain stroke.
```
rounded=0;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,transparent);strokeColor=light-dark(#CCCCCC,#666666);strokeWidth=2;
```
Typical size: `~505×533`.

### container_section_frame
No-fill frame with medium gray stroke. Used for section groupings.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);
```
Typical sizes: `~614×20` (full-width section bar), `~453×20`.

### container_section_frame_muted
Very light stroke, outermost frames.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#D8D8CF,#D8D8CF);strokeWidth=1;fontColor=light-dark(#989898,#989898);
```
Typical size: `~1080×20`.

### container_section_frame_ghost
Near-invisible frame.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#F1F1F1,#F1F1F1);strokeWidth=1;rotation=0;fontColor=light-dark(#989898,#989898);
```
Typical size: `~390×21`.

### container_gray_border
White box with gray border — sub-containers.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#777777,#777777);fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#666666,#666666);
```
Typical size: `~190×111`.

### container_dashed_dotted
White fill, no stroke, dashed dot pattern — subtle grouping.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=none;dashed=1;dashPattern=1 2;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~423×75`.

### container_blue_filled (white→blue fill)
Blue-tinted container area.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#000000,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;
```
Typical size: `~213×106`.

### group
Invisible layout group — no visible border.
```
group
```

### group_qs
Group with Quicksand (for containers that own labeled children).
```
group;fontFamily=Quicksand;fontSource=FONT_SRC;
```

---

## Text Label Styles

### text_plain
General centered text label.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;
```

### text_dark
Standard dark text.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### text_protocol
Protocol annotation label. Typical content: "REST / JSON RPC", "Agent Protocols (MCP | A2A | ACP)".
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#4D4D4D,#4D4D4D);fontSize=12;
```
Typical size: `~128×18`.

### text_section_title
Section title, size 17, bold.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#4D4D4D,#4D4D4D);fontSize=17;fontStyle=1
```

### text_memory_header
Memory section header — white text in light mode.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#FFFFFF,#9F9F9F);fontSize=16;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~129×30`. Content: "Memory & Context".

### text_inner_header
Inner section header with blue-tinted dark mode.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#FFFFFF,#A9C4EB);fontSize=16;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~129×30`. Content: "Integrations", section titles on dark containers.

### text_purple_title
Purple-accent section title.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=light-dark(#000000,#CDA2BE);fontSize=16;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~92×30`. Content: "Agents", category titles.

### text_qs
Standard text with Quicksand.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### text_qs_dark
Quicksand with darker text shade.
```
text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#3C3C3C,#3C3C3C);
```

### text_rich
Multi-line rich text area with overflow hidden.
```
text;html=1;whiteSpace=wrap;overflow=hidden;rounded=0;fontColor=light-dark(#3C3C3C,#3C3C3C);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~294×140`. Used for descriptive text blocks.

---

## Rotated Frame Labels

Rotated labels for sidebar section names (e.g., "Security", "Operations"):

### frame_label_left (rotation -90 / 270, muted)
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;rotation=270;fontColor=light-dark(#A2A2A2,#A2A2A2);
```

### frame_label_left_dark (rotation 270, dark text)
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;fontColor=light-dark(#A2A2A2,#A2A2A2);rotation=-90;
```

### frame_label_right (rotation 90)
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;rotation=90;fontColor=light-dark(#4D4D4D,#4D4D4D);
```

### frame_label_muted_270
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#D8D8CF,#D8D8CF);strokeWidth=1;rotation=270;fontColor=light-dark(#989898,#989898);
```

### frame_label_muted_90
```
rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#D8D8CF,#D8D8CF);strokeWidth=1;rotation=90;fontColor=light-dark(#989898,#989898);
```

---

## Shape Styles

### actor
User/actor icon.
```
shape=actor;whiteSpace=wrap;html=1;fillColor=light-dark(#989898,#989898);
```
Typical size: `~17×19`.

### cylinder_blue
Database cylinder, blue (cloud/specialized DBs).
```
shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=light-dark(#6687B4,#6687B4);
```
Typical size: `72×68`.

### cylinder_green
Database cylinder, green (standard storage).
```
shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=light-dark(#97D077,#97D077);
```
Typical size: `72×68`.

### bracket_right
Curly bracket grouping, vertical (right-side labels).
```
shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;strokeColor=light-dark(#000000,#C3C3C3);rotation=0;strokeWidth=1.5;fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `~28×507`. Label appears to the left.

### bracket_top
Curly bracket rotated 90° (horizontal groupings).
```
shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;strokeColor=light-dark(#000000,#C3C3C3);rotation=90;strokeWidth=1.5;fontFamily=Quicksand;fontSource=FONT_SRC;
```

---

## Edge / Arrow Styles

### arrow_primary
Main data flow arrow — navy blue, animated, bidirectional block arrows.
```
vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;spacingTop=-3;spacingBottom=-3;spacingLeft=-3;spacingRight=-3;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=FONT_SRC;flowAnimation=1;strokeWidth=3;startFill=1;
```

### arrow_primary_exit_bottom_enter_top
Exits from bottom center, enters top center.
```
vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;spacingTop=-3;spacingBottom=-3;spacingLeft=-3;spacingRight=-3;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=FONT_SRC;flowAnimation=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeWidth=3;startFill=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;
```

### arrow_primary_exit_top_enter_top
Both ends connect at top.
```
vsdxID=54;edgeStyle=none;startArrow=block;endArrow=block;startSize=5;endSize=5;strokeColor=#0B4D6A;spacingTop=-3;spacingBottom=-3;spacingLeft=-3;spacingRight=-3;verticalAlign=middle;html=1;labelBackgroundColor=none;rounded=1;fontColor=#EEEEEE;fontFamily=Quicksand;fontSource=FONT_SRC;flowAnimation=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeWidth=3;startFill=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;
```

### arrow_classic_blue
Classic bidirectional, blue tinted, animated.
```
endArrow=classic;startArrow=classic;html=1;rounded=0;fontColor=light-dark(#000000,#CCE5FF);strokeWidth=3;flowAnimation=0;strokeColor=light-dark(#000000,#99CCFF);
```

### arrow_classic_dark
Classic bidirectional, dark text variant.
```
endArrow=classic;startArrow=classic;html=1;rounded=0;fontColor=light-dark(#4D4D4D,#4D4D4D);strokeWidth=3;flowAnimation=0;strokeColor=light-dark(#000000,#99CCFF);
```

### arrow_orthogonal_exit_right
Orthogonal routing, exits right side.
```
edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0.989;entryY=0.444;entryDx=0;entryDy=0;entryPerimeter=0;fontFamily=Quicksand;fontSource=FONT_SRC;
```

---

## Image Style (Service Icons)

AWS and other service icons are embedded as base64 PNG:
```
shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/png,<BASE64_DATA>
```
Typical size: `~72×68`. Do not re-create these — copy existing cells and update the `value` label.

---

## Quick Reference

| Element | Style Name | Fill | Stroke |
|---|---|---|---|
| Generic component | `box_standard` | white | #7EA6E0 blue |
| Bold title/banner | `box_bold_large` | white | #7EA6E0 blue |
| Data/knowledge item | `box_green` | white | #97D077 green |
| Filled green item | `box_green_filled` | #B9E0A5 | #97D077 green |
| Security/infra item | `box_red` | white | #FF0000 red |
| Filled red item | `box_red_filled` | #F19C99 | #FF0000 red |
| Blue container | `box_blue_filled` | #D4E1F5 | #7EA6E0 blue |
| Purple container | `box_purple` | white | #CDA2BE purple |
| Heavy frame | `box_dark_border` | white | #515151 dark |
| Section header | `header_gray` | #DADADA | none |
| Memory bar | `memory_bar` | #999999 | none |
| Dark blue pill | `pill_blue_dark` | black/#A9C4EB | none |
| Outer boundary | `container_outer` | white/transparent | dashed |
| Section frame | `container_section_frame` | none | #A2A2A2 |
| Muted frame | `container_section_frame_muted` | none | #D8D8CF |
| Sub-container | `container_gray_border` | white | #777777 |
| Invisible group | `group` | — | — |
| User icon | `actor` | #989898 | — |
| Database (blue) | `cylinder_blue` | #6687B4 | — |
| Database (green) | `cylinder_green` | #97D077 | — |
| Bracket | `bracket_right` | — | #000000/#C3C3C3 |
| Main arrow | `arrow_primary` | — | #0B4D6A navy |
| Secondary arrow | `arrow_classic_blue` | — | #000000/#99CCFF |

---

## Notes

- **Never replace `light-dark()` with static hex** — these styles are designed for dual light/dark mode.
- **`html=1` is required** on all vertex cells except `group`.
- **Quicksand fontSource** must be URL-encoded exactly as shown. The decoded URL is `https://fonts.googleapis.com/css?family=Quicksand`.
- **`vsdxID=54`** on primary arrows is a VSDX import artifact — preserve it for consistency.
- **`flowAnimation=1`** enables animated flowing dashes on primary arrows. Set to `0` to disable.
- **Service icon cells** embed full base64 PNG data — copy existing cells rather than reconstructing.
- **Rotated labels** use `rotation=270` (counterclockwise) for left sidebar and `rotation=90` for right sidebar text.

---

## Section 9: Diagram-Type Shapes

Styles for flow, sequence, and org chart diagram elements.

### terminal_oval
Flow start/end terminal — gray oval.
```
ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=light-dark(#DADADA,#DADADA);strokeColor=light-dark(#A2A2A2,#A2A2A2);fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `120×50`. Labels: "START", "END".

### process_box
Flow process step — reuses `box_standard`.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `160×50`. Used for: process steps, actions, tasks.

### decision_diamond
Flow decision node — blue-filled rhombus.
```
rhombus;whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `160×90`. Exit: bottom (Yes), right (No). Label arrows with "Yes"/"No".

### swimlane_lane
Flow / BPMN swim lane container.
```
swimlane;startSize=30;horizontal=0;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#A2A2A2,#A2A2A2);fontColor=light-dark(#666666,#666666);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Use as a parent container; set children with relative coordinates inside.

### lifeline_actor
Sequence diagram actor header — reuses `box_blue_filled`.
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `140×50`. Place at y=40; lifeline hangs from bottom center.

### lifeline_line
Sequence dashed vertical lifeline — use as a free-floating edge with explicit sourcePoint/targetPoint.
```
endArrow=none;dashed=1;html=1;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;
```
Set `sourcePoint` at bottom center of actor header; `targetPoint` at diagram bottom.

### activation_bar
Sequence activation box — narrow rectangle over lifeline center.
```
whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);
```
Typical size: `20×200-300`. Position centered on lifeline x (lifeline_x - 10).

### fragment_box
Sequence alt/loop frame — dashed container with label tag.
Two cells: (1) outer dashed rectangle, (2) small text label in top-left corner.
```
Outer: rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;dashed=1;
Label: text;html=1;align=left;verticalAlign=top;spacingLeft=4;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);fontStyle=1;
```
Label content: "alt", "loop", "opt". Place label at same x/y as outer box, size `60×24`.

### message_sync
Sequence synchronous call arrow — navy, solid, left-to-right.
```
edgeStyle=orthogonalEdgeStyle;endArrow=block;endFill=1;strokeColor=#0B4D6A;strokeWidth=2;html=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);align=center;verticalAlign=bottom;
```
Use free-floating edge with explicit sourcePoint/targetPoint on lifeline x coordinates.

### message_return
Sequence return arrow — gray, dashed, right-to-left.
```
edgeStyle=orthogonalEdgeStyle;endArrow=open;endFill=0;dashed=1;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;html=1;fontFamily=Quicksand;fontSource=FONT_SRC;fontColor=light-dark(#4D4D4D,#4D4D4D);align=center;verticalAlign=bottom;
```

### org_node_primary
Org chart node — top two levels use blue fill.
Reuses `box_blue_filled`:
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#D4E1F5,#D4E1F5);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```
Typical size: `120×50`.

### org_node_leaf
Org chart leaf node — lower levels use white fill.
Reuses `box_standard`:
```
rounded=1;whiteSpace=wrap;html=1;fillColor=light-dark(#FFFFFF,#FFFFFF);strokeColor=light-dark(#7EA6E0,#7EA6E0);strokeWidth=1;fontColor=light-dark(#4D4D4D,#4D4D4D);fontFamily=Quicksand;fontSource=FONT_SRC;
```

### org_edge
Org chart connector — orthogonal, no arrowhead.
```
edgeStyle=orthogonalEdgeStyle;endArrow=none;strokeColor=light-dark(#A2A2A2,#A2A2A2);strokeWidth=1;html=1;
```

---

## Section 9: Quick Reference

| Style name | Diagram type | Key characteristic |
|---|---|---|
| `terminal_oval` | Flow | Gray ellipse, START/END |
| `process_box` | Flow | White box with blue stroke (= box_standard) |
| `decision_diamond` | Flow | Blue-fill rhombus |
| `swimlane_lane` | Flow/BPMN | Horizontal swim lane container |
| `lifeline_actor` | Sequence | Blue-fill header (= box_blue_filled) |
| `lifeline_line` | Sequence | Dashed vertical edge, no arrow |
| `activation_bar` | Sequence | Narrow blue-fill rectangle on lifeline |
| `fragment_box` | Sequence | Dashed outer + bold text label |
| `message_sync` | Sequence | Solid navy arrow, left-to-right |
| `message_return` | Sequence | Dashed open arrow, right-to-left |
| `org_node_primary` | Org chart | Blue fill (CEO, VP level) |
| `org_node_leaf` | Org chart | White fill (individual contributor) |
| `org_edge` | Org chart | Orthogonal, no arrowhead |
