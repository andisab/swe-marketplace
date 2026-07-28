#!/usr/bin/env python3
"""Heuristic pre-render checks for slideware html-format decks.

Parses index.html, walks the DOM, and reports likely issues by severity:
  - [high] structural problems that will break rendering or fail packaging
  - [med]  visual problems that usually need a real fix
  - [low]  style/consistency warnings worth a glance

Flags are SUSPECTS, not verdicts. False positives are common — render the deck
in a browser before dismissing or acting on a flag.

Usage:
  python polish-deck.py ./index.html
  python polish-deck.py ./index.html --json  # machine-readable output

Exit code 0 always — this is advisory, not a gatekeeper. Use --strict to exit 1
on any [high] flag.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class DeckChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.flags: list[tuple[str, str, str]] = []  # (severity, code, msg)
        self.in_style = False
        self.style_text = ""
        self.section_count = 0
        self.current_section_classes: list[str] = []
        self.section_layouts: list[str] = []
        self.has_reveal_div = False
        self.has_slides_div = False
        self.title = None
        self.in_title = False
        self.reveal_cdn_seen = False
        self.fonts_link_seen = False
        self.has_init_script = False

    # ── handlers ────────────────────────────────────────────────────
    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag == "style":
            self.in_style = True
        elif tag == "title":
            self.in_title = True
        elif tag == "div":
            cls = a.get("class", "")
            if "reveal" in cls.split():
                self.has_reveal_div = True
            if "slides" in cls.split():
                self.has_slides_div = True
        elif tag == "section":
            self.section_count += 1
            cls = a.get("class", "")
            self.current_section_classes = cls.split()
            layout = next((c for c in self.current_section_classes if c.startswith("layout-")), None)
            self.section_layouts.append(layout or "(unspecified)")
        elif tag == "link":
            href = a.get("href", "")
            if "fonts.googleapis.com/css2" in href:
                self.fonts_link_seen = True
                if "display=swap" not in href:
                    self.flags.append(("med", "fonts_no_swap",
                        f"Google Fonts link lacks `display=swap` — risks FOIT (invisible text during load). URL: {href[:80]}"))
            if "cdn.jsdelivr.net/npm/reveal.js" in href:
                self.reveal_cdn_seen = True
        elif tag == "script":
            src = a.get("src", "")
            if "cdn.jsdelivr.net/npm/reveal.js" in src:
                self.reveal_cdn_seen = True

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_style:
            self.style_text += data
        elif self.in_title:
            self.title = (self.title or "") + data
        elif "Reveal.initialize" in data:
            self.has_init_script = True


def check(html_path: Path) -> list[tuple[str, str, str]]:
    if not html_path.exists():
        return [("high", "missing_file", f"File not found: {html_path}")]

    html = html_path.read_text(encoding="utf-8")
    checker = DeckChecker()
    checker.feed(html)

    flags = list(checker.flags)

    if checker.section_count == 0:
        flags.append(("high", "no_slides", "No <section> elements found inside .slides — deck has no slides."))

    if not checker.has_reveal_div:
        flags.append(("high", "no_reveal_div",
            "Missing <div class='reveal'> wrapper — Reveal.js won't initialize."))

    if not checker.has_slides_div:
        flags.append(("high", "no_slides_div",
            "Missing <div class='slides'> inside .reveal — slides won't render."))

    if not checker.reveal_cdn_seen:
        flags.append(("high", "no_reveal_cdn",
            "No Reveal.js CDN link found — slides won't render."))

    if not checker.has_init_script:
        flags.append(("high", "no_init",
            "No `Reveal.initialize(...)` call found — slides won't activate."))

    if not checker.fonts_link_seen:
        flags.append(("low", "no_google_fonts",
            "No Google Fonts <link> found — slides will use system fallback fonts. Verify this is intentional."))

    if "style.md" in html:
        flags.append(("high", "references_style_md",
            "Output HTML references style.md — output must be self-contained. The build should inline theme CSS."))

    if "url(" in checker.style_text and "data:" not in checker.style_text:
        url_count = checker.style_text.count("url(")
        flags.append(("med", "css_external_url",
            f"Inlined CSS references {url_count} `url(...)` resource(s) that aren't data URIs — those become broken if deck moves."))

    css = checker.style_text
    if css and ".reveal" not in css:
        flags.append(("med", "unscoped_css",
            "Inlined CSS appears not to be scoped under `.reveal` — Reveal's reset will clobber unscoped rules."))

    layout_counts: dict[str, int] = {}
    for layout in checker.section_layouts:
        layout_counts[layout] = layout_counts.get(layout, 0) + 1
    total_slides = checker.section_count
    if total_slides >= 4:
        for layout, count in layout_counts.items():
            if layout == "(unspecified)":
                if count >= 1:
                    flags.append(("med", "no_layout_class",
                        f"{count} slide(s) have no `layout-*` class — they'll render unstyled."))
                continue
            if count >= total_slides * 0.5 and count >= 3:
                flags.append(("low", "layout_overuse",
                    f"`{layout}` used {count}/{total_slides} times — consider varying layouts per the anti-monotony rule."))

    card_row_sections = re.findall(r'<section class="layout-card-row[^"]*"[^>]*>(.*?)</section>', html, re.DOTALL)
    for i, s_html in enumerate(card_row_sections):
        card_count = s_html.count('class="card"')
        if card_count > 4:
            flags.append(("med", "card_overflow",
                f"card-row slide #{i+1}: {card_count} cards (>4) — likely overflows 1280×720."))
        elif card_count < 2:
            flags.append(("med", "card_too_few",
                f"card-row slide #{i+1}: {card_count} cards (<2) — use two-column or a different layout."))

    flags.extend(check_unbreakable_tokens(html))

    return flags


# Thresholds tuned for 1280×720 slide at default type scale (14pt body, ~7px/char).
# Card track ≈ 373px with 3 cards → ~53 chars fit; warn at ~70% of that.
# Two-column track ≈ 567px → ~80 chars; warn at ~70%.
# A token longer than these will wrap mid-character (overflow-wrap: anywhere) — it
# won't push past the slide edge anymore, but mid-token wraps look bad and usually
# indicate content that should be shortened.
UNBREAKABLE_THRESHOLDS = {
    "card-row":   {"warn": 28, "high": 45},
    "two-column": {"warn": 50, "high": 75},
    "bullets":    {"warn": 80, "high": 110},
    "title":      {"warn": 35, "high": 55},
    "section":    {"warn": 40, "high": 60},
    "quote":      {"warn": 45, "high": 65},
    "bignumber":  {"warn": 30, "high": 45},
}

_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&[a-z#0-9]+;")


def strip_tags(html_fragment: str) -> str:
    """Return text content. HTML entities collapse to a single placeholder so
    they count as one character regardless of source length (&amp; vs &#38;)."""
    text = _HTML_ENTITY_RE.sub("·", html_fragment)
    text = _TAG_RE.sub(" ", text)
    return text


def longest_unbreakable_run(text: str) -> str:
    """Find the longest run of non-whitespace characters. Soft hyphens and
    explicit break opportunities (​, ­) split the run."""
    runs = re.split(r"[\s​­]+", text)
    return max(runs, key=len, default="")


def check_unbreakable_tokens(html: str) -> list[tuple[str, str, str]]:
    """Detect long unbreakable tokens (URLs, code identifiers, uppercase-with-spacing
    headings) that will wrap mid-character in their layout's content tracks.

    The CSS fix (min-width:0 + overflow-wrap:anywhere on grid items) prevents these
    from pushing past the slide's right edge, but mid-token wraps still look bad.
    Warns the author to shorten the content."""
    out: list[tuple[str, str, str]] = []
    section_re = re.compile(
        r'<section class="layout-([a-z-]+)[^"]*"[^>]*>(.*?)</section>', re.DOTALL)
    slide_index = 0
    for match in section_re.finditer(html):
        slide_index += 1
        layout = match.group(1)
        body = match.group(2)
        thresholds = UNBREAKABLE_THRESHOLDS.get(layout)
        if not thresholds:
            continue
        text = strip_tags(body)
        token = longest_unbreakable_run(text)
        n = len(token)
        if n >= thresholds["high"]:
            severity = "high"
        elif n >= thresholds["warn"]:
            severity = "med"
        else:
            continue
        snippet = token if n <= 60 else token[:57] + "..."
        out.append((severity, "unbreakable_token",
            f"slide #{slide_index} ({layout}): {n}-char unbreakable token '{snippet}' "
            f"exceeds {thresholds['warn']}-char comfort width — likely wraps mid-character. "
            f"Shorten the URL/code/heading or break it with a soft hyphen (­)."))
    return out


def render_flags(flags: list[tuple[str, str, str]], as_json: bool = False) -> str:
    if as_json:
        return json.dumps(
            [{"severity": s, "code": c, "message": m} for s, c, m in flags],
            indent=2,
        )
    order = {"high": 0, "med": 1, "low": 2}
    flags_sorted = sorted(flags, key=lambda f: order.get(f[0], 99))
    if not flags_sorted:
        return "Clean — no issues found."
    out = []
    by_sev: dict[str, int] = {}
    for sev, code, msg in flags_sorted:
        by_sev[sev] = by_sev.get(sev, 0) + 1
        out.append(f"[{sev}] {code}: {msg}")
    summary = "  ".join(f"{sev}={n}" for sev, n in sorted(by_sev.items(), key=lambda x: order.get(x[0], 99)))
    out.append("")
    out.append(f"Summary: {summary}")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path, help="Path to index.html to check")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of text")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero if any [high] flag is present")
    args = parser.parse_args()

    flags = check(args.html)
    print(render_flags(flags, args.json))

    if args.strict and any(f[0] == "high" for f in flags):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
