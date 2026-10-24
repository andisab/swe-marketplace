#!/usr/bin/env python3
"""Print a Python expression evaluated against the JSON on stdin, bound to `d`.

Test helper for the shell tests (`jq_` in diagram-digest-test.sh), so they need
no jq. Usage: some-command | python3 json-eval.py "d['stats']['nodes']"
"""
import json
import sys

d = json.load(sys.stdin)
# print(<expr>) as the inline version did, so a tuple expression prints space-separated
eval("print(" + sys.argv[1] + ")", {"__builtins__": {"print": print, "len": len, "sorted": sorted, "str": str, "list": list}}, {"d": d})
