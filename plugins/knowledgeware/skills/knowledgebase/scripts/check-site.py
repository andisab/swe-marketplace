#!/usr/bin/env python3
"""Check a built knowledgebase site: broken internal links and raw '<' inside Mermaid blocks.

Run from the site folder (or pass it) after the build, as the last step of the
build-process checks:

    python3 "${CLAUDE_PLUGIN_ROOT}/skills/knowledgebase/scripts/check-site.py" [site-dir]

Links: page.html, page.html#id, #id and other local files (diagrams/...) must
exist; anchors must be real id attributes, since ids the TOC script assigns at
runtime don't count. <script> blocks are skipped, so script-built markup can't
false-flag. Mermaid: a raw '<' inside <pre class="mermaid"> (other than <br>)
breaks parsing before Mermaid sees it. Prints one line per problem and exits 1
when it found any.
"""
import glob
import os
import re
import sys


def main():
    site = sys.argv[1] if len(sys.argv) > 1 else "."
    os.chdir(site)
    problems = 0
    pages = {}
    for f in sorted(glob.glob("*.html")):
        html = re.sub(r"<script\b.*?</script>", "", open(f, encoding="utf-8").read(), flags=re.S)
        pages[f] = (html, set(re.findall(r'\bid="([^"]+)"', html)))
    if not pages:
        print(f"no *.html pages in {os.getcwd()}")
        return 1
    for f, (html, _) in pages.items():
        for href in sorted(set(re.findall(r'href="([^"]+)"', html))):
            if re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|//", href):
                continue  # external, mailto:, data:
            target, _, anchor = href.partition("#")
            target = target or f
            if target not in pages and not os.path.exists(target):
                print(f, "->", href, "MISSING")
                problems += 1
                continue
            if anchor and target in pages and anchor not in pages[target][1]:
                print(f, "->", href, "MISSING-ANCHOR")
                problems += 1
    for f in sorted(pages):
        raw = open(f, encoding="utf-8").read()
        for block in re.findall(r'<pre class="mermaid">(.*?)</pre>', raw, re.S):
            if "<" in block.replace("<br/>", "").replace("<br>", ""):
                print(f, "RAW-ANGLE")
                problems += 1
    print(f"check-site: {len(pages)} pages, {problems} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
