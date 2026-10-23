#!/usr/bin/env python3
"""Richer variants of nine chartware templates for the README gallery, written to docs/gallery/charts/.

They follow the templates' conventions (pixel-space viewBox, translated plot group, the three-layer token
block, role/title/desc) with denser data, so the gallery shows what a real chart looks like. The sheet
inlines them and sets a style's CSS variables, which the token block reads. Run from the repo root:

    python3 docs/gallery/make-charts.py && python3 plugins/knowledgeware/skills/chartware/scripts/svg-lint.py docs/gallery/charts/*.svg
"""
import math
import os
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "charts")
os.makedirs(OUT, exist_ok=True)
FONT = "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def root(cls, slug, w, h, title, desc):
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" class="{cls}" role="img" '
            f'aria-labelledby="{slug}-t {slug}-d" focusable="false" preserveAspectRatio="xMidYMid meet" '
            f'style="width:100%;height:auto;max-width:{w}px;display:block;{FONT}">\n  <title id="{slug}-t">{title}</title>\n  <desc id="{slug}-d">{desc}</desc>\n')


def tokens(cls, extra=""):
    return f'''  <style>
    .{cls} {{ --_ink:#111827; --_muted:#6B7280; --_grid:#E5E7EB; --_axis:#9CA3AF; --_bg:#FFFFFF; --_c1:#4969E1; --_c2:#8A97AD; --_neg:#C2410C; --_panel:#FFFFFF; --_border:#CBD5E1; --_edge:#94A3B8; }}
    @media (prefers-color-scheme: dark) {{ .{cls} {{ --_ink:#E6E9EF; --_muted:#9CA3AF; --_grid:#2A2F3A; --_axis:#4B5563; --_bg:#0B0E14; --_c1:#7B96F0; --_c2:#6B7686; --_neg:#F0875B; --_panel:#111A2E; --_border:#2B3A55; --_edge:#7C8DB0; }} }}
    .{cls} {{ --cw-ink:var(--ink,var(--_ink)); --cw-muted:var(--muted,var(--_muted)); --cw-grid:var(--border,var(--_grid)); --cw-axis:var(--_axis); --cw-bg:var(--bg,var(--_bg));
              --cw-c1:var(--accent,var(--_c1)); --cw-c2:var(--_c2); --cw-neg:var(--error,var(--_neg)); --cw-panel:var(--surface,var(--_panel)); --cw-border:var(--border,var(--_border)); --cw-edge:var(--_edge); }}
{extra}  </style>
'''


def write(name, text):
    open(os.path.join(OUT, name), "w").write(text)


def nice_ticks(vmax, target=5):
    raw = vmax / target
    mag = 10 ** math.floor(math.log10(raw))
    step = min((m * mag for m in (1, 2, 5, 10)), key=lambda s: abs(s - raw))
    return step, math.ceil(vmax / step) * step


# 1. grouped bars: 3 regions x 6 half-years ------------------------------------------------
cats = ["H1 24", "H2 24", "H1 25", "H2 25", "H1 26", "H2 26"]
series = {"EMEA": [1.9, 2.3, 2.6, 2.4, 3.1, 3.4], "Americas": [2.4, 2.2, 2.9, 3.3, 3.5, 4.1], "APAC": [0.8, 1.1, 1.3, 1.6, 2.0, 2.3]}
W, H, L, T, iW, iH = 720, 400, 48, 36, 648, 324
step, nmax = nice_ticks(max(max(v) for v in series.values()))
ypx = lambda v: iH * (1 - v / nmax)
band = iW / len(cats); grp = band * 0.78; sub = grp / 3; gap = sub * 0.1; bw = sub - gap
s = root("cw-bar", "gbar", W, H, "Revenue by region, half-years 2024 to 2026 ($M)",
         "Grouped bars. Americas grew from $2.4M to $4.1M, EMEA from $1.9M to $3.4M and APAC from $0.8M to $2.3M; every region rose in H2 2026.")
s += tokens("cw-bar", "    .cw-bar .grid{stroke:var(--cw-grid);stroke-width:1}.cw-bar .zero{stroke:var(--cw-axis);stroke-width:1}.cw-bar .tick,.cw-bar .cat{fill:var(--cw-muted);font-size:11px}.cw-bar .lgd{fill:var(--cw-ink);font-size:11px}\n    .cw-bar .s1{fill:var(--cw-c1)}.cw-bar .s2{fill:var(--cw-c1);fill-opacity:.45}.cw-bar .s3{fill:var(--cw-c2)}.cw-bar:hover .bar{opacity:.45}.cw-bar .bar:hover{opacity:1}\n")
lx = L + iW - 250
s += '  <g>\n'
for i, (name, cls) in enumerate(zip(series, ("s1", "s2", "s3"))):
    s += f'    <rect class="{cls}" x="{lx + i*90}" y="10" width="12" height="12" rx="2"/><text class="lgd" x="{lx + i*90 + 18}" y="16" dy="0.32em">{name}</text>\n'
s += f'  </g>\n  <g transform="translate({L},{T})">\n    <g shape-rendering="crispEdges">\n'
v = step
while v <= nmax + 1e-9:
    s += f'      <line class="grid" x1="0" y1="{ypx(v):.1f}" x2="{iW}" y2="{ypx(v):.1f}"/>\n'; v += step
s += f'      <line class="zero" x1="0" y1="{iH}" x2="{iW}" y2="{iH}"/>\n    </g>\n    <g text-anchor="end">\n'
v = 0
while v <= nmax + 1e-9:
    s += f'      <text class="tick" x="-8" y="{ypx(v):.1f}" dy="0.32em">{v:g}</text>\n'; v += step
s += '    </g>\n    <g>\n'
for ci, cat in enumerate(cats):
    x0 = band * ci + (band - grp) / 2
    for si, (name, vals) in enumerate(series.items()):
        val = vals[ci]; x = x0 + si * sub + gap / 2; y = ypx(val); h = iH - y; r = min(3, bw / 2, h)
        s += (f'      <path class="bar s{si+1}" d="M{x:.1f},{iH} L{x:.1f},{y+r:.1f} A{r},{r} 0 0 1 {x+r:.1f},{y:.1f} L{x+bw-r:.1f},{y:.1f} '
              f'A{r},{r} 0 0 1 {x+bw:.1f},{y+r:.1f} L{x+bw:.1f},{iH} Z"><title>{name} {cat} — ${val}M</title></path>\n')
s += '    </g>\n    <g text-anchor="middle">\n'
for ci, cat in enumerate(cats):
    s += f'      <text class="cat" x="{band*ci + band/2:.1f}" y="{iH+8}" dy="0.71em">{cat}</text>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("bar-grouped.svg", s)

# 2. line + area: p95 this year (area), p95 last year (dashed), target (dotted) ------------------
months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
cur = [412, 398, 441, 405, 372, 358, 331, 349, 302, 288, 276, 261]
prev = [455, 470, 462, 488, 475, 466, 458, 471, 452, 447, 439, 433]
target = 300
W, H, L, T, iW, iH = 720, 400, 52, 40, 644, 320
vmax = 500; step = 100
ypx = lambda v: iH * (1 - v / vmax); xpx = lambda i: iW * i / (len(months) - 1)
def smooth(vals):
    pts = [(xpx(i), ypx(v)) for i, v in enumerate(vals)]
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dx = x2 - x1; d += f" C{x1+dx/2:.1f},{y1:.1f} {x2-dx/2:.1f},{y2:.1f} {x2:.1f},{y2:.1f}"
    return d
s = root("cw-line", "line", W, H, "Checkout p95 latency by month, 2026 against 2025 (ms)",
         "Line chart. 2026 p95 fell from 412 ms in January to 261 ms in December and crossed the 300 ms target in September; 2025 stayed between 433 and 488 ms all year.")
s += tokens("cw-line", "    .cw-line .grid{stroke:var(--cw-grid);stroke-width:1}.cw-line .tick,.cw-line .cat{fill:var(--cw-muted);font-size:11px}.cw-line .lgd{fill:var(--cw-ink);font-size:11px}\n    .cw-line .l1{fill:none;stroke:var(--cw-c1);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}.cw-line .l2{fill:none;stroke:var(--cw-c2);stroke-width:2;stroke-dasharray:6 3}\n    .cw-line .tgt{stroke:var(--cw-neg);stroke-width:1.25;stroke-dasharray:2 4}.cw-line .end{fill:var(--cw-ink);font-size:11px;font-weight:600}.cw-line .dot{fill:var(--cw-c1);stroke:var(--cw-bg);stroke-width:2}\n")
s += f'''  <defs><linearGradient id="line-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="{iH}"><stop offset="0" stop-color="var(--cw-c1,#4969E1)" stop-opacity=".28"/><stop offset="1" stop-color="var(--cw-c1,#4969E1)" stop-opacity="0"/></linearGradient></defs>
  <g><line class="l1" x1="{L+iW-250}" y1="16" x2="{L+iW-226}" y2="16"/><text class="lgd" x="{L+iW-218}" y="16" dy="0.32em">2026 p95</text>
     <line class="l2" x1="{L+iW-140}" y1="16" x2="{L+iW-116}" y2="16"/><text class="lgd" x="{L+iW-108}" y="16" dy="0.32em">2025 p95</text></g>
  <g transform="translate({L},{T})">
    <g shape-rendering="crispEdges">
'''
for v in range(0, vmax + 1, step):
    s += f'      <line class="grid" x1="0" y1="{ypx(v):.1f}" x2="{iW}" y2="{ypx(v):.1f}"/>\n'
s += '    </g>\n    <g text-anchor="end">\n'
for v in range(0, vmax + 1, step):
    s += f'      <text class="tick" x="-8" y="{ypx(v):.1f}" dy="0.32em">{v}</text>\n'
s += f'    </g>\n    <path d="{smooth(cur)} L{iW},{iH} L0,{iH} Z" fill="url(#line-fade)"/>\n'
s += f'    <line class="tgt" x1="0" y1="{ypx(target):.1f}" x2="{iW}" y2="{ypx(target):.1f}"/><text class="tick" x="{iW}" y="{ypx(target)-6:.1f}" text-anchor="end">target 300 ms</text>\n'
s += f'    <path class="l2" d="{smooth(prev)}"/>\n    <path class="l1" d="{smooth(cur)}"/>\n'
s += f'    <circle class="dot" cx="{xpx(11):.1f}" cy="{ypx(cur[-1]):.1f}" r="4"/><text class="end" x="{xpx(11)-8:.1f}" y="{ypx(cur[-1])-10:.1f}" text-anchor="end">{cur[-1]} ms</text>\n'
s += '    <g text-anchor="middle">\n'
for i, m in enumerate(months):
    s += f'      <text class="cat" x="{xpx(i):.1f}" y="{iH+8}" dy="0.71em">{m}</text>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("line-area.svg", s)

# 3. donut: 6 slices ---------------------------------------------------------------------------
slices = [("Compute", 38), ("Storage", 21), ("Network", 14), ("Managed DB", 12), ("Observability", 9), ("Other", 6)]
W, H = 480, 260; cx, cy, r = 118, 130, 63.66  # C = 400 → 1% = 4 units
s = root("cw-donut", "donut", W, H, "Cloud spend by category, Q3 2026",
         "Donut chart. $3.1M total: compute 38%, storage 21%, network 14%, managed databases 12%, observability 9%, other 6%.")
s += tokens("cw-donut", "    .cw-donut .seg{fill:none;stroke-width:24}.cw-donut .big{fill:var(--cw-ink);font-size:28px;font-weight:700;letter-spacing:-.02em}.cw-donut .sub,.cw-donut .pct{fill:var(--cw-muted);font-size:11px}.cw-donut .lgd{fill:var(--cw-ink);font-size:12px}\n")
ops = [1, .78, .58, .42, .28, .16]
off = 0
for i, (name, pct) in enumerate(slices):
    color = "var(--cw-c2)" if name == "Other" else "var(--cw-c1)"
    s += (f'  <circle class="seg" cx="{cx}" cy="{cy}" r="{r}" stroke="{color}" stroke-opacity="{ops[i] if name != "Other" else 1}" '
          f'stroke-dasharray="{pct*4} {400-pct*4}" stroke-dashoffset="{-off*4}" transform="rotate(-90 {cx} {cy})"><title>{name} — {pct}%</title></circle>\n')
    off += pct
s += f'  <text class="big" x="{cx}" y="{cy}" text-anchor="middle" dy="0.1em">$3.1M</text><text class="sub" x="{cx}" y="{cy+22}" text-anchor="middle">Q3 spend</text>\n'
for i, (name, pct) in enumerate(slices):
    y = 48 + i * 30
    color = "var(--cw-c2)" if name == "Other" else "var(--cw-c1)"
    s += f'  <rect x="236" y="{y-6}" width="12" height="12" rx="2" fill="{color}" fill-opacity="{ops[i] if name != "Other" else 1}"/><text class="lgd" x="256" y="{y}" dy="0.32em">{name}</text><text class="pct" x="440" y="{y}" dy="0.32em" text-anchor="end">{pct}%</text>\n'
s += '</svg>\n'
write("donut.svg", s)

# 4. waterfall: 9 steps ------------------------------------------------------------------------
start, steps = 128, [("Volume", 22), ("Price", 9), ("Mix", -6), ("Churn", -17), ("New markets", 14), ("Costs", -21), ("FX", -4), ("One-offs", 5)]
end = start + sum(v for _, v in steps)
W, H, L, T, iW, iH = 720, 400, 52, 32, 644, 324
nmax, tstep = 180, 30
ypx = lambda v: iH * (1 - v / nmax)
n = len(steps) + 2; band = iW / n; bw = band * 0.62
s = root("cw-wf", "wf", W, H, "Operating profit bridge, FY25 to FY26 ($M)",
         f"Waterfall. Profit went from ${start}M to ${end}M: volume +22, price +9, new markets +14 and one-offs +5 against mix −6, churn −17, costs −21 and FX −4.")
s += tokens("cw-wf", "    .cw-wf .grid{stroke:var(--cw-grid);stroke-width:1}.cw-wf .zero{stroke:var(--cw-axis)}.cw-wf .tick,.cw-wf .cat{fill:var(--cw-muted);font-size:11px}.cw-wf .val{fill:var(--cw-ink);font-size:11px;font-variant-numeric:tabular-nums}\n    .cw-wf .total{fill:var(--cw-c2)}.cw-wf .up{fill:var(--cw-c1)}.cw-wf .down{fill:var(--cw-neg)}.cw-wf .link{stroke:var(--cw-axis);stroke-width:1;stroke-dasharray:3 3}\n")
s += f'  <g transform="translate({L},{T})">\n    <g shape-rendering="crispEdges">\n'
for v in range(tstep, nmax + 1, tstep):
    s += f'      <line class="grid" x1="0" y1="{ypx(v):.1f}" x2="{iW}" y2="{ypx(v):.1f}"/>\n'
s += f'      <line class="zero" x1="0" y1="{iH}" x2="{iW}" y2="{iH}"/>\n    </g>\n    <g text-anchor="end">\n'
for v in range(0, nmax + 1, tstep):
    s += f'      <text class="tick" x="-8" y="{ypx(v):.1f}" dy="0.32em">{v}</text>\n'
s += '    </g>\n    <g>\n'
cols = [("FY25", start, "total", 0, start)]; run = start
for name, d in steps:
    cols.append((name, d, "up" if d > 0 else "down", run, run + d)); run += d
cols.append(("FY26", end, "total", 0, end))
for i, (name, v, cls, lo, hi) in enumerate(cols):
    x = band * i + (band - bw) / 2; y = min(ypx(lo), ypx(hi)); h = abs(ypx(hi) - ypx(lo))
    s += f'      <rect class="bar {cls}" x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{h:.1f}"><title>{name}: {v}</title></rect>\n'
    lab = f"{v}" if cls == "total" else (f"+{v}" if v > 0 else f"−{abs(v)}")
    s += f'      <text class="val" x="{x+bw/2:.1f}" y="{y-6:.1f}" text-anchor="middle">{lab}</text>\n'
    if i < len(cols) - 1:
        s += f'      <line class="link" x1="{x+bw:.1f}" y1="{ypx(hi):.1f}" x2="{band*(i+1)+(band-bw)/2:.1f}" y2="{ypx(hi):.1f}"/>\n'
s += '    </g>\n    <g text-anchor="middle">\n'
for i, (name, *_) in enumerate(cols):
    s += f'      <text class="cat" x="{band*i+band/2:.1f}" y="{iH+8}" dy="0.71em">{name}</text>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("waterfall.svg", s)

# 5. heatmap: 7 days x 24 hours -------------------------------------------------------------------
import random
random.seed(7)
days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
def load(d, h):
    base = 3 + 22 * math.exp(-((h - 14) ** 2) / 18) if d < 5 else 1 + 7 * math.exp(-((h - 15) ** 2) / 30)
    return max(0, round(base + random.gauss(0, 1.5)))
data = [[load(d, h) for h in range(24)] for d in range(7)]
data[6][19] = None  # type: ignore[call-overload]
W, H, L, T, cw, ch, gap = 660, 330, 56, 44, 24, 32, 2
def bucket(v): return 0 if v <= 2 else 1 if v <= 6 else 2 if v <= 12 else 3 if v <= 20 else 4
s = root("cw-hm", "hm", W, H, "Support tickets opened, by weekday and hour",
         "Heatmap of ticket volume by weekday and hour. Weekday afternoons peak above 20 tickets an hour; weekends stay under 10.")
s += tokens("cw-hm", "    .cw-hm .rl,.cw-hm .cl,.cw-hm .lgd{fill:var(--cw-muted);font-size:11px}.cw-hm .cell{fill:var(--cw-c1)}.cw-hm .q0{fill-opacity:.08}.cw-hm .q1{fill-opacity:.25}.cw-hm .q2{fill-opacity:.45}.cw-hm .q3{fill-opacity:.7}.cw-hm .q4{fill-opacity:1}\n    .cw-hm .na{fill:none;stroke:var(--cw-grid);stroke-width:1;stroke-dasharray:3 2}\n")
lx = L + cw * 24 - 5 * 18 - 60
s += f'  <g><text class="lgd" x="{lx-8}" y="{T-24}" dy="0.32em" text-anchor="end">tickets/h ≤2</text>\n'
for i in range(5):
    s += f'    <rect class="cell q{i}" x="{lx+i*18}" y="{T-30}" width="14" height="12" rx="2"/>\n'
s += f'    <text class="lgd" x="{lx+5*18+2}" y="{T-24}" dy="0.32em">21+</text></g>\n  <g transform="translate({L},{T})">\n    <g text-anchor="end">\n'
for r, d in enumerate(days):
    s += f'      <text class="rl" x="-8" y="{r*ch+ch/2:g}" dy="0.32em">{d}</text>\n'
s += '    </g>\n    <g text-anchor="middle">\n'
for c in range(0, 24, 2):
    s += f'      <text class="cl" x="{c*cw+cw/2:g}" y="-8">{c:02d}</text>\n'
s += '    </g>\n    <g>\n'
for r, row in enumerate(data):
    for c, v in enumerate(row):
        x, y = c * cw + gap / 2, r * ch + gap / 2
        if v is None:
            s += f'      <rect class="na" x="{x:g}" y="{y:g}" width="{cw-gap}" height="{ch-gap}" rx="2"><title>{days[r]} {c:02d}:00 — no data</title></rect>\n'
        else:
            s += f'      <rect class="cell q{bucket(v)}" x="{x:g}" y="{y:g}" width="{cw-gap}" height="{ch-gap}" rx="2"><title>{days[r]} {c:02d}:00 — {v}</title></rect>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("heatmap.svg", s)

# 6. slopegraph: 8 channels -------------------------------------------------------------------------
rows = [("Organic search", 34, 38), ("Direct", 22, 19), ("Paid search", 14, 11), ("Referral", 9, 8), ("Social", 7, 11), ("Email", 6, 5), ("Partners", 5, 6), ("Display", 3, 2)]
W, H, L, R, T, B, vmax = 480, 400, 170, 310, 44, 360, 40
ypx = lambda v: round(T + (B - T) * (1 - v / vmax), 1)
def nudge(items, gap=14):
    out, last = {}, None
    for k, y in sorted(items, key=lambda t: t[1]):
        if last is not None and y - last < gap: y = last + gap
        out[k] = y; last = y
    return out
left = nudge([(n, ypx(a)) for n, a, b in rows]); right = nudge([(n, ypx(b)) for n, a, b in rows])
s = root("cw-sl", "sl", W, H, "Traffic share by channel, 2025 vs 2026 (%)",
         "Slopegraph. Organic search grew from 34% to 38% and social from 7% to 11%; direct, paid search, referral, email and display fell; partners rose one point.")
s += tokens("cw-sl", "    .cw-sl .col{stroke:var(--cw-grid)}.cw-sl .hdr{fill:var(--cw-muted);font-size:11px;letter-spacing:.06em}.cw-sl .lbl{fill:var(--cw-ink);font-size:12px;font-variant-numeric:tabular-nums}\n    .cw-sl .line{fill:none;stroke-width:2;stroke-linecap:round}.cw-sl .up{stroke:var(--cw-c1)}.cw-sl .down{stroke:var(--cw-c2)}.cw-sl .flat{stroke:var(--cw-grid)}.cw-sl .dot{stroke:var(--cw-bg);stroke-width:1.5}.cw-sl .dot.up{fill:var(--cw-c1)}.cw-sl .dot.down{fill:var(--cw-c2)}.cw-sl .dot.flat{fill:var(--cw-grid)}\n")
s += f'  <g text-anchor="middle"><text class="hdr" x="{L}" y="{T-16}">2025</text><text class="hdr" x="{R}" y="{T-16}">2026</text></g>\n  <g shape-rendering="crispEdges"><line class="col" x1="{L}" y1="{T}" x2="{L}" y2="{B}"/><line class="col" x1="{R}" y1="{T}" x2="{R}" y2="{B}"/></g>\n  <g>\n'
for n, a, b in rows:
    cls = "up" if b > a else "down" if b < a else "flat"
    s += f'    <line class="line {cls}" x1="{L}" y1="{ypx(a)}" x2="{R}" y2="{ypx(b)}"><title>{n}: {a}% → {b}%</title></line>\n    <circle class="dot {cls}" cx="{L}" cy="{ypx(a)}" r="4"/><circle class="dot {cls}" cx="{R}" cy="{ypx(b)}" r="4"/>\n'
    s += f'    <text class="lbl" x="{L-12}" y="{left[n]}" dy="0.32em" text-anchor="end">{n} {a}</text>\n    <text class="lbl" x="{R+12}" y="{right[n]}" dy="0.32em">{b} {n}</text>\n'
s += '  </g>\n</svg>\n'
write("slopegraph.svg", s)

# 7. dumbbell: 8 services ------------------------------------------------------------------------------
rows = [("checkout", 840, 310), ("search", 620, 290), ("catalog", 450, 260), ("recommendations", 430, 210), ("auth", 390, 180), ("profile", 310, 170), ("cart", 280, 150), ("notifications", 240, 95)]
W, H, L, T, iW, rowH, vmax = 480, 360, 120, 40, 328, 34, 1000
xpx = lambda v: iW * v / vmax
s = root("cw-db", "db", W, H, "p95 latency before and after the edge cache (ms)",
         "Dumbbell chart. Every service's p95 fell, checkout the most, from 840 ms to 310 ms; notifications from 240 to 95.")
s += tokens("cw-db", "    .cw-db .grid{stroke:var(--cw-grid)}.cw-db .tick{fill:var(--cw-muted);font-size:11px}.cw-db .cat{fill:var(--cw-ink);font-size:12px}.cw-db .val{fill:var(--cw-muted);font-size:11px;font-variant-numeric:tabular-nums}.cw-db .lgd{fill:var(--cw-ink);font-size:11px}\n    .cw-db .bar{stroke:var(--cw-grid);stroke-width:2;stroke-linecap:round}.cw-db .before{fill:var(--cw-c2)}.cw-db .after{fill:var(--cw-c1)}.cw-db .dot{stroke:var(--cw-bg);stroke-width:1.5}\n")
s += f'  <g><circle class="before" cx="{L+iW-150}" cy="16" r="5"/><text class="lgd" x="{L+iW-140}" y="16" dy="0.32em">before</text><circle class="after" cx="{L+iW-70}" cy="16" r="5"/><text class="lgd" x="{L+iW-60}" y="16" dy="0.32em">after</text></g>\n  <g transform="translate({L},{T})">\n    <g shape-rendering="crispEdges">\n'
for v in range(0, vmax + 1, 250):
    s += f'      <line class="grid" x1="{xpx(v):g}" y1="0" x2="{xpx(v):g}" y2="{rowH*len(rows)}"/>\n'
s += '    </g>\n    <g text-anchor="middle">\n'
for v in range(0, vmax + 1, 250):
    s += f'      <text class="tick" x="{xpx(v):g}" y="{rowH*len(rows)+8}" dy="0.71em">{v:,}</text>\n'
s += '    </g>\n    <g>\n'
for i, (name, a, b) in enumerate(rows):
    cy = i * rowH + rowH / 2; xa, xb = xpx(a), xpx(b)
    s += f'      <line class="bar" x1="{xb:.1f}" y1="{cy:g}" x2="{xa:.1f}" y2="{cy:g}"/>\n      <circle class="dot before" cx="{xa:.1f}" cy="{cy:g}" r="5.5"><title>{name} before — {a} ms</title></circle>\n      <circle class="dot after" cx="{xb:.1f}" cy="{cy:g}" r="5.5"><title>{name} after — {b} ms</title></circle>\n'
    s += f'      <text class="val" x="{xa+10:.1f}" y="{cy:g}" dy="0.32em">{a}</text>\n      <text class="val" x="{xb-10:.1f}" y="{cy:g}" dy="0.32em" text-anchor="end">{b}</text>\n      <text class="cat" x="-10" y="{cy:g}" dy="0.32em" text-anchor="end">{name}</text>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("dumbbell.svg", s)

# 8. sankey: 5 sources → 4 outcomes ----------------------------------------------------------------------
left_nodes = [("Organic", 34), ("Direct", 22), ("Paid", 18), ("Referral", 14), ("Social", 12)]
right_nodes = [("Signed up", 24), ("Trial", 18), ("Browsed", 38), ("Bounced", 20)]
links = {("Organic", "Signed up"): 12, ("Organic", "Trial"): 8, ("Organic", "Browsed"): 11, ("Organic", "Bounced"): 3,
         ("Direct", "Signed up"): 6, ("Direct", "Trial"): 4, ("Direct", "Browsed"): 9, ("Direct", "Bounced"): 3,
         ("Paid", "Signed up"): 3, ("Paid", "Trial"): 3, ("Paid", "Browsed"): 7, ("Paid", "Bounced"): 5,
         ("Referral", "Signed up"): 2, ("Referral", "Trial"): 2, ("Referral", "Browsed"): 6, ("Referral", "Bounced"): 4,
         ("Social", "Signed up"): 1, ("Social", "Trial"): 1, ("Social", "Browsed"): 5, ("Social", "Bounced"): 5}
total = sum(v for _, v in left_nodes); assert total == sum(v for _, v in right_nodes) == sum(links.values())
W, H, L, R, T, iH, nodeW, pad = 720, 420, 150, 570, 32, 356, 14, 12
sc = (iH - pad * (len(left_nodes) - 1)) / total; scR = (iH - pad * (len(right_nodes) - 1)) / total
def stack(nodes, k):
    y, out = 0.0, {}
    for n, v in nodes: out[n] = (y, y + v * k); y += v * k + pad
    return out
ly, ry = stack(left_nodes, sc), stack(right_nodes, scR)
s = root("cw-sk", "sk", W, H, "Visitors by source and outcome (% of sessions)",
         "Sankey diagram. Organic brings 34% of sessions and converts best; social brings 12% and bounces most. 24% sign up, 18% start a trial, 38% browse and 20% bounce.")
s += tokens("cw-sk", "    .cw-sk .node{fill:var(--cw-muted)}.cw-sk .node-out{fill:var(--cw-ink)}.cw-sk .flow{fill:var(--cw-c1);fill-opacity:.35}.cw-sk .flow.lost{fill:var(--cw-c2);fill-opacity:.3}.cw-sk:hover .flow{fill-opacity:.15}.cw-sk .flow:hover{fill-opacity:.6}\n    .cw-sk .lbl{fill:var(--cw-ink);font-size:12px}.cw-sk .val{fill:var(--cw-muted);font-size:11px;font-variant-numeric:tabular-nums}\n")
s += f'  <g transform="translate(0,{T})">\n    <g>\n'
loff = {n: ly[n][0] for n, _ in left_nodes}; roff = {n: ry[n][0] for n, _ in right_nodes}; mx = (L + R) / 2
for ln, _ in left_nodes:
    for rn, _ in right_nodes:
        v = links[(ln, rn)]; ha, hb = v * sc, v * scR
        ya0, ya1, yb0, yb1 = loff[ln], loff[ln] + ha, roff[rn], roff[rn] + hb
        loff[ln] += ha; roff[rn] += hb
        cls = "flow lost" if rn == "Bounced" else "flow"
        s += f'      <path class="{cls}" d="M{L},{ya0:.1f} C{mx:.0f},{ya0:.1f} {mx:.0f},{yb0:.1f} {R},{yb0:.1f} L{R},{yb1:.1f} C{mx:.0f},{yb1:.1f} {mx:.0f},{ya1:.1f} {L},{ya1:.1f} Z"><title>{ln} → {rn}: {v}%</title></path>\n'
s += '    </g>\n    <g>\n'
for n, v in left_nodes:
    y0, y1 = ly[n]; s += f'      <rect class="node" x="{L-nodeW}" y="{y0:.1f}" width="{nodeW}" height="{y1-y0:.1f}"/><text class="lbl" x="{L-nodeW-10}" y="{(y0+y1)/2:.1f}" dy="0.32em" text-anchor="end">{n} <tspan class="val">{v}%</tspan></text>\n'
for n, v in right_nodes:
    y0, y1 = ry[n]; s += f'      <rect class="node node-out" x="{R}" y="{y0:.1f}" width="{nodeW}" height="{y1-y0:.1f}"/><text class="lbl" x="{R+nodeW+10}" y="{(y0+y1)/2:.1f}" dy="0.32em">{n} <tspan class="val">{v}%</tspan></text>\n'
s += '    </g>\n  </g>\n</svg>\n'
write("sankey.svg", s)

# 9. flow diagram: 9 nodes, 2 groups, icons from the sprite, on its own wide canvas ---------------------
sprite = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "plugins", "knowledgeware", "skills", "chartware", "templates", "svg", "icons.svg")).read()
def sym(n):
    m = re.search(rf'  <symbol id="cwi-{n}".*?</symbol>', sprite, re.S)
    return m.group(0) if m else ""
icons = ["browser", "device-mobile", "cloud", "server", "robot", "apachekafka", "postgresql", "database", "package"]
nodes = {  # id: (x, y, w, h, class, label, sub, icon); columns at 24, 300, 580, 860; rows at 100, 260, 420
    "web": (24, 89, 160, 64, "node", "Web app", "Next.js", "browser"), "mob": (24, 260, 160, 64, "node", "Mobile", "iOS, Android", "device-mobile"),
    "gw": (300, 100, 160, 64, "node", "API gateway", "rate limits, auth", "cloud"),
    "api": (580, 100, 180, 64, "node-accent", "Order service", "Go", "server"), "kafka": (580, 260, 180, 64, "node-soft", "Kafka", "orders.events", "apachekafka"),
    "agent": (580, 420, 180, 64, "node-accent", "Agent core", "Claude API", "robot"),
    "pg": (860, 100, 180, 64, "node-soft", "PostgreSQL", "orders, customers", "postgresql"), "vec": (860, 260, 180, 64, "node-soft", "Vector store", "pgvector", "database"),
    "obj": (860, 420, 180, 64, "node-soft", "Object store", "artifacts", "package"),
}
W, H = 1064, 520
s = root("cw-dg", "dg", W, H, "Order platform: request and data flow",
         "Architecture diagram. Web and mobile clients call the API gateway, which routes to the order service and the agent core. The order service writes to PostgreSQL and publishes to Kafka; PostgreSQL syncs embeddings to the vector store; the agent core reads the vector store and writes artifacts to object storage.")
s += tokens("cw-dg", "    .cw-dg .node{fill:var(--cw-panel);stroke:var(--cw-border);stroke-width:1.5}.cw-dg .node-accent{fill:var(--cw-c1);fill-opacity:.12;stroke:var(--cw-c1);stroke-width:1.5}.cw-dg .node-soft{fill:var(--cw-muted);fill-opacity:.06;stroke:var(--cw-border);stroke-width:1.5}\n    .cw-dg .group{fill:var(--cw-muted);fill-opacity:.04;stroke:var(--cw-border);stroke-width:1;stroke-dasharray:6 4}.cw-dg .lbl{fill:var(--cw-ink);font-size:13px;font-weight:500;text-anchor:middle}.cw-dg .sub{fill:var(--cw-muted);font-size:11px;font-weight:400}.cw-dg .lane{fill:var(--cw-muted);font-size:10px;letter-spacing:.08em}\n    .cw-dg .edge{fill:none;stroke:var(--cw-edge);stroke-width:1.75;stroke-linecap:butt}.cw-dg .edge-dashed{stroke-dasharray:6 5}.cw-dg .elbl{fill:var(--cw-muted);font-size:11px;paint-order:stroke;stroke:var(--cw-bg);stroke-width:4;stroke-linejoin:round}.cw-dg .ic{color:var(--cw-muted)}\n")
s += '  <defs>\n    <marker id="dg-arrow" viewBox="0 0 10 10" refX="10.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#94A3B8" style="fill:var(--cw-edge,#94A3B8)"/></marker>\n'
s += "".join(sym(n) + "\n" for n in icons) + '  </defs>\n'
s += '  <rect class="group" x="8" y="60" width="192" height="284" rx="14"/><text class="lane" x="28" y="78">CLIENTS</text>\n'
s += '  <rect class="group" x="844" y="60" width="212" height="444" rx="14"/><text class="lane" x="864" y="78">DATA LAYER</text>\n'
edges = [  # (class, path, label, (x, y, anchor) or None); gutters at x=240, 380, 670, 820, 950
    ("edge", "M184,121 L300,121", "HTTPS", (242, 111, "middle")),
    ("edge", "M184,292 L232,292 Q240,292 240,284 L240,151 Q240,143 248,143 L300,143", "", None),
    ("edge", "M460,132 L580,132", "REST", (520, 122, "middle")),
    ("edge", "M380,164 L380,444 Q380,452 388,452 L580,452", "MCP", (392, 300, "start")),
    ("edge", "M760,132 L860,132", "writes", (810, 122, "middle")),
    ("edge edge-dashed", "M670,164 L670,260", "publish", (682, 212, "start")),
    ("edge edge-dashed", "M950,164 L950,260", "sync embeddings", (962, 212, "start")),
    ("edge", "M760,441 L812,441 Q820,441 820,433 L820,300 Q820,292 828,292 L860,292", "reads", (832, 370, "start")),
    ("edge", "M760,463 L860,463", "artifacts", (810, 476, "middle")),
]
for cls, d, lab, pos in edges:
    s += f'  <path class="{cls}" d="{d}" marker-end="url(#dg-arrow)"/>\n'
for cls, d, lab, pos in edges:
    if pos: s += f'  <text class="elbl" x="{pos[0]}" y="{pos[1]}" text-anchor="{pos[2]}">{lab}</text>\n'
s += '  <g>\n'
for nid, (x, y, w, h, cls, lab, sub, ic) in nodes.items():
    cx = x + w / 2
    s += f'    <rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/>\n    <g class="ic"><use href="#cwi-{ic}" x="{x+12}" y="{y+h/2-11}" width="22" height="22"/></g>\n'
    s += f'    <text class="lbl" x="{cx}" y="{y+h/2-4}">{lab}<tspan class="sub" x="{cx}" dy="1.25em">{sub}</tspan></text>\n'
s += '  </g>\n</svg>\n'
write("diagram-flow.svg", s)
print("wrote 9 charts to", OUT)
