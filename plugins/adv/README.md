# adv

adv reviews your code changes with three models at once. Five reviewers split across Claude, OpenAI's Codex CLI and Google's Gemini CLI read the same diff, then the engines check each other's findings, and you get one ranked report with a fix plan. It's for developers who already use Codex CLI or Gemini CLI and want a second and third opinion before they commit or merge.

## Setup

adv calls two other command-line tools and runs the fifth reviewer and the synthesis on Claude Code itself, so before your first review you install Codex CLI and Gemini CLI, sign each one in, and let adv confirm it can reach them. adv 0.4.0 was tested with Codex CLI 0.163.0 and Gemini CLI 0.65.0 in October 2026; older versions of either CLI take different flags, so update both first. If one CLI is missing or fails its health check, the reviewers assigned to it run on Claude instead: the review still finishes, with fewer independent opinions, and with neither CLI available all five reviewers run on Claude.

### 1. Install the CLIs

```bash
npm install -g @openai/codex@latest        # Codex CLI 0.163 or later
npm install -g @google/gemini-cli@latest   # Gemini CLI 0.65 or later
```

The scripts also need **jq**, **git** and **python3** (`brew install jq` on macOS; the other two are usually present). python3 times each engine call, stops one that runs longer than 300 seconds, and turns Codex's review reports into adv's finding format. A review stops at the start if jq is missing or if you aren't inside a git repository. The GitHub CLI, **gh**, is needed only for `--pr`.

### 2. Sign in to Codex

Codex CLI signs in one of two ways, and adv works with either:

- **With your ChatGPT plan.** Run `codex login`; it opens a browser. A Plus plan covers a review's dozen or so calls. The sign-in expires after a while, and then every adv call to Codex fails with `auth` until you run `codex login` again.
- **With an OpenAI API key.** Run `printenv OPENAI_API_KEY | codex login --with-api-key`, or pipe the key from your secret manager (with 1Password: `op read "op://<vault>/<item>/api key" | codex login --with-api-key`). Calls are then billed to that API account.

`codex login status` tells you which one is active (`Logged in using ChatGPT` or `Logged in using an API key`), and that's the first thing to check when adv reports Codex as unavailable.

Codex reads `~/.codex/config.toml`. Two lines in it matter to adv: a `model = "..."` pin, which adv respects and reports as the model used, and which makes Codex warn `Model metadata for ... not found` and run on fallback settings once that model is retired, so remove or update the pin; and settings that your Codex version no longer knows, which produce `Codex is ignoring 1 unrecognized configuration setting` on every call. Both warnings are harmless to the review and are kept in `.claude/reviews/.tmp/dispatch.log`.

### 3. Give Gemini a key

Get a [Gemini API key](https://aistudio.google.com/apikey) from a Google Cloud project **with billing enabled**. A free-tier key isn't enough: in October 2026 its limit was 20 requests per day on `gemini-3-flash`, one review makes about nine Gemini calls, each of which can take several requests, and Gemini's plan mode routes to the Pro model, which the free tier doesn't cover. Worse, when the quota runs out Gemini CLI retries with backoff and switches models in silence instead of failing, so each call looks like a hang until adv's 300-second limit stops it.

adv looks for the key in this order, and the first match wins:

1. **`GOOGLE_API_KEY`** in the environment.
2. **`GEMINI_API_KEY`** in the environment. adv passes it on as `GOOGLE_API_KEY`.
3. **1Password through `~/.env`.** If neither variable is set, the `op` CLI is installed and `~/.env` contains a `GEMINI_API_KEY=` line (typically `GEMINI_API_KEY="op://<vault>/<item>/credential"`), adv runs every Gemini call and the health check under `op run --env-file ~/.env`, so the key never lands in a shell profile. This needs an unlocked 1Password session: run `op signin` (or `eval $(op signin)`) first, or the health check fails with `auth` and `dispatch.log` shows `authorization timeout` or `account is not signed in`. An `~/.env` item that resolves to two vault entries fails the same way, with `More than one item matches`.

With no key from any of these, Gemini CLI uses its own sign-in: run `gemini` once and `/auth` to sign in with a Google account, which works on a paid Google AI plan. Reports from June 2026 say the free Gemini CLI quota for personal Google accounts ended then, which I haven't verified myself.

Before each review, adv's health check sends one request to the Gemini REST API with the same key, because that's the only way to see a quota or key problem in a second rather than after a 300-second timeout. The request carries a four-word prompt, and the key goes to curl as a request header and is written nowhere.

### 4. Check the setup

Once the plugin is installed, run the dependency check from a terminal. Replace `<version>` with the version that `claude plugin list` shows for adv, such as `0.4.0`:

```bash
bash ~/.claude/plugins/cache/swe-marketplace/adv/<version>/skills/dispatch/scripts/dispatch.sh --check-deps
```

When everything required is present, the last line reads `All required dependencies available.` It prints each CLI's version and a `NOTE` when one is older than the version adv was tested with. `BROKEN` means the command is on your `PATH` but can't run, which happens when an npm update leaves the Codex package without its native binary; reinstalling fixes it. Other `NOTE` lines describe optional pieces: the Gemini key, the `google_search` extension that `/adv:adv-gemini-research` uses for grounding, and `gh`.

Then ping each engine the way a review does:

```bash
bash ~/.claude/plugins/cache/swe-marketplace/adv/<version>/skills/dispatch/scripts/dispatch.sh --engine codex --health-check
bash ~/.claude/plugins/cache/swe-marketplace/adv/<version>/skills/dispatch/scripts/dispatch.sh --engine gemini --health-check
```

Each prints a JSON status line. `"success":true` with `model_used` naming the model means the engine answered. Otherwise `error_type` names the problem, and `.claude/reviews/.tmp/dispatch.log` in the current directory holds the CLI's own message. The table under [When an engine fails](#when-an-engine-fails) says what to do for each.

**Models.** adv doesn't pass a model flag unless you ask it to. Each CLI then uses its own current default: in October 2026 that is `gpt-6.1-sol` for Codex, and Gemini's "auto" mode, which routed to `gemini-3.1-pro-preview` and `gemini-3-flash-preview` in testing. To pin a model, set `ADV_CODEX_MODEL`, `ADV_GEMINI_MODEL` or `ADV_CLAUDE_MODEL` (default `sonnet`) in your environment. When Gemini reports an exhausted quota or a model that no longer exists, adv retries that reviewer on `ADV_GEMINI_FALLBACK_MODEL` (default `gemini-3-flash-preview`) before falling back to Claude. The report's metadata names the model each engine ran, read from the CLIs' own output, and the number of tokens the review used.

Finally, if Claude Code asks before every script call, see [Allow the scripts without prompts](#allow-the-scripts-without-prompts).

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install adv --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install adv@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **adv**. Shell commands, team settings, zip upload and claude.ai options are in the marketplace's [install guide](../../docs/install.md).

## Try it

Run these from inside a git repository.

**Review your uncommitted changes.** The full review is an agent, not a slash command, so ask for it by name:

```
Use the adv-review agent to review my uncommitted changes
```

You can also type `@agent-adv:adv-review` followed by the request. The agent first prints a setup line with the scope and which engines are available, then runs the reviewers, cross-examines their findings and writes the report to `.claude/reviews/review-<timestamp>.md` in your repository. The conversation gets a summary with the number of bugs and nits and the top issues. With no uncommitted changes (tracked or untracked), it reviews the last commit, and if that's empty too, the whole repository.

**Review a range of commits.** Name the scope in the request, and the agent passes it to its preflight script:

```
Use the adv-review agent to review --since HEAD~5
Use the adv-review agent to review --commits a1b2c3d..e4f5a6b
Use the adv-review agent to review the whole repository with --full
```

For `--full`, the reviewers get a list of the repository's files instead of a diff and read the files they judge most important.

**Review a pull request.** Give the agent a pull request number or URL from the repository's GitHub remote:

```
Use the adv-review agent to review --pr 42
```

adv reads the pull request's diff with `gh pr diff` and reviews it without checking anything out, so your working tree stays as it is. The reviewers work from that diff alone, because the files on disk belong to your current branch, not the pull request's. For a deeper review where Codex and Gemini can read the pull request's files, check it out first and review it against its base:

```
gh pr checkout 42
Use the adv-review agent to review --since main
```

**Ask Codex or Gemini one question.** These commands send your prompt to one engine and show its answer without summarizing it:

```
/adv:adv-codex Review src/auth/session.ts for edge cases in token refresh
/adv:adv-gemini Explain how requests flow through this service
```

Both run in the current directory, with Codex in its read-only sandbox and Gemini in plan mode, which is its read-only mode.

**Research a question with Google Search grounding.**

```
/adv:adv-gemini-research What changed in the Node.js 22 permission model?
```

The answer comes back in the conversation. Nothing is written to `.claude/reviews/` except the dispatch log.

## What's inside

| Component | Type | What it does |
|---|---|---|
| `adv-review` | Agent | Runs the full review: preflight, five reviewers, cross-examination, synthesis and cleanup. |
| `/adv:adv-codex <prompt>` | Command | Sends a prompt to Codex CLI and returns its answer as is. |
| `/adv:adv-gemini <prompt>` | Command | Sends a prompt to Gemini CLI and returns its answer as is. |
| `/adv:adv-gemini-research <question>` | Command | Sends a research question to Gemini with Google Search grounding. |
| `dispatch` | Skill | Holds the shared scripts and reviewer prompts. It isn't offered to you directly. |

## Questions and troubleshooting

**Where does my code go?** In a diff review, the diff is part of the prompt that adv sends to OpenAI through Codex CLI and to Google through Gemini CLI, under your own accounts with those services. In a `--full` review, those CLIs receive the file list and can read files in your repository. The Claude reviewers run through Claude Code like the rest of your session.

**How many model calls does one review make?** With both CLIs available, a review makes one health-check call to each engine, four reviewer calls split between Codex and Gemini, and up to six cross-examination calls, two per round for at most three rounds. The simplification reviewer, any Claude fallbacks and the synthesis run on Claude. The summary at the end reports the tokens the engine calls used, except for Codex's review mode, whose report carries no usage.

**Can adv review a pull request, or only my local checkout?** Both. Without `--pr`, adv reviews the repository you're in: the working tree, a commit range, or every file. With `--pr <number>` it reviews the diff of a pull request on the repository's GitHub remote, fetched through `gh`, and leaves your checkout alone. See [Try it](#try-it) for the checkout route when you want the reviewers to read the pull request's files.

**What does "Codex review mode" mean in the report?** For a review of local changes, the two Codex reviewers run `codex review`, Codex CLI's own review mode, which brings a review-tuned prompt and lets Codex run the code to confirm a finding. adv tells it which git scope to read, since Codex CLI 0.163 doesn't accept its own scope flags together with a custom prompt, and rewrites its `[P1]` comments into adv's finding format for cross-examination. Its priorities P0 to P2 become bugs and P3 a nit, and the original priority stays in the finding. For `--full` and `--pr`, and for every cross-examination round, Codex runs `codex exec` with the content in the prompt as before.

**How long does a review take?** It depends on the size of the diff and on how quickly each engine answers, and the summary at the end reports the duration of that run. For scale, in October 2026 testing a one-line health prompt took about 4 seconds on Codex (`gpt-6.1-sol`) and 7 to 15 seconds on Gemini in its default auto mode, which in plan mode routes every call to the Pro model. Gemini's times varied far more than Codex's: the same prompt took 15, 97 and 256 seconds on consecutive runs when the key's quota was close to its limit, because the CLI retries with backoff rather than failing. adv stops any engine call that runs longer than 300 seconds and counts it as a failure, so that reviewer falls back to Claude.

**Should I commit `.claude/reviews/`?** adv creates the folder in your repository and keeps every report there. Add `.claude/reviews/` to `.gitignore` unless you want the review history in version control.

For general questions about updates, context cost and installs, see the [marketplace FAQ](../../README.md#faq).

## How a review runs

1. **Preflight.** One script checks the dependencies, sends a short health-check prompt to Codex and Gemini, and writes the diff, pull request diff or file list to `.claude/reviews/.tmp/scope-content.txt`.
2. **Review.** Four reviewers run in parallel on the external engines, and a Claude subagent runs the fifth. For local changes, the Codex reviewers run in Codex's review mode and read the changes from the repository; the others get the diff in their prompt.
3. **Cross-examination.** In each round, two engines read every finding and mark it VALIDATE (the problem is real), DISPUTE (a false positive or overstated) or AMEND (real, but the severity or fix is wrong). They can also add new findings. The rounds stop when one produces no new disputes and no new findings, and after three rounds at most.
4. **Synthesis.** The agent merges duplicates into one entry that lists every reviewer who raised it. It drops a disputed finding unless two or more other reviewers validated it, ranks the rest by severity and agreement, and groups a checklist of fixes by file.
5. **Cleanup.** The agent writes `.claude/reviews/findings-<timestamp>.json` with the scope, engines, the model each engine ran, token totals, reviewer status and counts, then deletes `.claude/reviews/.tmp/`.

| Reviewer | Looks for | Engine | Fallback |
|---|---|---|---|
| Quality | Naming, dead code, complexity | Codex | Claude |
| Implementation | Logic bugs, correctness, edge cases | Gemini | Claude |
| Testing | Coverage gaps and untested paths | Codex | Claude |
| Simplification | Over-engineering and refactoring | Claude | None |
| Documentation | Missing or stale comments, unclear APIs | Gemini | Claude |

With all three engines available, round 1 pairs Codex with Gemini, round 2 pairs Gemini with Claude, and round 3 pairs Codex with Claude. With one external engine, that engine and Claude run every round together, and with none, Claude runs every round alone.

## Severity tiers

- **Bug.** The problem breaks correctness, security or data integrity.
- **Nit.** The problem is style, naming or a minor improvement.
- **Pre-existing.** The problem is real, but the reviewed changes didn't introduce it.

The report lists bugs first, then nits, then pre-existing problems.

## When an engine fails

adv classifies every failed engine call, prints the class in the setup line of a review (`⚠ gemini unavailable (quota)`) and in the `error_type` of a health check, and keeps the CLI's own message in `.claude/reviews/.tmp/dispatch.log`. That log is the first place to look; it's deleted at the end of a review that finishes, and kept when the review stops early.

| What you see | What it means | What to do |
|---|---|---|
| `codex: auth` | Codex CLI isn't signed in, or the ChatGPT sign-in expired. | `codex login status`, then `codex login` or `codex login --with-api-key` (see [Sign in to Codex](#2-sign-in-to-codex)). |
| `gemini: auth` | No key reached Gemini CLI, the key is invalid, or 1Password couldn't supply it. | Check `GOOGLE_API_KEY` / `GEMINI_API_KEY`; for the `~/.env` route run `op signin` and look for `authorization timeout`, `account is not signed in` or `More than one item matches` in the log (see [Give Gemini a key](#3-give-gemini-a-key)). |
| `gemini: quota` | The health check's REST probe got HTTP 429. The log has Google's message with the retry time. | Enable billing on the key's project, or wait for the daily reset. During a review, adv retries the reviewer on the fallback model and then on Claude. |
| `model_not_found` | The model you pinned (`ADV_*_MODEL`, `--model`, or `~/.codex/config.toml`) is retired or not on your plan. | Remove or update the pin. For Gemini, adv retries on the fallback model first. |
| `timeout` | The engine ran for 300 seconds without finishing. For Gemini this is almost always an exhausted quota mid-review: the CLI retries with backoff and switches models in silence instead of failing. For Codex, a very large scope. | Check the quota as above. For a large diff, review a smaller range (`--since`, `--commits`). If the health check passed and calls still time out, the quota ran out mid-review, or the model the CLI routed to is out of quota while the probed one wasn't. |
| `empty_response` | The CLI exited cleanly but printed an error instead of an answer. | Read the log's last lines. |
| `general` | Anything else: a `BROKEN` install, a flag this CLI version doesn't take, a missing dependency. | Run `--check-deps`, update the CLI, read the log. |
| `Only N/5 reviewers succeeded` | Fewer than two reviewers finished, so there's nothing to cross-examine. The temporary folder stays in place. | Read the log for each engine's reason, fix it, run the review again. |
| The report says every reviewer ran on Claude | Both CLIs were unavailable; the setup line says why for each. | Fix the engines and run the review again; a Claude-only review is a single opinion. |
| `Model metadata for ... not found` in the log | Your `~/.codex/config.toml` pins a retired model. | Update or remove the pin; the review still runs. |
| `--pr` fails at the start | `gh` is missing, not signed in (`gh auth login`), or the repository has no GitHub remote. | Install and sign in to gh, or check the pull request out and use `--since <base>`. |

What adv does when an engine is out:

| Engine problem | What adv does |
|---|---|
| Codex unavailable | The quality and testing reviewers run on Claude. |
| Gemini unavailable | The implementation and documentation reviewers run on Claude. |
| Gemini quota exhausted, or its model not found | adv retries with the fallback model (`gemini-3-flash-preview` by default), then falls back to Claude. |
| Neither available | All five reviewers run on Claude. |

## Allow the scripts without prompts

The agent and commands call bash scripts inside the installed plugin. To stop Claude Code from asking each time, add these rules to your project's `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(bash \"/Users/<you>/.claude/plugins/cache/swe-marketplace/adv/:*)",
      "Bash(rm -rf .claude/reviews/.tmp)"
    ]
  }
}
```

Replace `/Users/<you>` with your home directory, such as `/home/<you>` on Linux. The first rule matches every installed version, so it keeps working after an update. The scripts start Codex with `-s read-only` and Gemini with `--approval-mode plan`, and the second rule only removes the review's temporary folder.

## dispatch.sh exit codes

`dispatch.sh` prints a JSON status line with an `error_type` field, plus `model_used` (the model that answered, read from the CLI's JSON output) and `tokens_in` / `tokens_out`.

| Code | Meaning | `error_type` |
|---|---|---|
| 0 | Success | `none` |
| 1 | General error, such as a bad argument or a missing CLI | `general` |
| 2 | Authentication failed | `auth` |
| 3 | Quota or rate limit reached | `quota` |
| 4 | The engine timed out | `timeout` |
| 5 | The engine returned an empty or error-only response | `empty_response` |
| 6 | The model doesn't exist or isn't on your plan | `model_not_found` |

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). MIT license.
