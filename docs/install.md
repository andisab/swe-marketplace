# Installing the plugins

The short version is in the [README](../README.md#install). This page has every other route: older Claude Code versions, shell commands, managing installed plugins, team settings, a local clone, Claude Desktop uploads, claude.ai single skills, the Agent SDK, what runs where, and per-plugin requirements.

### Installing a plugin in Claude Code

These steps install knowledgeware. Every other plugin installs the same way.

1. In a Claude Code session, run:

   ```
   /plugin install knowledgeware --marketplace andisab/swe-marketplace
   ```

   The first time, Claude Code shows the marketplace source, `andisab/swe-marketplace`, and asks you to confirm adding it.

2. Claude Code opens the plugin's details, which list what it will install. Choose **Install for you (user scope)** to have the plugin in every project on this machine. The other two scopes turn it on for the current repository only.

3. Read the last line of the install summary. `Plugin is now active.` means you can use it right away. If it says `Run /reload-plugins to apply.`, Claude Code runs that reload for you.

4. Type `/knowledgeware:` in the prompt box, and you should see the plugin's skills, such as `/knowledgeware:slideware`. You don't have to call a skill by name, because Claude loads it when your request matches. Ask for a deck, and the slideware skill takes over.

On Claude Code older than v2.1.275, add the marketplace first and then install the plugin by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install knowledgeware@swe-marketplace
```

The part after the `@` is the name the marketplace registers under, `swe-marketplace`. The repository it comes from is `andisab/swe-marketplace`. Run `/plugin` with no arguments to browse every plugin in the marketplace.

### From a shell

Use these in scripts, dotfiles or CI:

```bash
claude plugin marketplace add andisab/swe-marketplace
claude plugin install knowledgeware@swe-marketplace            # add --scope project|local|user
claude plugin install knowledgeware --marketplace andisab/swe-marketplace   # one step, v2.1.292+
```

Plugins installed from a shell load the next time you start Claude Code, or after `/reload-plugins` in a session that's already open.

### Manage installed plugins

| Task | Command |
|---|---|
| List installed plugins | `claude plugin list` |
| Turn on automatic updates | `/plugin` → **Marketplaces** → **swe-marketplace** → **Enable auto-update** |
| Update one plugin | `claude plugin update knowledgeware@swe-marketplace` |
| Update everything from this marketplace | `/plugin` → **Marketplaces** → **swe-marketplace** → **Update marketplace** |
| See what a plugin adds to each session | `claude plugin details knowledgeware@swe-marketplace` |
| Turn a plugin off or on | `claude plugin disable knowledgeware@swe-marketplace` / `enable` |
| Uninstall a plugin | `claude plugin uninstall knowledgeware@swe-marketplace` |
| Remove the marketplace and its plugins | `claude plugin marketplace remove swe-marketplace` |

### For a team

Commit the marketplace and the plugins you want to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "swe-marketplace": { "source": { "source": "github", "repo": "andisab/swe-marketplace" } }
  },
  "enabledPlugins": {
    "knowledgeware@swe-marketplace": true
  }
}
```

Teammates get the marketplace once they trust the project folder. Each of them then runs `claude plugin install knowledgeware@swe-marketplace --scope project` once, because enabling a plugin in settings doesn't download it.

### From a local clone

Use a clone to try changes or to work offline:

```bash
git clone https://github.com/andisab/swe-marketplace.git
claude plugin marketplace add ./swe-marketplace                # a relative path must start with ./
claude --plugin-dir ./swe-marketplace/plugins/knowledgeware    # load one plugin for a single session, no install
```

### Claude Desktop

**Chat and Cowork.** Open **Customize → Plugins → Add**, and then choose one of two options:

- **Add marketplace.** Enter `andisab/swe-marketplace` (or `https://github.com/andisab/swe-marketplace`) and install plugins from it. Updates arrive through the marketplace.
- **Upload plugin.** Upload a `.zip` of one plugin folder. The zip must contain exactly one `.claude-plugin/plugin.json`. To make one from a clone, run:

  ```bash
  cd swe-marketplace/plugins && zip -r knowledgeware.zip knowledgeware -x '*.DS_Store'
  ```

**Code tab.** Click **+** next to the prompt box, choose **Add plugins**, and pick plugins from a marketplace you've added. Plugins aren't available in cloud sessions or under WSL.

Cowork allows up to 200 MB and 5,000 files per plugin, and up to 25 added marketplaces.

### What runs where

A plugin bundles several kinds of components, and not every Claude app runs all of them:

| Where you use Claude | Skills and commands | Agents and hooks | Local MCP servers | LSP servers, output styles, settings, `bin/` |
|---|---|---|---|---|
| Claude Code (terminal, IDE, Desktop Code tab) | ✓ | ✓ | ✓ | ✓ |
| Desktop Cowork | ✓ | ✓ | ✓ | — |
| Desktop Chat, claude.ai | ✓ | — | — | — |

So `adv`'s reviewer agent, `research-team`'s researchers and `knowledgeware`'s librarian need Claude Code or Cowork. Bundled npm dependencies are installed only in Claude Code.

### claude.ai (a single skill)

To use one skill without its plugin, upload it as a zip under **Customize → Skills → + → Create skill → Upload a skill**. The zip must hold the skill's folder, not just its contents, and the folder name must match the skill's `name`:

```bash
cd swe-marketplace/plugins/context-engineering/skills && zip -r skill-dev.zip skill-dev
```

Skills need code execution, which you turn on under **Settings → Capabilities → Code execution and file creation**. A single skill works when it's self-contained, as context-engineering's authoring skills and research-team's `report-formats` are. Skills that run their plugin's scripts (`knowledgeware`, `adv:dispatch`) or start agents (`research-team:coordinator`) need the whole plugin, installed in Claude Code or Cowork.

### Claude Agent SDK

Every plugin ships its own `plugin.json`, so the SDK can load one straight from a clone with `ClaudeAgentOptions(plugins=[{"type": "local", "path": "swe-marketplace/plugins/knowledgeware"}])`, or with `--plugin-dir` on the CLI.

### Requirements

Most plugins are instructions for Claude and need nothing else on your machine. Two need tools installed:

| Plugin | Needs | Optional |
|---|---|---|
| `adv` | [Codex CLI](https://github.com/openai/codex), signed in with a ChatGPT plan or an OpenAI API key, and [Gemini CLI](https://github.com/google-gemini/gemini-cli) with a Gemini API key from a project that has billing enabled (the free tier can't finish a review). The key can come from `GOOGLE_API_KEY`, `GEMINI_API_KEY` or 1Password through `~/.env`. The [adv README](../plugins/adv/README.md#setup) walks through sign-in, the key lookup and a health check. | `gh` for reviewing a pull request by number. |
| `knowledgeware` | Node.js for slide builds and registry scripts (the draw.io MCP server runs through `npx`) | LibreOffice and poppler for PowerPoint previews, and a browser MCP server (Playwright or Claude in Chrome) for visual checks. The [knowledgeware README](../plugins/knowledgeware/README.md#requirements) has the details. |
