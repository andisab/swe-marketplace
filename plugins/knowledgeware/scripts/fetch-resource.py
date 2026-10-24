#!/usr/bin/env python3
"""Download a brandbook, stylesheet or sample deck from a URL, including Google Drive share links.

Usage: python3 fetch-resource.py <url> <dest-path>

A Google Drive share link (file/d/<id>, open?id=<id>, document/d/<id>, presentation/d/<id>)
is turned into the direct-download URL. For a large file Google first answers with its
virus-scan page; the script repeats the request with the page's confirm parameters and
the cookie Google set for it. Both belong to this one download: the cookie jar lives in
memory for the run, and no account, credential or file of the user's is read or sent.
Any other URL is downloaded as is.

Exit codes: 0 written, 2 no Drive file id in the URL, 3 download failed, 4 got an HTML
page instead of the file (login wall or sharing not set to "Anyone with the link").
"""
import http.cookiejar
import os
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "Mozilla/5.0 (knowledgeware fetch-resource)"


def drive_id(url):
    for pattern in (r"/file/d/([A-Za-z0-9_-]+)", r"[?&]id=([A-Za-z0-9_-]+)",
                    r"/document/d/([A-Za-z0-9_-]+)", r"/presentation/d/([A-Za-z0-9_-]+)"):
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return ""


def is_drive(url):
    host = urllib.parse.urlparse(url).netloc
    return host.endswith("drive.google.com") or host.endswith("docs.google.com")


def download(opener, url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with opener.open(req, timeout=120) as response, open(dest, "wb") as out:
        shutil.copyfileobj(response, out)


def looks_like_html(path):
    with open(path, "rb") as f:
        return b"<!DOCTYPE html" in f.read(400) or b"<html" in f.read(400)


def confirm_url(page_text, file_id):
    """The follow-up URL for Google's virus-scan page, in either of its two forms."""
    form = re.search(r'<form[^>]+action="([^"]+)"', page_text)
    if form:
        fields = dict(re.findall(r'<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"', page_text))
        if fields:
            return form.group(1) + "?" + urllib.parse.urlencode(fields)
    m = re.search(r"confirm=([A-Za-z0-9_-]+)", page_text)
    if m:
        return f"https://drive.google.com/uc?export=download&confirm={m.group(1)}&id={file_id}"
    return ""


def main():
    if len(sys.argv) != 3:
        print("Usage: fetch-resource.py <url> <dest-path>", file=sys.stderr)
        return 1
    url, dest = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    try:
        if is_drive(url):
            file_id = drive_id(url)
            if not file_id:
                print(f"Could not extract a Google Drive file ID from: {url}", file=sys.stderr)
                print("Expected formats:\n  https://drive.google.com/file/d/<FILE_ID>/view\n"
                      "  https://drive.google.com/open?id=<FILE_ID>", file=sys.stderr)
                return 2
            print(f"→ Fetching Google Drive file {file_id}", file=sys.stderr)
            download(opener, f"https://drive.google.com/uc?export=download&id={file_id}", dest)
            if looks_like_html(dest):
                page = open(dest, encoding="utf-8", errors="replace").read()
                follow = confirm_url(page, file_id)
                if follow:
                    download(opener, follow, dest)
            if looks_like_html(dest):
                print("Got an HTML page instead of the file (login wall or virus scan).", file=sys.stderr)
                print("Share the file as 'Anyone with the link', or download it by hand.", file=sys.stderr)
                os.remove(dest)
                return 4
        else:
            print(f"→ Fetching {url}", file=sys.stderr)
            download(opener, url, dest)
    except (urllib.error.URLError, OSError) as e:
        print(f"Download failed: {e}", file=sys.stderr)
        if os.path.exists(dest):
            os.remove(dest)
        return 3
    print(f"✓ Wrote {dest} ({os.path.getsize(dest)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
