#!/usr/bin/env python3
"""svg-lint.py — geometry and hygiene checks for chartware SVG diagrams and charts.

Checks the rules in references/svg-charts.md that a screenshot loop catches late or not at all:

  root        pixel-space viewBox, width/height, role="img", <title> + <desc> wired by aria-labelledby
  clip        anything (shapes, text extents) outside the viewBox, or inside the 16-unit padding
  diagonal    an edge segment that is neither horizontal nor vertical (curves are fine)
  overlap     two edges sharing a collinear stretch (stacked lines)
  attach      two edges starting or ending at the same point (fan them at w*i/(n+1))
  transit     an edge segment passing through a node it isn't attached to
  clearance   an edge segment closer than 8 units to a node it isn't attached to
  crossing    edge crossings (more than 2 is a warning)
  label       an edge label whose box sits on an edge (offset it ~10 units), or a node label off its node's centre
  text        font sizes under 10, <tspan> without x=, labels wider than their node
  marker      marker-end/start that names a missing id
  ids         duplicate ids
  style       <style> selectors not namespaced under the root class
  grid        node corners off the 4-unit grid (info)
  budget      nodes, edges, accents, crossings against the complexity budget in SKILL.md

The checks read the template idiom: class names containing "node" (rect or circle), "edge" (path),
"elbl" (edge label), "group" (container), "lbl" (node label). Pure standard library.

Usage: python3 svg-lint.py FILE.svg [...]   [--json]   [--budget-nodes N --budget-edges N]
Exit 1 when any error is reported; warnings and infos don't fail the run.
"""
import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
PAD = 16
CLEAR = 8
BUDGET = {"nodes": 9, "edges": 12, "accents": 2, "crossings": 2}


def tag(el):
    return el.tag.replace(NS, "")


def num(v, default=None):
    if v is None:
        return default
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)", str(v))
    return float(m.group(1)) if m else default


def classes(el):
    return (el.get("class") or "").split()


def has(el, word):
    return any(word in c for c in classes(el))


# --- path parsing -------------------------------------------------------------

_TOK = re.compile(r"[MmLlHhVvQqCcAaZzSsTt]|-?\d*\.?\d+(?:e-?\d+)?")


def path_segments(d):
    """Return (segments, points). segments: list of ('L', (x1,y1), (x2,y2)) for straight pieces and
    ('C', pts...) for curves sampled to a polyline; points: every vertex (for bbox)."""
    toks = _TOK.findall(d or "")
    i = 0
    cmd = None
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    segs = []
    pts = []

    def take(n):
        nonlocal i
        vals = [float(t) for t in toks[i:i + n]]
        i += n
        return vals

    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                if cur != start:
                    segs.append(("L", cur, start))
                cur = start
                continue
        if cmd is None:
            break
        rel = cmd.islower()
        c = cmd.upper()
        if c == "M":
            x, y = take(2)
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            start = cur
            pts.append(cur)
            cmd = "l" if rel else "L"
        elif c == "L":
            x, y = take(2)
            nxt = (cur[0] + x, cur[1] + y) if rel else (x, y)
            segs.append(("L", cur, nxt))
            cur = nxt
            pts.append(cur)
        elif c == "H":
            (x,) = take(1)
            nxt = (cur[0] + x if rel else x, cur[1])
            segs.append(("L", cur, nxt))
            cur = nxt
            pts.append(cur)
        elif c == "V":
            (y,) = take(1)
            nxt = (cur[0], cur[1] + y if rel else y)
            segs.append(("L", cur, nxt))
            cur = nxt
            pts.append(cur)
        elif c in "QT":
            n = 4 if c == "Q" else 2
            v = take(n)
            if rel:
                v = [v[k] + cur[k % 2] for k in range(n)]
            p1 = (v[0], v[1]) if c == "Q" else cur
            end = (v[-2], v[-1])
            poly = [cur]
            for s in range(1, 9):
                u = s / 8
                poly.append(((1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * p1[0] + u * u * end[0],
                             (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * p1[1] + u * u * end[1]))
            segs.append(("C", poly))
            cur = end
            pts.extend(poly)
        elif c in "CS":
            n = 6 if c == "C" else 4
            v = take(n)
            if rel:
                v = [v[k] + cur[k % 2] for k in range(n)]
            if c == "C":
                p1, p2, end = (v[0], v[1]), (v[2], v[3]), (v[4], v[5])
            else:
                p1, p2, end = cur, (v[0], v[1]), (v[2], v[3])
            poly = [cur]
            for s in range(1, 13):
                u = s / 12
                poly.append(((1 - u) ** 3 * cur[0] + 3 * (1 - u) ** 2 * u * p1[0] + 3 * (1 - u) * u * u * p2[0] + u ** 3 * end[0],
                             (1 - u) ** 3 * cur[1] + 3 * (1 - u) ** 2 * u * p1[1] + 3 * (1 - u) * u * u * p2[1] + u ** 3 * end[1]))
            segs.append(("C", poly))
            cur = end
            pts.extend(poly)
        elif c == "A":
            v = take(7)
            end = (cur[0] + v[5], cur[1] + v[6]) if rel else (v[5], v[6])
            segs.append(("C", [cur, end]))
            cur = end
            pts.append(end)
        else:
            break
    return segs, pts


def straight_pieces(segs):
    """Every straight piece, including the polyline pieces of curves, as ((x1,y1),(x2,y2), is_curve)."""
    out = []
    for s in segs:
        if s[0] == "L":
            out.append((s[1], s[2], False))
        else:
            poly = s[1]
            for a, b in zip(poly, poly[1:]):
                out.append((a, b, True))
    return out


# --- geometry helpers -----------------------------------------------------------

def seg_intersect(p1, p2, p3, p4):
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2 = ccw(p3, p4, p1), ccw(p3, p4, p2)
    d3, d4 = ccw(p1, p2, p3), ccw(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0)) and d1 != 0 and d2 != 0 and d3 != 0 and d4 != 0


def point_seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def seg_rect_dist(a, b, r):
    """Distance from segment ab to rectangle r=(x,y,w,h); 0 when it touches or crosses it."""
    x, y, w, h = r
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    edges = list(zip(corners, corners[1:] + corners[:1]))
    if any(seg_intersect(a, b, c, d) for c, d in edges):
        return 0.0
    inside = lambda p: x <= p[0] <= x + w and y <= p[1] <= y + h
    if inside(a) or inside(b):
        return 0.0
    d = min(point_seg_dist(c, a, b) for c in corners)
    for c, e in edges:
        d = min(d, point_seg_dist(a, c, e), point_seg_dist(b, c, e))
    return d


def seg_inside_rect(a, b, r, tol=1.0):
    """True when the segment has a stretch strictly inside the rect (not just touching its boundary)."""
    x, y, w, h = r
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    return x + tol < mid[0] < x + w - tol and y + tol < mid[1] < y + h - tol


def collinear_overlap(a, b, c, d, tol=1.0):
    """Length of overlap when ab and cd lie on the same horizontal or vertical line."""
    if abs(a[1] - b[1]) <= tol and abs(c[1] - d[1]) <= tol and abs(a[1] - c[1]) <= tol:
        lo, hi = max(min(a[0], b[0]), min(c[0], d[0])), min(max(a[0], b[0]), max(c[0], d[0]))
        return max(0.0, hi - lo)
    if abs(a[0] - b[0]) <= tol and abs(c[0] - d[0]) <= tol and abs(a[0] - c[0]) <= tol:
        lo, hi = max(min(a[1], b[1]), min(c[1], d[1])), min(max(a[1], b[1]), max(c[1], d[1]))
        return max(0.0, hi - lo)
    return 0.0


# --- the lint ---------------------------------------------------------------------

class Lint:
    def __init__(self, path, budget):
        self.path = path
        self.budget = budget
        self.findings = []
        self.counts = {"nodes": 0, "edges": 0, "accents": 0, "crossings": 0, "labels": 0}

    def add(self, level, code, msg):
        self.findings.append({"level": level, "code": code, "message": msg})

    def run(self):
        try:
            root = ET.parse(self.path).getroot()
        except ET.ParseError as e:
            self.add("error", "parse", f"not well-formed XML: {e}")
            return self
        if tag(root) != "svg":
            self.add("error", "root", "root element is not <svg>")
            return self
        self.root = root
        self.parents = {c: p for p in root.iter() for c in p}
        self.root_class = (root.get("class") or "").split()[0] if root.get("class") else None
        self.styles = self.parse_style(root)
        vb = self.check_root(root)
        if vb is None:
            return self
        self.vb = vb
        self.collect(root)
        self.check_ids(root)
        self.check_style()
        self.check_clip()
        self.check_edges()
        self.check_labels()
        self.check_text()
        self.check_budget()
        return self

    # -- root and style
    def check_root(self, root):
        vb = [num(v) for v in (root.get("viewBox") or "").replace(",", " ").split()]
        if len(vb) != 4 or None in vb:
            self.add("error", "root", "missing or malformed viewBox; use pixel space such as 0 0 720 400")
            return None
        if vb[2] <= 120 and vb[3] <= 120 and vb[2] == vb[3] and not root.get("width"):
            self.add("warn", "root", f"viewBox {vb[2]:g}x{vb[3]:g} looks normalized; chartware uses pixel-space viewBoxes")
        if not root.get("width") or not root.get("height"):
            self.add("warn", "root", "width/height attributes missing (they give the intrinsic ratio and stop layout shift)")
        if root.get("role") != "img":
            self.add("error", "root", 'role="img" missing on the root')
        title = root.find(NS + "title")
        desc = root.find(NS + "desc")
        if title is None or not (title.text or "").strip():
            self.add("error", "root", "<title> missing or empty (must be the first child)")
        elif list(root).index(title) != 0:
            self.add("warn", "root", "<title> should be the first child of <svg>")
        if desc is None or not (desc.text or "").strip():
            self.add("error", "root", "<desc> missing or empty (state the takeaway, not 'a chart of data')")
        lab = (root.get("aria-labelledby") or "").split()
        ids = {el.get("id") for el in root.iter() if el.get("id")}
        if not lab:
            self.add("error", "root", "aria-labelledby missing (name the title and desc ids)")
        else:
            for ref in lab:
                if ref not in ids:
                    self.add("error", "root", f"aria-labelledby names '{ref}', which no element has as its id")
        if root.get("preserveAspectRatio") == "none":
            self.add("error", "root", 'preserveAspectRatio="none" smears text; use xMidYMid meet')
        if "xmlns" not in open(self.path, encoding="utf-8").read(2000):
            self.add("warn", "root", "no xmlns attribute: fine inline, broken as a standalone .svg file")
        return vb

    def parse_style(self, root):
        """class -> {prop: value} from the <style> block (last rule wins), plus the raw selector list."""
        css = "\n".join((s.text or "") for s in root.iter(NS + "style"))
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        rules = []   # (chain, props): chain = list of class sets, outermost first, last = the element
        selectors = []
        for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
            sel = sel.strip()
            if sel.startswith("@") or not sel or sel in ("from", "to") or re.fullmatch(r"[\d.%, ]+", sel):
                continue
            selectors.append(sel)
            props = {}
            for decl in body.split(";"):
                if ":" in decl:
                    k, v = decl.split(":", 1)
                    props[k.strip()] = v.strip()
            for part in sel.split(","):
                chain = []
                for compound in part.split():
                    cls = set(re.findall(r"\.([A-Za-z_][\w-]*)", compound))
                    if cls:
                        chain.append(cls)
                if chain:
                    rules.append((chain, props))
        self.selectors = selectors
        return rules

    def matches(self, el, chain):
        """Descendant matching: the last class set must be on el, earlier ones on ancestors in order."""
        if not chain[-1] <= set(classes(el)):
            return False
        anc = self.parents.get(el)
        for cls in reversed(chain[:-1]):
            while anc is not None and not cls <= set(classes(anc)):
                anc = self.parents.get(anc)
            if anc is None:
                return False
            anc = self.parents.get(anc)
        return True

    def prop(self, el, name, default=None):
        """A CSS property for an element: inline attribute, style="", then class rules."""
        if el.get(name) is not None:
            return el.get(name)
        st = el.get("style") or ""
        m = re.search(rf"(?:^|;)\s*{re.escape(name)}\s*:\s*([^;]+)", st)
        if m:
            return m.group(1).strip()
        value = None
        for chain, props in self.styles:
            if name in props and self.matches(el, chain):
                value = props[name]  # later rules win
        if value is not None:
            return value
        # inherited presentation attributes come from ancestors (e.g. text-anchor on a <g>)
        if name in ("text-anchor", "font-size", "font-family", "stroke-linecap"):
            parent = self.parents.get(el)
            if parent is not None:
                return self.prop(parent, name, default)
        return default

    def check_style(self):
        if not self.root_class:
            if self.selectors:
                self.add("warn", "style", "root has no class, so <style> rules can't be namespaced to this chart")
            return
        bad = [s for s in self.selectors if not s.lstrip().startswith("." + self.root_class) and not s.lstrip().startswith("@")]
        for s in bad[:5]:
            self.add("warn", "style", f"selector '{s}' is not namespaced under .{self.root_class}; inline <style> is document-global")

    def check_ids(self, root):
        seen = {}
        for el in root.iter():
            i = el.get("id")
            if i:
                seen[i] = seen.get(i, 0) + 1
        for i, n in seen.items():
            if n > 1:
                self.add("error", "ids", f"id '{i}' is used {n} times")
        markers = {el.get("id") for el in root.iter(NS + "marker")}
        for el in root.iter():
            for attr in ("marker-end", "marker-start", "marker-mid"):
                v = el.get(attr) or ""
                m = re.match(r"url\(#([^)]+)\)", v)
                if m and m.group(1) not in markers:
                    self.add("error", "marker", f"{attr} names '#{m.group(1)}', which is not a <marker> in this file")

    # -- collect shapes
    def collect(self, root):
        self.nodes = []   # (rect tuple, element)
        self.groups = []
        self.edges = []   # (element, segments, points)
        self.elabels = []
        self.texts = []
        self.shapes = []  # (bbox, element) for clip check
        self.offset = {}  # element -> (dx, dy) from ancestor translate() transforms
        self.walk(root, 0.0, 0.0)
        for el in root.iter():
            t = tag(el)
            if el not in self.offset:
                continue  # inside <defs>/<marker>, or under a non-translate transform
            dx, dy = self.offset[el]
            if t == "rect":
                r = (num(el.get("x"), 0) + dx, num(el.get("y"), 0) + dy, num(el.get("width"), 0), num(el.get("height"), 0))
                self.shapes.append((r, el))
                if has(el, "node"):
                    self.nodes.append((r, el))
                    self.counts["nodes"] += 1
                    if has(el, "node-accent"):
                        self.counts["accents"] += 1
                elif has(el, "group"):
                    self.groups.append((r, el))
            elif t == "circle":
                cx, cy, rr = num(el.get("cx"), 0) + dx, num(el.get("cy"), 0) + dy, num(el.get("r"), 0)
                r = (cx - rr, cy - rr, 2 * rr, 2 * rr)
                self.shapes.append((r, el))
                if has(el, "node"):
                    self.nodes.append((r, el))
                    self.counts["nodes"] += 1
            elif t == "path":
                segs, pts = path_segments(el.get("d"))
                if dx or dy:
                    segs = [("L", (a[0] + dx, a[1] + dy), (b[0] + dx, b[1] + dy)) if sg[0] == "L" else ("C", [(q[0] + dx, q[1] + dy) for q in sg[1]]) for sg in segs for a, b in [(sg[1], sg[2]) if sg[0] == "L" else ((0, 0), (0, 0))]]
                    pts = [(q[0] + dx, q[1] + dy) for q in pts]
                if pts:
                    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
                    self.shapes.append(((min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), el))
                if has(el, "edge"):
                    self.edges.append((el, segs, pts))
                    self.counts["edges"] += 1
                    if has(el, "edge-accent"):
                        self.counts["accents"] += 1
            elif t == "line":
                a = (num(el.get("x1"), 0) + dx, num(el.get("y1"), 0) + dy)
                b = (num(el.get("x2"), 0) + dx, num(el.get("y2"), 0) + dy)
                segs = [("L", a, b)]
                self.shapes.append(((min(a[0], b[0]), min(a[1], b[1]), abs(a[0] - b[0]), abs(a[1] - b[1])), el))
                if has(el, "edge"):
                    self.edges.append((el, segs, [a, b]))
                    self.counts["edges"] += 1
            elif t == "text":
                box = self.text_box(el, dx, dy)
                if box:
                    self.shapes.append((box, el))
                    self.texts.append((box, el))
                    if has(el, "elbl"):
                        self.elabels.append((box, el))
                        self.counts["labels"] += 1

    def walk(self, el, dx, dy):
        """Record each drawable element's offset from ancestor translate() transforms.
        Elements under <defs>, <marker>, <clipPath> or a non-translate transform are left out."""
        t = tag(el)
        if t in ("defs", "marker", "clipPath", "pattern", "symbol", "linearGradient", "radialGradient", "style", "title", "desc"):
            return
        tr = el.get("transform")
        if tr and t != "text":
            m = re.fullmatch(r"\s*translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)\s*", tr)
            if not m:
                return  # rotate/scale/matrix: geometry can't be read as plain coordinates
            dx += float(m.group(1))
            dy += float(m.group(2))
        if t != "svg":
            self.offset[el] = (dx, dy)
        for child in el:
            self.walk(child, dx, dy)

    def font_size(self, el):
        v = self.prop(el, "font-size")
        return num(v, 13.0) if v else 13.0

    def text_box(self, el, dx=0.0, dy=0.0):
        if el.get("transform"):
            return None  # rotated labels: skip extent math
        x, y = num(el.get("x")), num(el.get("y"))
        if x is None or y is None:
            return None
        x, y = x + dx, y + dy
        fs = self.font_size(el)
        lines = [(el.text or "").strip()]
        for ts in el.findall(NS + "tspan"):
            lines.append((ts.text or "").strip())
        lines = [l for l in lines if l]
        if not lines:
            return None
        width = max(len(l) for l in lines) * fs * 0.6
        anchor = self.prop(el, "text-anchor", "start")
        if anchor == "middle":
            x0 = x - width / 2
        elif anchor == "end":
            x0 = x - width
        else:
            x0 = x
        height = fs * (1 + 1.25 * (len(lines) - 1))
        return (x0, y - fs * 0.8, width, height)

    # -- checks
    def check_clip(self):
        vx, vy, vw, vh = self.vb
        for (x, y, w, h), el in self.shapes:
            name = tag(el) + ("." + classes(el)[0] if classes(el) else "")
            if x < vx - 0.5 or y < vy - 0.5 or x + w > vx + vw + 0.5 or y + h > vy + vh + 0.5:
                self.add("error", "clip", f"{name} at ({x:g},{y:g}) {w:g}x{h:g} extends outside the viewBox and will be clipped")
            elif tag(el) in ("rect", "circle") and has(el, "node") and (x < vx + PAD or y < vy + PAD or x + w > vx + vw - PAD or y + h > vy + vh - PAD):
                self.add("warn", "clip", f"{name} at ({x:g},{y:g}) is inside the {PAD}-unit padding; strokes center on geometry and lose half their width at the boundary")

    def attached(self, p, r, tol=2.0):
        x, y, w, h = r
        return (x - tol <= p[0] <= x + w + tol) and (y - tol <= p[1] <= y + h + tol)

    def check_clip_point(self, p):
        return p

    def check_edges(self):
        ends = []
        pieces = []  # (edge index, a, b, is_curve)
        for idx, (el, segs, pts) in enumerate(self.edges):
            if not pts:
                self.add("error", "edge", f"edge #{idx + 1} has no drawable path")
                continue
            ends.append((idx, pts[0], "start"))
            ends.append((idx, pts[-1], "end"))
            for a, b, curve in straight_pieces(segs):
                pieces.append((idx, a, b, curve))
                if not curve and abs(a[0] - b[0]) > 1 and abs(a[1] - b[1]) > 1:
                    ang = math.degrees(math.atan2(abs(b[1] - a[1]), abs(b[0] - a[0])))
                    self.add("error", "diagonal", f"edge #{idx + 1} has a diagonal straight segment ({a[0]:g},{a[1]:g})→({b[0]:g},{b[1]:g}) at {ang:.0f}°; route it orthogonally through the gutters or draw a curve")
            cap = self.prop(el, "stroke-linecap")
            if (el.get("marker-end") or el.get("marker-start")) and cap in ("round", "square"):
                self.add("warn", "marker", f"edge #{idx + 1} has stroke-linecap:{cap} with an arrowhead; the cap pokes through the tip (use butt)")
            # grid: endpoints on the 4-unit grid
            for p in (pts[0], pts[-1]):
                if abs(p[0] / 4 - round(p[0] / 4)) > 0.01 or abs(p[1] / 4 - round(p[1] / 4)) > 0.01:
                    self.add("info", "grid", f"edge #{idx + 1} endpoint ({p[0]:g},{p[1]:g}) is off the 4-unit grid")
                    break
        # shared attach points
        for i in range(len(ends)):
            for j in range(i + 1, len(ends)):
                (ei, p, kind), (ej, q, kind2) = ends[i], ends[j]
                if ei != ej and math.hypot(p[0] - q[0], p[1] - q[1]) <= 2:
                    self.add("error", "attach", f"edges #{ei + 1} and #{ej + 1} share the attach point ({p[0]:g},{p[1]:g}); fan exits at w·i/(n+1) instead of stacking")
        # overlap, crossings, transit, clearance
        crossings = 0
        reported = set()
        for i in range(len(pieces)):
            ei, a, b, ca = pieces[i]
            for j in range(i + 1, len(pieces)):
                ej, c, d, cb = pieces[j]
                if ei == ej:
                    continue
                ov = collinear_overlap(a, b, c, d)
                if ov > 2 and (ei, ej) not in reported:
                    reported.add((ei, ej))
                    self.add("error", "overlap", f"edges #{ei + 1} and #{ej + 1} run on top of each other for {ov:g} units")
                elif seg_intersect(a, b, c, d):
                    key = ("x", ei, ej)
                    if key not in reported:
                        reported.add(key)
                        crossings += 1
        self.counts["crossings"] = crossings
        for ei, a, b, curve in pieces:
            for r, nel in self.nodes:
                pts = self.edges[ei][2]
                attached_here = self.attached(pts[0], r) or self.attached(pts[-1], r)
                if seg_inside_rect(a, b, r) and not (attached_here and (self.attached(a, r) or self.attached(b, r))):
                    key = ("t", ei, id(nel))
                    if key not in reported:
                        reported.add(key)
                        self.add("error", "transit", f"edge #{ei + 1} passes through node at ({r[0]:g},{r[1]:g}) {r[2]:g}x{r[3]:g}; route it around")
                elif not attached_here:
                    dist = seg_rect_dist(a, b, r)
                    if 0 < dist < CLEAR:
                        key = ("c", ei, id(nel))
                        if key not in reported:
                            reported.add(key)
                            self.add("warn", "clearance", f"edge #{ei + 1} passes {dist:.0f} units from node at ({r[0]:g},{r[1]:g}); keep ≥{CLEAR}")
        if crossings > self.budget["crossings"]:
            self.add("warn", "crossing", f"{crossings} edge crossings; the budget is {self.budget['crossings']} — reorder nodes or split the diagram")

    def check_labels(self):
        pieces = [(ei, a, b) for ei, a, b, _ in [(i, a, b, c) for i, (el, segs, pts) in enumerate(self.edges) for a, b, c in straight_pieces(segs)]]
        for box, el in self.elabels:
            x, y, w, h = box
            txt = (el.text or "").strip()
            on_line = False
            for ei, a, b in pieces:
                if seg_rect_dist(a, b, box) == 0:
                    on_line = True
                    break
            if on_line:
                self.add("warn", "label", f"edge label '{txt}' sits on an edge; offset it ~10 units perpendicular to the line (the halo should rarely be needed)")
        # node labels centred on their node and not wider than it
        for box, el in self.texts:
            if not has(el, "lbl"):
                continue
            x = num(el.get("x"))
            y = num(el.get("y"))
            if x is None or y is None:
                continue
            dx, dy = self.offset.get(el, (0.0, 0.0))
            x, y = x + dx, y + dy
            txt = (el.text or "").strip()
            for r, nel in self.nodes:
                rx, ry, rw, rh = r
                if rx <= x <= rx + rw and ry <= y <= ry + rh:
                    cx = rx + rw / 2
                    if abs(x - cx) > 1 and self.prop(el, "text-anchor") == "middle":
                        self.add("warn", "label", f"label '{txt}' is at x={x:g} but its node's centre is {cx:g}")
                    if box[2] > rw - 16:
                        self.add("warn", "text", f"label '{txt}' is ~{box[2]:.0f} units wide for a {rw:g}-unit node; shorten it or add a line")
                    break

    def check_text(self):
        for el in self.root.iter(NS + "text"):
            fs = self.font_size(el)
            if fs < 10:
                self.add("error", "text", f"font-size {fs:g} on '{(el.text or '').strip()[:30]}' is under the 10-unit floor")
            for ts in el.findall(NS + "tspan"):
                if ts.get("dy") and ts.get("x") is None:
                    self.add("error", "text", f"<tspan> with dy but no x in '{(el.text or '').strip()[:30]}': the lines staircase")

    def check_budget(self):
        c = self.counts
        if c["nodes"] == 0 and c["edges"] == 0:
            return  # a data chart; the budget is for diagrams
        over = []
        if c["nodes"] > self.budget["nodes"]:
            over.append(f"{c['nodes']} nodes (budget {self.budget['nodes']})")
        if c["edges"] > self.budget["edges"]:
            over.append(f"{c['edges']} edges (budget {self.budget['edges']})")
        if c["accents"] > self.budget["accents"]:
            over.append(f"{c['accents']} accent roles (budget {self.budget['accents']})")
        if over:
            self.add("warn", "budget", "over the complexity budget: " + ", ".join(over) + " — split into an overview plus detail diagrams")
        else:
            self.add("info", "budget", f"{c['nodes']} nodes, {c['edges']} edges, {c['accents']} accents, {c['crossings']} crossings: within budget")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--budget-nodes", type=int, default=BUDGET["nodes"])
    ap.add_argument("--budget-edges", type=int, default=BUDGET["edges"])
    ap.add_argument("--budget-accents", type=int, default=BUDGET["accents"])
    ap.add_argument("--budget-crossings", type=int, default=BUDGET["crossings"])
    ap.add_argument("--quiet", action="store_true", help="hide info lines")
    args = ap.parse_args()
    budget = {"nodes": args.budget_nodes, "edges": args.budget_edges, "accents": args.budget_accents, "crossings": args.budget_crossings}
    errors = 0
    report = {}
    for f in args.files:
        lint = Lint(f, budget).run()
        report[f] = {"findings": lint.findings, "counts": lint.counts}
        n_err = sum(1 for x in lint.findings if x["level"] == "error")
        errors += n_err
        if not args.json:
            shown = [x for x in lint.findings if not (args.quiet and x["level"] == "info")]
            for x in shown:
                print(f"{x['level']:5} {x['code']:9} {f}: {x['message']}")
            n_warn = sum(1 for x in lint.findings if x["level"] == "warn")
            print(f"{f}: {n_err} errors, {n_warn} warnings")
    if args.json:
        print(json.dumps(report, indent=2))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
