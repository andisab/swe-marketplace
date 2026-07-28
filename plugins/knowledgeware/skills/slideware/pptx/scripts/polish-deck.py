#!/usr/bin/env python3
"""
polish-deck.py — Scan a .pptx for common visual issues that text-only review misses.

Runs after `node build-deck.js` and before rendering preview PNGs. Cheap heuristic checks
on the pptx XML; not a substitute for visual inspection but catches the recurring footguns:

  - Text overflow in narrow boxes
  - Vertical imbalance (top-heavy or bottom-heavy slides)
  - Title positioned too high relative to content
  - Off-grid alignment in what looks like a row
  - Insufficient margin from slide edges

Usage:
  python3 polish-deck.py <deck.pptx> [--strict]

  --strict: exit 1 if any issues found (for CI-style gating).

Reports issues to stdout as plain text; with --json, emits structured JSON.
"""
import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

EMU_PER_INCH = 914400
SLIDE_W_IN = 10.0    # 16:9 default
SLIDE_H_IN = 5.625

# Same char-advance averages as scripts/text-fit.js, so reports stay consistent
AVG_ADVANCE = {
    "Inter": 0.52, "Inter Variable": 0.52, "SF Pro Text": 0.50, "SF Pro Display": 0.50,
    "Helvetica": 0.52, "Arial": 0.52, "Calibri": 0.50,
    "Source Serif 4": 0.55, "Source Serif": 0.55, "Georgia": 0.54, "Lora": 0.55,
    "Bitter": 0.56, "Trebuchet MS": 0.52, "Times New Roman": 0.51,
    "Anthropic Serif": 0.55, "Anthropic Sans": 0.52,
    "default": 0.53,
}

def emu_to_in(e):
    try: return e / EMU_PER_INCH
    except Exception: return 0.0

def avg_char_width_in(font_pt, font_face):
    em = AVG_ADVANCE.get(font_face or "default", AVG_ADVANCE["default"])
    return (em * font_pt) / 72.0

def collect_shapes(slide_root):
    """Return list of dicts: {kind, x, y, w, h, text, font_pt, font_face, is_placeholder_title}.

    Coordinates in inches. text is the concatenated visible text.
    """
    shapes = []
    for sp in slide_root.iter("{%s}sp" % NS["p"]):
        xfrm = sp.find(".//{%s}xfrm" % NS["a"])
        if xfrm is None: continue
        off = xfrm.find("{%s}off" % NS["a"])
        ext = xfrm.find("{%s}ext" % NS["a"])
        if off is None or ext is None: continue
        x = emu_to_in(int(off.get("x") or 0))
        y = emu_to_in(int(off.get("y") or 0))
        w = emu_to_in(int(ext.get("cx") or 0))
        h = emu_to_in(int(ext.get("cy") or 0))

        # Text and font
        ts = sp.findall(".//{%s}t" % NS["a"])
        text = " ".join(t.text or "" for t in ts).strip()
        rPr = sp.find(".//{%s}rPr" % NS["a"])
        defRPr = sp.find(".//{%s}defRPr" % NS["a"])
        sz = None
        font_face = None
        if rPr is not None and rPr.get("sz"):
            sz = int(rPr.get("sz")) / 100.0
        elif defRPr is not None and defRPr.get("sz"):
            sz = int(defRPr.get("sz")) / 100.0
        latin = sp.find(".//{%s}latin" % NS["a"])
        if latin is not None:
            font_face = latin.get("typeface")

        # Detect explicit title placeholder
        ph = sp.find(".//{%s}ph" % NS["p"])
        is_title_ph = ph is not None and (ph.get("type") in ("title", "ctrTitle"))

        # Plain rectangles with no text aren't interesting for text-overflow but matter for layout balance
        has_text = bool(text)

        shapes.append({
            "kind": "sp",
            "x": round(x, 3), "y": round(y, 3),
            "w": round(w, 3), "h": round(h, 3),
            "text": text,
            "text_len": len(text),
            "font_pt": sz,
            "font_face": font_face,
            "is_title_ph": is_title_ph,
            "has_text": has_text,
        })

    # Pictures and graphic frames count for layout balance
    for pic in slide_root.iter("{%s}pic" % NS["p"]):
        xfrm = pic.find(".//{%s}xfrm" % NS["a"])
        if xfrm is None: continue
        off = xfrm.find("{%s}off" % NS["a"]); ext = xfrm.find("{%s}ext" % NS["a"])
        if off is None or ext is None: continue
        shapes.append({
            "kind": "pic",
            "x": round(emu_to_in(int(off.get("x") or 0)), 3),
            "y": round(emu_to_in(int(off.get("y") or 0)), 3),
            "w": round(emu_to_in(int(ext.get("cx") or 0)), 3),
            "h": round(emu_to_in(int(ext.get("cy") or 0)), 3),
            "text": "", "text_len": 0, "font_pt": None,
            "font_face": None, "is_title_ph": False, "has_text": False,
        })
    for gf in slide_root.iter("{%s}graphicFrame" % NS["p"]):
        xfrm = gf.find("{%s}xfrm" % NS["p"])
        if xfrm is None: continue
        off = xfrm.find("{%s}off" % NS["a"]); ext = xfrm.find("{%s}ext" % NS["a"])
        if off is None or ext is None: continue
        shapes.append({
            "kind": "graphicFrame",
            "x": round(emu_to_in(int(off.get("x") or 0)), 3),
            "y": round(emu_to_in(int(off.get("y") or 0)), 3),
            "w": round(emu_to_in(int(ext.get("cx") or 0)), 3),
            "h": round(emu_to_in(int(ext.get("cy") or 0)), 3),
            "text": "", "text_len": 0, "font_pt": None,
            "font_face": None, "is_title_ph": False, "has_text": False,
        })
    return shapes


def check_text_overflow(shapes):
    """Estimate per-text-box whether content fits at the declared font size."""
    issues = []
    for s in shapes:
        if not s["has_text"] or not s["font_pt"] or s["w"] <= 0 or s["h"] <= 0:
            continue
        # Skip absurdly short texts in absurdly large boxes
        if s["text_len"] < 4: continue
        # Skip display-size text (>=60pt). Estimator is unreliable at huge sizes
        # because the average-advance constant becomes inaccurate, and authors typically
        # size display boxes by hand anyway.
        if s["font_pt"] >= 60: continue
        usable_w = max(0.1, s["w"] - 0.1)   # assume ~0.05" padding each side
        usable_h = max(0.1, s["h"] - 0.1)
        char_w = avg_char_width_in(s["font_pt"], s["font_face"])
        chars_per_line = max(1, int(usable_w / char_w))
        # Treat the text as one paragraph; \n parsing not robust through XML <a:t> boundaries
        lines = max(1, (s["text_len"] + chars_per_line - 1) // chars_per_line)
        line_h_in = (s["font_pt"] * 1.3) / 72.0
        capacity = max(1, int(usable_h / line_h_in))
        if lines > capacity:
            issues.append({
                "type": "text_overflow",
                "severity": "high" if lines > capacity + 1 else "medium",
                "x": s["x"], "y": s["y"], "w": s["w"], "h": s["h"],
                "font_pt": s["font_pt"], "text_preview": s["text"][:60] + ("…" if len(s["text"]) > 60 else ""),
                "needed_lines": lines, "available_lines": capacity,
            })
    return issues


def check_vertical_balance(shapes):
    """Compute the centroid of non-trivial content and flag top-heavy/bottom-heavy slides.

    On a 5.625" slide, the visual center is at y=2.81". Content centroid should sit
    in [2.0, 3.4] for balance, unless the slide is intentionally top-loaded (title hero).
    """
    # Filter to actual content shapes (must be inside slide bounds, have non-zero area)
    content = [s for s in shapes if s["w"] > 0.2 and s["h"] > 0.15 and 0 <= s["y"] < SLIDE_H_IN]
    if not content: return []

    # Weighted centroid by area, but excluding full-bleed bg rects
    weighted = []
    for s in content:
        # Skip backgrounds (cover entire slide)
        if s["w"] >= SLIDE_W_IN - 0.5 and s["h"] >= SLIDE_H_IN - 0.5: continue
        area = s["w"] * s["h"]
        cy = s["y"] + s["h"] / 2.0
        weighted.append((cy, area))
    if not weighted: return []
    total_area = sum(a for _, a in weighted)
    if total_area == 0: return []
    centroid_y = sum(cy * a for cy, a in weighted) / total_area

    # Also: top-of-content and bottom-of-content y positions
    top_y = min(s["y"] for s in content)
    bottom_y = max(s["y"] + s["h"] for s in content)

    issues = []
    # Heuristic 1: massive empty top margin with content concentrated near bottom
    if top_y > 1.2 and centroid_y > 3.5:
        issues.append({
            "type": "vertical_imbalance_bottom_heavy",
            "severity": "medium",
            "centroid_y": round(centroid_y, 2),
            "top_margin_in": round(top_y, 2),
            "hint": "Top of slide has >1.2\" empty space and centroid is below 3.5\". Move content up or add something near the top.",
        })
    # Heuristic 2: content all in top half with empty bottom
    elif bottom_y < 3.8 and centroid_y < 2.3 and top_y < 1.0:
        issues.append({
            "type": "vertical_imbalance_top_heavy",
            "severity": "medium",
            "centroid_y": round(centroid_y, 2),
            "bottom_y": round(bottom_y, 2),
            "hint": "Content ends above y=3.8\" with centroid in top third. Add closing element (caption/footer) or move content down.",
        })
    return issues


def check_title_position(shapes):
    """If the dominant headline sits very high with a big gap below it, flag."""
    issues = []
    candidates = [s for s in shapes if s["has_text"] and s["font_pt"] and s["font_pt"] >= 24]
    if not candidates: return issues
    # Largest font_pt = presumed title
    title = max(candidates, key=lambda s: s["font_pt"])
    if title["y"] < 0.4:
        # Now check if there's content below it within reasonable distance
        below = [s for s in shapes if s["has_text"] and s is not title and s["y"] > title["y"] + title["h"]]
        if below:
            nearest_y = min(s["y"] for s in below)
            gap = nearest_y - (title["y"] + title["h"])
            if gap > 0.9:
                issues.append({
                    "type": "title_too_high",
                    "severity": "low",
                    "title_y": title["y"], "title_h": title["h"],
                    "gap_to_next_in": round(gap, 2),
                    "title_preview": title["text"][:60],
                    "hint": f"Title at y={title['y']}\" with {gap:.1f}\" gap to next content. Consider y=0.5-0.8\" for better visual balance.",
                })
    return issues


def check_title_slide_balance(shapes, slide_num):
    """Detect bottom-heavy title slides via centroid analysis.

    Title slides (slide 1 by convention) should feel anchored — visual mass distributed
    across the canvas, not crowded in the lower half with empty top.

    On a 5.625" canvas, the vertical center is 2.81". A balanced title slide has
    its weighted centroid within ~0.3" of center (between 2.5 and 3.1"). If the
    centroid sits below 3.0", combined with little visual mass in the top half
    (no shapes with area >= 0.5 sq-in above y=1.8), flag it.

    The remedy is one of: move the headline up; add an eyebrow kicker near y=0.6;
    place a deliberate visual element (image, accent block) in the top half.
    """
    if slide_num != 1: return []
    text_shapes = [s for s in shapes if s["has_text"] and s["w"] >= 0.5 and s["h"] >= 0.2]
    if not text_shapes: return []
    big_text = [s for s in text_shapes if s["font_pt"] and s["font_pt"] >= 28]
    if not big_text: return []

    # Compute weighted centroid of non-trivial content (excluding bg fill)
    content = [s for s in shapes if s["w"] > 0.2 and s["h"] > 0.15
               and not (s["w"] >= SLIDE_W_IN - 0.5 and s["h"] >= SLIDE_H_IN - 0.5)]
    if not content: return []
    weighted = [(s["y"] + s["h"] / 2.0, s["w"] * s["h"]) for s in content]
    total_area = sum(a for _, a in weighted)
    if total_area == 0: return []
    centroid_y = sum(cy * a for cy, a in weighted) / total_area

    # Check visual mass in top half (y < 2.0). Sum of area for content above the canvas midline.
    top_half_area = sum(s["w"] * s["h"] for s in content if s["y"] + s["h"] / 2.0 < 2.0)

    # Heuristic: title slide reads as bottom-heavy if BOTH:
    #   (a) the weighted centroid sits noticeably below canvas center (2.81"), AND
    #   (b) the upper quarter of the slide (y<1.4") has no anchoring content
    upper_quarter_content = [s for s in content if s["y"] < 1.4]
    if centroid_y > 3.0 and not upper_quarter_content:
        headline = max(big_text, key=lambda s: s["font_pt"])
        return [{
            "type": "title_slide_bottom_heavy",
            "severity": "medium",
            "slide": slide_num,
            "centroid_y": round(centroid_y, 2),
            "top_half_area_sqin": round(top_half_area, 2),
            "headline_y": headline["y"],
            "headline_preview": headline["text"][:60],
            "hint": (
                f"Title slide centroid at y={centroid_y:.2f}\" (canvas center is 2.81\"), "
                f"with only {top_half_area:.2f} sq-in of content in the top half. "
                f"Move the headline up (try y=1.4-1.8\"), add an eyebrow near y=0.6\", "
                f"or place a visual element (image/accent block) in the upper half."
            ),
        }]
    return []


def check_edge_margins(shapes):
    """Content closer than 0.2" to a side edge (left/right) is flagged.
    Footers/page numbers are typically placed 0.1-0.15" from bottom intentionally;
    don't flag those — only flag bottom encroachment <0.05" (literally touching the edge).
    """
    issues = []
    for s in shapes:
        if not s["has_text"] or s["w"] <= 0 or s["h"] <= 0: continue
        right = s["x"] + s["w"]
        bottom = s["y"] + s["h"]
        encroach = []
        if s["x"] < 0.25: encroach.append(f"left x={s['x']}")
        if s["y"] < 0.15: encroach.append(f"top y={s['y']}")
        if right > SLIDE_W_IN - 0.25: encroach.append(f"right={right:.2f}")
        if bottom > SLIDE_H_IN - 0.05: encroach.append(f"bottom={bottom:.2f}")
        if encroach:
            issues.append({
                "type": "edge_margin",
                "severity": "low",
                "text_preview": s["text"][:50],
                "encroachment": encroach,
            })
    return issues


def check_row_alignment(shapes):
    """Detect shapes that LOOK like a row (similar y, similar h, multiple, side-by-side) but drift.

    Heuristics to suppress false positives:
      - Require >= 3 members in the cluster (real rows have 3+ items)
      - Require members to be side-by-side: sorted by x, every consecutive pair must
        NOT overlap horizontally (a shape inside another shape isn't part of a row)
        AND must have a gap < 1.5" (so far-apart shapes aren't treated as a row).
    """
    issues = []
    candidates = [s for s in shapes if s["kind"] == "sp" and s["w"] >= 1.2 and s["h"] >= 0.4]
    if len(candidates) < 3: return issues
    groups = defaultdict(list)
    for s in candidates:
        key = round(s["y"], 1)
        groups[key].append(s)
    for _, members in groups.items():
        if len(members) < 3: continue
        sorted_members = sorted(members, key=lambda m: m["x"])
        is_row = True
        for a, b in zip(sorted_members, sorted_members[1:]):
            a_right = a["x"] + a["w"]
            gap = b["x"] - a_right
            # Reject if shapes overlap horizontally (stacked/layered) or are far apart
            if gap <= -0.1 or gap > 1.5:
                is_row = False; break
        if not is_row: continue
        ys = [m["y"] for m in sorted_members]
        hs = [m["h"] for m in sorted_members]
        if max(ys) - min(ys) > 0.02 or max(hs) - min(hs) > 0.05:
            issues.append({
                "type": "row_alignment_drift",
                "severity": "medium",
                "y_values": ys, "h_values": hs,
                "hint": "Shapes side-by-side in a row don't share exact y/h. Compute once, reuse.",
            })
    return issues


def check_invalid_dimensions(slide_root):
    """Detect zero or negative shape dimensions.

    Catches the most common PowerPoint-corruption bug: addShape(LINE, {h:0 or w:0})
    serializes to <a:ext cy="0"/> or cx="0" — LibreOffice tolerates it (so visual
    review misses it), PowerPoint rejects it with a "needs repair" dialog on open.

    The skill's pitfall list says to use thin RECTANGLE instead of LINE for hairlines.
    """
    issues = []
    # Only check shapes inside <p:spPr>, not the group-level <p:grpSpPr> (which
    # legitimately has cx=0 cy=0 — every slide does).
    for spPr in slide_root.iter("{http://schemas.openxmlformats.org/presentationml/2006/main}spPr"):
        ext = spPr.find("{http://schemas.openxmlformats.org/drawingml/2006/main}xfrm/"
                        "{http://schemas.openxmlformats.org/drawingml/2006/main}ext")
        if ext is None: continue
        try:
            cx, cy = int(ext.get("cx", 0)), int(ext.get("cy", 0))
        except (TypeError, ValueError):
            continue
        if cx <= 0 or cy <= 0:
            issues.append({
                "type": "invalid_dimensions",
                "severity": "high",
                "cx_emu": cx, "cy_emu": cy,
                "cx_in": round(cx / EMU_PER_INCH, 3),
                "cy_in": round(cy / EMU_PER_INCH, 3),
                "hint": (
                    "Shape has zero or negative dimension. PowerPoint rejects this "
                    "(LibreOffice tolerates it). Common cause: addShape(LINE, {h:0}) "
                    "for hairlines. Use addShape(RECTANGLE, {h:0.015}) instead."
                ),
            })
    return issues


def scan_slide(slide_num, slide_root):
    shapes = collect_shapes(slide_root)
    issues = []
    issues += check_text_overflow(shapes)
    issues += check_vertical_balance(shapes)
    issues += check_title_position(shapes)
    issues += check_title_slide_balance(shapes, slide_num)
    issues += check_edge_margins(shapes)
    issues += check_row_alignment(shapes)
    issues += check_invalid_dimensions(slide_root)
    for i in issues:
        i.setdefault("slide", slide_num)
    return issues


def scan(pptx_path: Path):
    findings = []
    with zipfile.ZipFile(pptx_path) as z:
        slide_names = sorted(
            (n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
            key=lambda n: int(re.search(r"slide(\d+)", n).group(1))
        )
        for n in slide_names:
            num = int(re.search(r"slide(\d+)", n).group(1))
            with z.open(n) as f:
                root = ET.parse(f).getroot()
            findings += scan_slide(num, root)
    return findings


def render_text(findings):
    if not findings:
        return "✓ polish-deck: no issues found"
    by_slide = defaultdict(list)
    for f in findings: by_slide[f["slide"]].append(f)
    out = [f"polish-deck: {len(findings)} issue(s) across {len(by_slide)} slide(s)\n"]
    for slide in sorted(by_slide):
        out.append(f"── Slide {slide} ──")
        for f in by_slide[slide]:
            sev = f.get("severity", "?")
            tp = f["type"]
            extra = ""
            if tp == "text_overflow":
                extra = f' (needs {f["needed_lines"]} lines, has {f["available_lines"]}, at {f["font_pt"]}pt): "{f["text_preview"]}"'
            elif tp == "title_too_high":
                extra = f' y={f["title_y"]}, gap below {f["gap_to_next_in"]}in: "{f["title_preview"]}"'
            elif tp.startswith("vertical_imbalance"):
                extra = f' centroid_y={f["centroid_y"]}: {f["hint"]}'
            elif tp == "title_slide_bottom_heavy":
                extra = f' centroid_y={f["centroid_y"]}: {f["hint"]}'
            elif tp == "edge_margin":
                extra = f' {f["encroachment"]}: "{f["text_preview"]}"'
            elif tp == "row_alignment_drift":
                extra = f' y={f["y_values"]} h={f["h_values"]}'
            elif tp == "invalid_dimensions":
                extra = f' cx={f["cx_in"]}in cy={f["cy_in"]}in — {f["hint"]}'
            out.append(f"  [{sev}] {tp}{extra}")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx", type=Path)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true", help="Exit 1 if any high-severity issues found")
    args = ap.parse_args()
    if not args.pptx.exists():
        print(f"Not found: {args.pptx}", file=sys.stderr); sys.exit(1)

    findings = scan(args.pptx)
    if args.json:
        print(json.dumps({"pptx": str(args.pptx), "findings": findings}, indent=2))
    else:
        print(render_text(findings))

    if args.strict and any(f.get("severity") == "high" for f in findings):
        sys.exit(1)


if __name__ == "__main__":
    main()
