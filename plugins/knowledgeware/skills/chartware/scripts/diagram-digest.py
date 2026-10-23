#!/usr/bin/env python3
"""diagram-digest.py — extract a diagram into a neutral digest, and compare a redraw against it.

Import and redraw, not convert: the digest is the list of nodes, edges and groups a diagram states, with
its labels and a few style hints, and nothing about pixels. chartware redraws from the digest in the target
medium (SVG, draw.io or Mermaid) under its own layout rules, then this script compares the redraw with the
original and writes the fidelity ledger: what was kept, renamed, merged, dropped and added.

    python3 diagram-digest.py extract FILE [--md]            # digest as JSON (default) or Markdown
    python3 diagram-digest.py ledger ORIGINAL REDRAWN [--md]  # fidelity ledger between two diagrams

Formats, detected by extension and content:
    .drawio / .xml   draw.io (mxGraphModel; the compressed <diagram> form is inflated)
    .mmd / .md       Mermaid flowchart or graph (the first ```mermaid block in a .md)
    .excalidraw / .json   Excalidraw scene
    .svg             a chartware SVG diagram (class names node*, edge*, elbl, lbl, group)

Standard library only. Exit 2 for an unreadable file; the ledger exits 0 whatever it finds.
"""
import base64
import html
import json
import math
import re
import sys
import urllib.parse
import zlib
import xml.etree.ElementTree as ET

SVG_NS = "{http://www.w3.org/2000/svg}"


# --- digest ---------------------------------------------------------------------

def digest(source, fmt):
    return {"source": source, "format": fmt, "direction": None, "nodes": [], "edges": [], "groups": []}


def finish(d):
    d["stats"] = {"nodes": len(d["nodes"]), "edges": len(d["edges"]), "groups": len(d["groups"])}
    return d


def clean_label(s):
    s = html.unescape(s or "")
    s = re.sub(r"<br\s*/?>", " / ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


# --- draw.io ------------------------------------------------------------------------

def inflate_drawio(text):
    """Return the mxGraphModel XML string from an .drawio file, inflating a compressed <diagram> if needed."""
    if "<mxGraphModel" in text:
        return text
    m = re.search(r"<diagram[^>]*>([^<]+)</diagram>", text)
    if not m:
        raise ValueError("no <mxGraphModel> or <diagram> payload found")
    raw = base64.b64decode(m.group(1).strip())
    inflated = zlib.decompress(raw, -15).decode("utf-8")
    return urllib.parse.unquote(inflated)


def extract_drawio(path, text):
    xml = inflate_drawio(text)
    root = ET.fromstring(xml)
    model = root if root.tag == "mxGraphModel" else root.find(".//mxGraphModel")
    if model is None:
        raise ValueError("no <mxGraphModel> in the file")
    cells = {c.get("id"): c for c in model.iter("mxCell")}
    d = digest(path, "drawio")
    geo = {}
    for cid, c in cells.items():
        g = c.find("mxGeometry")
        if g is not None:
            geo[cid] = tuple(float(g.get(k, 0)) for k in ("x", "y", "width", "height"))
    def style(c):
        out = {}
        for kv in (c.get("style") or "").split(";"):
            if not kv:
                continue
            k, _, v = kv.partition("=")
            out[k] = v if _ else "1"
        return out
    vertices = [c for c in cells.values() if c.get("vertex") == "1"]
    # containers: style container=1, or an unlabeled/labeled box that encloses other vertices
    def encloses(a, b):
        ax, ay, aw, ah = geo.get(a, (0, 0, 0, 0)); bx, by, bw, bh = geo.get(b, (0, 0, 0, 0))
        return aw * ah > 0 and ax <= bx and ay <= by and ax + aw >= bx + bw and ay + ah >= by + bh and (aw * ah) > 1.5 * (bw * bh)
    group_ids = set()
    for v in vertices:
        st = style(v)
        if st.get("container") == "1" or st.get("group") == "1":
            group_ids.add(v.get("id")); continue
        inside = [w for w in vertices if w is not v and encloses(v.get("id"), w.get("id"))]
        if len(inside) >= 2:
            group_ids.add(v.get("id"))
    for v in vertices:
        vid, st = v.get("id"), style(v)
        label = clean_label(v.get("value"))
        if vid in group_ids:
            members = [w.get("id") for w in vertices if w is not v and w.get("id") not in group_ids and (w.get("parent") == vid or encloses(vid, w.get("id")))]
            d["groups"].append({"id": vid, "label": label, "members": members})
            continue
        if st.get("edgeLabel") == "1" or st.get("text") == "1" and not label:
            continue
        kind = "label" if (st.get("strokeColor") == "none" and st.get("fillColor") in (None, "none")) and label else "node"
        shape = "rhombus" if st.get("rhombus") or "rhombus" in (v.get("style") or "") else "ellipse" if "ellipse" in (v.get("style") or "") else "rect"
        group = next((g["id"] for g in d["groups"] if vid in g["members"]), None)
        if group is None:
            for gid in group_ids:
                if v.get("parent") == gid or encloses(gid, vid):
                    group = gid; break
        d["nodes"].append({"id": vid, "label": label, "shape": shape, "kind": kind, "group": group})
    # edge labels attached as child cells
    edge_labels = {}
    for c in cells.values():
        st = style(c)
        if st.get("edgeLabel") == "1" and c.get("parent") in cells:
            edge_labels[c.get("parent")] = clean_label(c.get("value"))
    for c in cells.values():
        if c.get("edge") == "1" and c.get("source") and c.get("target"):
            st = style(c)
            d["edges"].append({"from": c.get("source"), "to": c.get("target"),
                               "label": clean_label(c.get("value")) or edge_labels.get(c.get("id"), ""),
                               "style": "dashed" if st.get("dashed") == "1" else "solid",
                               "directed": st.get("endArrow", "classic") != "none"})
    # fix group memberships now that all groups are known
    for n in d["nodes"]:
        if n["group"] is None:
            for g in d["groups"]:
                if n["id"] in g["members"]:
                    n["group"] = g["id"]
    return finish(d)


# --- Mermaid ------------------------------------------------------------------------

NODE_RE = re.compile(r'([A-Za-z0-9_\-]+)\s*(\[\[.*?\]\]|\[\(.*?\)\]|\(\(.*?\)\)|\[/.*?/\]|\[\\.*?\\\]|>.*?\]|\{.*?\}|\[.*?\]|\(.*?\))?')
EDGE_RE = re.compile(r'\s*(<?-{2,}\.?-*>?|={2,}>?|-\.+->?|-\.-)\s*(?:\|([^|]*)\|)?\s*')


def mermaid_shape(bracket):
    if not bracket:
        return "rect"
    if bracket.startswith("(("): return "circle"
    if bracket.startswith("[("): return "cylinder"
    if bracket.startswith("{"): return "rhombus"
    if bracket.startswith("("): return "rounded"
    if bracket.startswith(">"): return "flag"
    return "rect"


def extract_mermaid(path, text):
    m = re.search(r"```mermaid\s*\n(.*?)```", text, re.S)
    body = m.group(1) if m else text
    d = digest(path, "mermaid")
    nodes, groups, edges = {}, [], []
    group_stack = []
    def ensure(nid, bracket=None):
        label = clean_label(bracket[1:-1].strip('"') if bracket else nid)
        if bracket and bracket.startswith(("((", "[(", "[[")):
            label = clean_label(bracket[2:-2].strip('"'))
        if bracket and (bracket.startswith("[/") or bracket.startswith("[\\")):
            label = clean_label(bracket[2:-2].strip('"'))
        if nid not in nodes:
            nodes[nid] = {"id": nid, "label": label, "shape": mermaid_shape(bracket), "kind": "node",
                          "group": group_stack[-1] if group_stack else None}
            if group_stack:
                groups[-1]["members"].append(nid) if groups and groups[-1]["id"] == group_stack[-1] else None
        elif bracket:
            nodes[nid]["label"] = label
            nodes[nid]["shape"] = mermaid_shape(bracket)
        return nid
    for raw in body.splitlines():
        line = raw.split("%%")[0].strip()
        if not line:
            continue
        hd = re.match(r"(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)", line)
        if hd:
            d["direction"] = {"TB": "TD"}.get(hd.group(1), hd.group(1)); continue
        if re.match(r"(classDef|class|style|linkStyle|click)\b", line):
            continue
        sg = re.match(r"subgraph\s+([A-Za-z0-9_\-]+)(?:\s*\[(.*?)\])?", line)
        if sg:
            gid = sg.group(1)
            groups.append({"id": gid, "label": clean_label(sg.group(2) or gid), "members": []})
            group_stack.append(gid); continue
        if line == "end":
            if group_stack: group_stack.pop()
            continue
        # a chain: node (edge node)*
        pos = 0
        prev = None
        while pos < len(line):
            nm = NODE_RE.match(line, pos)
            if not nm or not nm.group(1):
                break
            cur = ensure(nm.group(1), nm.group(2))
            pos = nm.end()
            if prev is not None:
                edges.append({"from": prev[0], "to": cur, "label": prev[1], "style": prev[2], "directed": prev[3]})
            # "A -- text --> B" / "A == text ==> B" form first, so the text isn't read as a node
            tm = re.match(r"\s*(-{2,}|={2,})\s*([^-=>|][^-=>]*?)\s*(-{2,}>?|={2,}>?)\s*", line[pos:])
            if tm:
                arrow = tm.group(3)
                prev = (cur, clean_label(tm.group(2)), "thick" if "=" in arrow else "solid", arrow.endswith(">"))
                pos += tm.end(); continue
            em = EDGE_RE.match(line, pos)
            if not em:
                am = re.match(r"\s*&\s*", line[pos:])
                if am:  # A & B --> C : treat as separate sources (approximation)
                    pos += am.end(); continue
                break
            arrow, lab = em.group(1), em.group(2)
            prev = (cur, clean_label(lab or ""), "dashed" if "." in arrow else "thick" if "=" in arrow else "solid", arrow.endswith(">"))
            pos = em.end()
    d["nodes"] = list(nodes.values())
    d["groups"] = groups
    d["edges"] = edges
    return finish(d)


# --- Excalidraw ----------------------------------------------------------------------

def extract_excalidraw(path, text):
    scene = json.loads(text)
    els = [e for e in scene.get("elements", []) if not e.get("isDeleted")]
    by_id = {e["id"]: e for e in els}
    d = digest(path, "excalidraw")
    texts = {}
    for e in els:
        if e.get("type") == "text" and e.get("containerId"):
            texts[e["containerId"]] = clean_label(e.get("text") or e.get("originalText"))
    frames = {e["id"]: e for e in els if e.get("type") in ("frame", "magicframe")}
    for fid, f in frames.items():
        d["groups"].append({"id": fid, "label": clean_label(f.get("name") or "frame"), "members": []})
    for e in els:
        t = e.get("type")
        if t in ("rectangle", "ellipse", "diamond"):
            label = texts.get(e["id"], "")
            group = e.get("frameId") if e.get("frameId") in frames else None
            d["nodes"].append({"id": e["id"], "label": label, "shape": {"rectangle": "rect", "ellipse": "ellipse", "diamond": "rhombus"}[t],
                               "kind": "node" if label else "shape", "group": group})
            if group:
                next(g for g in d["groups"] if g["id"] == group)["members"].append(e["id"])
        elif t == "text" and not e.get("containerId"):
            d["nodes"].append({"id": e["id"], "label": clean_label(e.get("text")), "shape": "none", "kind": "label", "group": None})
    for e in els:
        if e.get("type") in ("arrow", "line"):
            sb, eb = e.get("startBinding") or {}, e.get("endBinding") or {}
            if sb.get("elementId") in by_id and eb.get("elementId") in by_id:
                d["edges"].append({"from": sb["elementId"], "to": eb["elementId"], "label": texts.get(e["id"], ""),
                                   "style": "dashed" if e.get("strokeStyle") in ("dashed", "dotted") else "solid",
                                   "directed": e.get("type") == "arrow" and bool(e.get("endArrowhead", "arrow"))})
    return finish(d)


# --- chartware SVG ---------------------------------------------------------------------

def extract_svg(path, text):
    root = ET.fromstring(text)
    d = digest(path, "svg")
    parents = {c: p for p in root.iter() for c in p}
    def offset(el):
        dx = dy = 0.0
        p = parents.get(el)
        while p is not None:
            m = re.fullmatch(r"\s*translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)\s*", p.get("transform") or "")
            if m: dx += float(m.group(1)); dy += float(m.group(2))
            p = parents.get(p)
        return dx, dy
    def cls(el): return (el.get("class") or "").split()
    def fnum(el, k, dflt=0.0):
        try: return float(el.get(k, dflt))
        except (TypeError, ValueError): return dflt
    rects, groups, texts, edges = [], [], [], []
    for el in root.iter():
        t = el.tag.replace(SVG_NS, "")
        c = cls(el)
        if t in ("rect", "circle") and any(x.startswith("node") for x in c):
            dx, dy = offset(el)
            if t == "rect":
                r = (fnum(el, "x") + dx, fnum(el, "y") + dy, fnum(el, "width"), fnum(el, "height"))
            else:
                rr = fnum(el, "r"); r = (fnum(el, "cx") + dx - rr, fnum(el, "cy") + dy - rr, 2 * rr, 2 * rr)
            rects.append((r, el, "ellipse" if t == "circle" else "rect"))
        elif t == "rect" and "group" in c:
            dx, dy = offset(el)
            groups.append(((fnum(el, "x") + dx, fnum(el, "y") + dy, fnum(el, "width"), fnum(el, "height")), el))
        elif t == "text" and not el.get("transform"):
            dx, dy = offset(el)
            lines = [(el.text or "").strip()] + [(ts.text or "").strip() for ts in el.findall(SVG_NS + "tspan")]
            texts.append(((fnum(el, "x") + dx, fnum(el, "y") + dy), " / ".join(l for l in lines if l), c))
        elif t in ("path", "line") and any(x.startswith("edge") for x in c):
            dx, dy = offset(el)
            if t == "line":
                pts = [(fnum(el, "x1") + dx, fnum(el, "y1") + dy), (fnum(el, "x2") + dx, fnum(el, "y2") + dy)]
            else:
                nums = [float(v) for v in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", el.get("d") or "")]
                pts = [(nums[i] + dx, nums[i + 1] + dy) for i in range(0, len(nums) - 1, 2)] if len(nums) >= 4 else []
            if pts:
                edges.append((pts, el, "dashed" if any("dashed" in x for x in c) else "solid"))
    def inside(p, r, tol=6):
        return r[0] - tol <= p[0] <= r[0] + r[2] + tol and r[1] - tol <= p[1] <= r[1] + r[3] + tol
    node_ids = {}
    for i, (r, el, shape) in enumerate(rects):
        label = next((txt for (p, txt, c) in texts if "lbl" in c and inside(p, r, 0)), "")
        nid = el.get("id") or f"n{i + 1}"
        grp = next((g[1].get("id") or f"g{j + 1}" for j, g in enumerate(groups) if inside((r[0] + r[2] / 2, r[1] + r[3] / 2), g[0], 0)), None)
        node_ids[i] = nid
        d["nodes"].append({"id": nid, "label": label, "shape": shape, "kind": "node", "group": grp})
    for j, (gr, gel) in enumerate(groups):
        label = next((txt for (p, txt, c) in texts if "lane" in c and inside(p, gr, 0)), "")
        d["groups"].append({"id": gel.get("id") or f"g{j + 1}", "label": label,
                            "members": [node_ids[i] for i, (r, _, _) in enumerate(rects) if inside((r[0] + r[2] / 2, r[1] + r[3] / 2), gr, 0)]})
    elabels = [(p, txt) for (p, txt, c) in texts if "elbl" in c]
    for pts, el, style in edges:
        src = next((node_ids[i] for i, (r, _, _) in enumerate(rects) if inside(pts[0], r)), None)
        dst = next((node_ids[i] for i, (r, _, _) in enumerate(rects) if inside(pts[-1], r)), None)
        if src is None or dst is None:
            continue
        # nearest edge label to the edge's polyline, within 24 units
        def seg_dist(p, a, b):
            ax, ay = a; bx, by = b
            dx, dy = bx - ax, by - ay
            if dx == dy == 0:
                return math.hypot(p[0] - ax, p[1] - ay)
            t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
            return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))
        best, bestd = "", 24.0
        for p, txt in elabels:
            dist = min(seg_dist(p, a, b) for a, b in zip(pts, pts[1:])) if len(pts) > 1 else math.hypot(p[0] - pts[0][0], p[1] - pts[0][1])
            if dist < bestd:
                best, bestd = txt, dist
        d["edges"].append({"from": src, "to": dst, "label": best, "style": style, "directed": bool(el.get("marker-end") or el.get("marker-start"))})
    return finish(d)


# --- dispatch --------------------------------------------------------------------------

def extract(path):
    text = open(path, encoding="utf-8").read()
    low = path.lower()
    if low.endswith((".drawio", ".xml")) or "<mxfile" in text[:200] or "<mxGraphModel" in text[:200]:
        return extract_drawio(path, text)
    if low.endswith((".excalidraw", ".json")):
        return extract_excalidraw(path, text)
    if low.endswith(".svg") or text.lstrip().startswith("<svg") or "<svg" in text[:400]:
        return extract_svg(path, text)
    return extract_mermaid(path, text)


def to_md(d):
    out = [f"# Digest of {d['source']} ({d['format']}{', ' + d['direction'] if d['direction'] else ''})", "",
           f"{d['stats']['nodes']} nodes, {d['stats']['edges']} edges, {d['stats']['groups']} groups.", ""]
    if d["groups"]:
        out += ["## Groups", ""] + [f"- **{g['label'] or g['id']}**: {', '.join(g['members']) or '(empty)'}" for g in d["groups"]] + [""]
    out += ["## Nodes", "", "| id | label | shape | kind | group |", "|---|---|---|---|---|"]
    out += [f"| {n['id']} | {n['label']} | {n['shape']} | {n['kind']} | {n['group'] or ''} |" for n in d["nodes"]]
    out += ["", "## Edges", "", "| from | to | label | style |", "|---|---|---|---|"]
    out += [f"| {e['from']} | {e['to']} | {e['label']} | {e['style']}{'' if e['directed'] else ', undirected'} |" for e in d["edges"]]
    return "\n".join(out) + "\n"


# --- ledger -----------------------------------------------------------------------------

def norm(s):
    s = re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())
    return re.sub(r"\s+", " ", s).strip()


def ledger(orig, redrawn):
    on = {n["id"]: n for n in orig["nodes"] if n["kind"] == "node"}
    rn = {n["id"]: n for n in redrawn["nodes"] if n["kind"] == "node"}
    o_by_label = {}
    for n in on.values():
        o_by_label.setdefault(norm(n["label"]), []).append(n["id"])
    r_by_label = {}
    for n in rn.values():
        r_by_label.setdefault(norm(n["label"]), []).append(n["id"])
    mapping = {}      # original id -> redrawn id
    rows = []
    used = set()
    for lab, ids in o_by_label.items():
        if lab in r_by_label:
            for oid, rid in zip(ids, r_by_label[lab]):
                mapping[oid] = rid; used.add(rid)
                rows.append(("kept", on[oid]["label"], rn[rid]["label"]))
    for oid, n in on.items():
        if oid in mapping:
            continue
        lab = norm(n["label"])
        cand = None
        if lab:
            for rid, m in rn.items():
                if rid in used:
                    continue
                rl = norm(m["label"])
                if lab and (lab in rl or rl in lab) and len(lab) >= 3 and len(rl) >= 3:
                    cand = rid; break
        if cand:
            mapping[oid] = cand
            # merged when a redrawn node absorbs more than one original
            rows.append(("renamed", n["label"], rn[cand]["label"]))
            used.add(cand)
        else:
            rows.append(("dropped", n["label"], ""))
    # merged: several originals mapped to one redrawn node
    targets = {}
    for oid, rid in mapping.items():
        targets.setdefault(rid, []).append(oid)
    for rid, oids in targets.items():
        if len(oids) > 1:
            rows = [r for r in rows if not (r[0] in ("kept", "renamed") and r[2] == rn[rid]["label"] and norm(r[1]) in [norm(on[o]["label"]) for o in oids])]
            rows.append(("merged", " + ".join(on[o]["label"] for o in oids), rn[rid]["label"]))
    for rid, m in rn.items():
        if rid not in used:
            rows.append(("added", "", m["label"]))
    # edges, compared by mapped endpoints
    def ekey(e, idmap=None):
        f, t = e["from"], e["to"]
        if idmap:
            f, t = idmap.get(f, f), idmap.get(t, t)
        return (f, t)
    o_edges = {ekey(e, mapping): e for e in orig["edges"]}
    r_edges = {ekey(e): e for e in redrawn["edges"]}
    rlabel = lambda nid, dd: next((n["label"] for n in dd["nodes"] if n["id"] == nid), nid)
    erows = []
    for k, e in o_edges.items():
        if k in r_edges:
            re_ = r_edges[k]
            note = "kept" if norm(e["label"]) == norm(re_["label"]) else "label changed"
            erows.append((note, f"{rlabel(e['from'], orig)} → {rlabel(e['to'], orig)}", e["label"], re_["label"]))
        else:
            erows.append(("dropped", f"{rlabel(e['from'], orig)} → {rlabel(e['to'], orig)}", e["label"], ""))
    for k, e in r_edges.items():
        if k not in o_edges:
            erows.append(("added", f"{rlabel(k[0], redrawn)} → {rlabel(k[1], redrawn)}", "", e["label"]))
    counts = {s: sum(1 for r in rows if r[0] == s) for s in ("kept", "renamed", "merged", "dropped", "added")}
    ecounts = {s: sum(1 for r in erows if r[0] == s) for s in ("kept", "label changed", "dropped", "added")}
    return {"original": orig["source"], "redrawn": redrawn["source"], "nodes": [dict(zip(("status", "original", "redrawn"), r)) for r in rows],
            "edges": [dict(zip(("status", "edge", "original_label", "redrawn_label"), r)) for r in erows],
            "counts": {"nodes": counts, "edges": ecounts}}


def ledger_md(L):
    c, e = L["counts"]["nodes"], L["counts"]["edges"]
    out = [f"# Fidelity ledger: {L['redrawn']} from {L['original']}", "",
           f"Nodes: {c['kept']} kept, {c['renamed']} renamed, {c['merged']} merged, {c['dropped']} dropped, {c['added']} added. "
           f"Edges: {e['kept']} kept, {e['label changed']} relabelled, {e['dropped']} dropped, {e['added']} added.", "",
           "## Nodes", "", "| Status | Original | Redrawn |", "|---|---|---|"]
    out += [f"| {r['status']} | {r['original']} | {r['redrawn']} |" for r in L["nodes"]]
    out += ["", "## Edges", "", "| Status | Edge | Original label | Redrawn label |", "|---|---|---|---|"]
    out += [f"| {r['status']} | {r['edge']} | {r['original_label']} | {r['redrawn_label']} |" for r in L["edges"]]
    out += ["", "Every dropped or merged row needs one line of reason in the delivery note."]
    return "\n".join(out) + "\n"


def main(argv):
    if len(argv) < 2 or argv[0] not in ("extract", "ledger"):
        print(__doc__); sys.exit(1)
    md = "--md" in argv
    args = [a for a in argv[1:] if a != "--md"]
    try:
        if argv[0] == "extract":
            d = extract(args[0])
            print(to_md(d) if md else json.dumps(d, indent=2))
        else:
            L = ledger(extract(args[0]), extract(args[1]))
            print(ledger_md(L) if md else json.dumps(L, indent=2))
    except (OSError, ValueError, ET.ParseError, json.JSONDecodeError, KeyError) as e:
        print(f"error: {e}", file=sys.stderr); sys.exit(2)


if __name__ == "__main__":
    main(sys.argv[1:])
