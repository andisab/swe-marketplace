#!/usr/bin/env python3
"""Print the font families (sans, serif, mono) named by a style's JSON, one per line.

install-fonts.sh pipes `node load-style.js <name>` into this script. Exits 1 when
the input isn't a style's JSON or names no families, so the caller falls back to
treating its argument as a literal family name.
"""
import json
import sys

try:
    families = json.load(sys.stdin).get("type", {})
except Exception:
    sys.exit(1)
names = [families.get(k) for k in ("sans", "serif", "mono") if families.get(k)]
if not names:
    sys.exit(1)
print("\n".join(dict.fromkeys(names)))
