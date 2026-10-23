# adv

adv reviews your code changes with three models at once. Five reviewers split across Claude, OpenAI's Codex CLI and Google's Gemini CLI read the same diff, then the engines check each other's findings, and you get one ranked report with a fix plan. It's for developers who already use Codex CLI or Gemini CLI and want a second and third opinion before they commit or merge.

## Requirements

adv calls two other command-line tools, so install and sign in to both before your first review. adv 0.3.0 was tested with Codex CLI 0.163.0 and Gemini CLI 0.65.0 in October 2026; older versions of either CLI take different flags, so update both first.

- **Codex CLI 0.163 or later.** Install it with `npm install -g @openai/codex@latest`. Then sign in with your ChatGPT plan (`codex login`) or with an OpenAI API key (`printenv OPENAI_API_KEY | codex login --with-api-key`). Both work; a Plus plan covers a review's dozen or so calls.
- **Gemini CLI 0.65 or later.** Install it with `npm install -g @google/gemini-cli@latest`, then set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in your environment to a [Gemini API key](https://aistudio.google.com/apikey) from a project with billing enabled. A free-tier key isn't enough: in October 2026 its limit was 20 requests per day on `gemini-3-flash`, and one review makes about nine Gemini calls, each of which can take several requests. Worse, when the quota runs out, Gemini CLI retries with backoff and switches models in silence instead of failing, so every call looks like a hang until adv's 300-second limit stops it. Signing in with a Google account instead (`gemini` then `/auth`) works on a paid Google AI plan; reports from June 2026 say the free Gemini CLI quota for personal Google accounts ended then, which I haven't verified myself.
- **jq, git and python3.** The scripts parse JSON with jq and read the diff with git. They use python3 to time each engine call and to stop one that runs longer than 300 seconds. A review stops at the start if jq is missing or if you aren't inside a git repository.

If Codex or Gemini is missing or fails its health check, the reviewers assigned to it run on Claude instead. The review still finishes, but with fewer independent opinions, and with neither CLI available all five reviewers run on Claude.

**Models.** adv doesn't pass a model flag unless you ask it to. Each CLI then uses its own current default: in October 2026 that is `gpt-6.1-sol` for Codex, and Gemini's "auto" mode, which routed to `gemini-3.1-pro-preview` and `gemini-3-flash-preview` in testing. To pin a model, set `ADV_CODEX_MODEL`, `ADV_GEMINI_MODEL` or `ADV_CLAUDE_MODEL` (default `sonnet`) in your environment. When Gemini reports an exhausted quota or a model that no longer exists, adv retries that reviewer on `ADV_GEMINI_FALLBACK_MODEL` (default `gemini-3-flash-preview`) before falling back to Claude. If your `~/.codex/config.toml` pins a model that has since been retired, Codex warns `Model metadata for ... not found` on every call and runs on fallback settings, so remove the pin or update it.

Gemini's `google_search` extension is optional. `/adv:adv-gemini-research` uses it to ground answers in Google Search, and without it the command still runs, but without search grounding.

Once the plugin is installed, check your setup from a terminal. Replace `<version>` with the version that `claude plugin list` shows for adv, such as `0.3.0`:

```bash
bash ~/.claude/plugins/cache/swe-marketplace/adv/<version>/skills/dispatch/scripts/dispatch.sh --check-deps
```

When everything required is present, the last line reads `All required dependencies available.` It prints each CLI's version and a `NOTE` when one is older than the version adv was tested with. `BROKEN` means the command is on your `PATH` but can't run, which happens when an npm update leaves the Codex package without its native binary; reinstalling fixes it. Other `NOTE` lines describe optional pieces.

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

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **adv**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

Run these from inside a git repository.

**Review your uncommitted changes.** The full review is an agent, not a slash command, so ask for it by name:

```
Use the adv-review agent to review my uncommitted changes
```

You can also type `@agent-adv:adv-review` followed by the request. The agent first prints a setup line with the scope and which engines are available, then runs the reviewers, cross-examines their findings and writes the report to `.claude/reviews/review-<timestamp>.md` in your repository. The conversation gets a summary with the number of bugs and nits and the top issues. With no uncommitted changes, it reviews the last commit, and if that's empty too, the whole repository.

**Review a range of commits.** Name the scope in the request, and the agent passes it to its preflight script:

```
Use the adv-review agent to review --since HEAD~5
Use the adv-review agent to review --commits a1b2c3d..e4f5a6b
Use the adv-review agent to review the whole repository with --full
```

For `--full`, the reviewers get a list of the repository's files instead of a diff and read the files they judge most important.

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

**How many model calls does one review make?** With both CLIs available, a review makes one health-check call to each engine, four reviewer calls split between Codex and Gemini, and up to six cross-examination calls, two per round for at most three rounds. The simplification reviewer, any Claude fallbacks and the synthesis run on Claude.

**How long does a review take?** It depends on the size of the diff and on how quickly each engine answers, and the summary at the end reports the duration of that run. For scale, in October 2026 testing a one-line health prompt took about 4 seconds on Codex (`gpt-6.1-sol`) and 7 to 15 seconds on Gemini in its default auto mode, which in plan mode routes every call to the Pro model. Gemini's times varied far more than Codex's: the same prompt took 15, 97 and 256 seconds on consecutive runs when the key's quota was close to its limit, because the CLI retries with backoff rather than failing. adv stops any engine call that runs longer than 300 seconds and counts it as a failure, so that reviewer falls back to Claude.

**The review stopped with "Only N/5 reviewers succeeded".** adv needs at least two of the five reviewers to finish before it cross-examines anything. The temporary folder stays in place after this error, so read `.claude/reviews/.tmp/dispatch.log` for the reason each engine failed, then run the dependency check above.

**Gemini reports an exhausted quota, or a 404 for the model.** adv retries that reviewer on the fallback model (`gemini-3-flash-preview` unless `ADV_GEMINI_FALLBACK_MODEL` says otherwise) and falls back to Claude if that fails too. The report notes which reviewers fell back.

**Every Gemini call runs for 300 seconds, then times out.** Gemini CLI doesn't report an exhausted quota; it retries with backoff and switches models until something answers. adv's health check sends one request through the REST API first and reports `quota` with Google's retry time in `.claude/reviews/.tmp/dispatch.log`, so the review falls back to Claude right away. If the health check passed and the review's calls still time out, the quota ran out mid-review, or the model the CLI routed to is out of quota while the probed one wasn't.

**The health check fails with `auth` although my keys are set.** Read `.claude/reviews/.tmp/dispatch.log`. When adv gets the Gemini key through 1Password, an `op` error such as `More than one item matches` counts as an auth failure, and the fix is in your vault or `~/.env`, not in adv.

**Should I commit `.claude/reviews/`?** adv creates the folder in your repository and keeps every report there. Add `.claude/reviews/` to `.gitignore` unless you want the review history in version control.

**Claude asks before every script call.** See [Allow the scripts without prompts](#allow-the-scripts-without-prompts).

For general questions about updates, context cost and installs, see the [marketplace FAQ](../../README.md#faq).

## How a review runs

1. **Preflight.** One script checks the dependencies, sends a short health-check prompt to Codex and Gemini, and writes the diff or file list to `.claude/reviews/.tmp/scope-content.txt`.
2. **Review.** Four reviewers run in parallel on the external engines, and a Claude subagent runs the fifth.
3. **Cross-examination.** In each round, two engines read every finding and mark it VALIDATE (the problem is real), DISPUTE (a false positive or overstated) or AMEND (real, but the severity or fix is wrong). They can also add new findings. The rounds stop when one produces no new disputes and no new findings, and after three rounds at most.
4. **Synthesis.** The agent merges duplicates into one entry that lists every reviewer who raised it. It drops a disputed finding unless two or more other reviewers validated it, ranks the rest by severity and agreement, and groups a checklist of fixes by file.
5. **Cleanup.** The agent writes `.claude/reviews/findings-<timestamp>.json` with the scope, engines, reviewer status and counts, then deletes `.claude/reviews/.tmp/`.

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

## Engine fallbacks

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

## Gemini API key lookup

`dispatch.sh` looks for a Gemini key in this order:

1. The `GOOGLE_API_KEY` environment variable.
2. The `GEMINI_API_KEY` environment variable.
3. Optionally, 1Password. If neither variable is set, the `op` CLI is installed and `~/.env` mentions `GEMINI_API_KEY`, the script runs Gemini through `op run --env-file ~/.env`.

With no key from any of these, Gemini CLI uses its own sign-in.

## dispatch.sh exit codes

`dispatch.sh` also prints a JSON status line with an `error_type` field.

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
