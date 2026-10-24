#!/usr/bin/env python3
"""Vendor Mermaid into a knowledgebase site folder, verified against a known hash.

Usage: python3 vendor-mermaid.py [site-dir]      (default: the current folder)

Downloads mermaid.min.js for the pinned Mermaid release from jsDelivr, checks its
SHA-256 against the value recorded below, and writes it as <site-dir>/mermaid.min.js,
which the page template loads with <script src="mermaid.min.js">. A file whose hash
doesn't match is not written. If the site already has a copy with the right hash,
nothing is downloaded. Python's standard library only; this is the plugin's one
download at build time, so a finished site works offline.

To move to a newer Mermaid: change VERSION, download the file once, put its
shasum -a 256 in SHA256, and re-test the templates.
"""
import hashlib
import os
import sys
import urllib.request

VERSION = "11.17.2"
SHA256 = "581ed7d74bd9048d0e3a91363927d72ef22942d7722546b27f7cc29e35390eb8"
URL = f"https://cdn.jsdelivr.net/npm/mermaid@{VERSION}/dist/mermaid.min.js"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    site = sys.argv[1] if len(sys.argv) > 1 else "."
    dest = os.path.join(site, "mermaid.min.js")
    if os.path.exists(dest) and digest(open(dest, "rb").read()) == SHA256:
        print(f"mermaid {VERSION} already vendored at {dest}")
        return 0
    req = urllib.request.Request(URL, headers={"User-Agent": "knowledgeware vendor-mermaid"})
    with urllib.request.urlopen(req, timeout=120) as response:
        data = response.read()
    got = digest(data)
    if got != SHA256:
        print(f"refusing to write {dest}: SHA-256 {got} does not match the pinned {SHA256} for mermaid {VERSION}", file=sys.stderr)
        return 1
    with open(dest, "wb") as f:
        f.write(data)
    print(f"vendored mermaid {VERSION} ({len(data)} bytes, sha256 verified) at {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
