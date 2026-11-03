"""Tests for the catalog scripts: the plugin.json generator, the agent tool-grant
check and the README catalog check.

Each test builds a small fixture repository in a temp folder (a catalog, plugin
folders, agents, a README), copies the script under test into its scripts/
folder, and runs it there as CI does, asserting on the exit code and output.
The scripts find the repository from their own location, so a copy checks the
fixture and never this checkout. Standard library only.

Run: python3 -m unittest discover -s scripts/tests
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent

GOOD_AGENT = """---
name: {name}
description: A fixture agent.
tools: {tools}
model: sonnet
---

Body.
"""


class FixtureRepo:
    """A throwaway repository: catalog, plugins, README, and copies of the scripts."""

    def __init__(self, plugins: list[dict]):
        self.root = Path(tempfile.mkdtemp(prefix="catalog-test-"))
        (self.root / ".claude-plugin").mkdir()
        (self.root / "scripts").mkdir()
        for script in ("synthesize-plugin-manifests.py", "check-agent-tools.py", "check-readme-catalog.py"):
            shutil.copy(SCRIPTS / script, self.root / "scripts" / script)
        self.catalog = {"name": "fixture", "plugins": plugins}
        self.write_catalog()
        for p in plugins:
            (self.root / p["source"] / "agents").mkdir(parents=True, exist_ok=True)

    def write_catalog(self) -> None:
        (self.root / ".claude-plugin" / "marketplace.json").write_text(json.dumps(self.catalog, indent=2) + "\n")

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def run(self, script: str, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, "-I", str(self.root / "scripts" / script), *args],
                              capture_output=True, text=True, check=False)

    def cleanup(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


def plugin(name: str, version: str = "1.0.0", **extra) -> dict:
    return {"name": name, "source": f"./plugins/{name}", "version": version, "category": "dev", "strict": True, **extra}


class GeneratorTest(unittest.TestCase):
    def setUp(self):
        self.repo = FixtureRepo([plugin("alpha", metadata={"directory": {"icon": "./.claude-plugin/icon.png", "supportUrl": "https://example.com/issues"}})])
        self.addCleanup(self.repo.cleanup)
        self.manifest = self.repo.root / "plugins" / "alpha" / ".claude-plugin" / "plugin.json"

    def test_writes_plugin_json_without_marketplace_fields_and_with_listing_fields_hoisted(self):
        r = self.repo.run("synthesize-plugin-manifests.py")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(self.manifest.read_text()),
                         {"name": "alpha", "version": "1.0.0", "icon": "./.claude-plugin/icon.png", "supportUrl": "https://example.com/issues"})
        self.assertIn("1 updated", r.stdout)
        self.assertIn("0 updated", self.repo.run("synthesize-plugin-manifests.py").stdout, "a second run changes nothing")

    def test_check_passes_in_sync_and_fails_on_a_hand_edit_or_a_missing_file(self):
        self.repo.run("synthesize-plugin-manifests.py")
        self.assertEqual(self.repo.run("synthesize-plugin-manifests.py", "--check").returncode, 0)
        self.manifest.write_text(self.manifest.read_text().replace("1.0.0", "9.9.9"))
        r = self.repo.run("synthesize-plugin-manifests.py", "--check")
        self.assertEqual(r.returncode, 1)
        self.assertIn("plugins/alpha/.claude-plugin/plugin.json", r.stderr)
        self.assertIn("9.9.9", self.manifest.read_text(), "--check never writes")
        self.manifest.unlink()
        self.assertEqual(self.repo.run("synthesize-plugin-manifests.py", "--check").returncode, 1)


class AgentToolsTest(unittest.TestCase):
    def setUp(self):
        self.repo = FixtureRepo([plugin("alpha", mcpServers={"drawio": {"command": "npx"}}), plugin("beta")])
        self.addCleanup(self.repo.cleanup)

    def agent(self, plugin_name: str, name: str, tools: str | None) -> None:
        text = GOOD_AGENT.format(name=name, tools=tools or "")
        if tools is None:
            text = text.replace("tools: \n", "")
        self.repo.write(f"plugins/{plugin_name}/agents/{name}.md", text)

    def test_accepts_built_ins_specifiers_own_mcp_servers_and_optional_servers(self):
        self.agent("alpha", "good", "Read, Edit, Bash(git:*), mcp__drawio__open, mcp__plugin_alpha_drawio__*, mcp__conventions__find_conventions")
        self.repo.write("plugins/beta/agents/other.md", GOOD_AGENT.format(name="other", tools="Read").replace("tools:", "allowed-tools:"))
        r = self.repo.run("check-agent-tools.py")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("all 2 agents", r.stdout)

    def test_rejects_a_missing_grant_unknown_tools_and_undeclared_mcp_servers(self):
        self.agent("beta", "no-grant", None)
        self.agent("beta", "unknown", "Read, MultiEdit")
        self.agent("beta", "borrowed", "Read, mcp__drawio__open")          # alpha's server, not beta's
        self.agent("beta", "external", "Read, mcp__context7__*")           # nobody's server
        r = self.repo.run("check-agent-tools.py")
        self.assertEqual(r.returncode, 1)
        self.assertIn("no-grant.md: no tools: line", r.stderr)
        self.assertIn("unknown.md: MultiEdit", r.stderr)
        self.assertIn("borrowed.md: mcp__drawio__open (server not declared by this plugin)", r.stderr)
        self.assertIn("external.md: mcp__context7__* (server not declared by this plugin)", r.stderr)


class ReadmeCatalogTest(unittest.TestCase):
    ROW = "| [`{0}`](./plugins/{1}/) | {2} | What it's for. | 1 agent |\n"

    def setUp(self):
        self.repo = FixtureRepo([plugin("alpha", "1.2.0"), plugin("beta", "0.3.0")])
        self.addCleanup(self.repo.cleanup)

    def readme(self, *rows: tuple[str, str, str]) -> None:
        self.repo.write("README.md", "# Fixture\n\n| Plugin | Version | What | Contents |\n|---|---|---|---|\n" + "".join(self.ROW.format(*r) for r in rows))

    def test_passes_when_every_plugin_is_listed_once_at_its_version(self):
        self.readme(("alpha", "alpha", "1.2.0"), ("beta", "beta", "0.3.0"))
        r = self.repo.run("check-readme-catalog.py")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_reports_each_kind_of_drift(self):
        self.readme(("alpha", "alpha", "1.1.0"), ("ghost", "ghost", "0.1.0"), ("ghost", "ghost", "0.1.0"), ("gamma", "delta", "1.0.0"))
        r = self.repo.run("check-readme-catalog.py")
        self.assertEqual(r.returncode, 1)
        for expected in ("`alpha` is 1.2.0 in the catalog but 1.1.0 in the README",
                         "`beta` 0.3.0 is in the catalog but not in the README's catalog tables",
                         "README lists `ghost` twice",
                         "README lists `ghost`, which isn't in the catalog",
                         "README row `gamma` links ./plugins/delta/"):
            self.assertIn(expected, r.stderr)


if __name__ == "__main__":
    unittest.main()
