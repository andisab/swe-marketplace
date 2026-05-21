<!--
Thanks for the contribution! A few quick checks before you submit:
- Edit marketplace.json (not plugin.json — it's generated).
- Run `python scripts/synthesize-plugin-manifests.py` and commit both files.
- Run `./scripts/validate-all.sh` locally.
-->

## What changed

<!-- One or two sentences. Reference the issue if there is one (e.g. "Closes #12"). -->

## Why

<!-- The motivation. Skip if it's a trivial fix. -->

## Type of change

- [ ] New plugin
- [ ] Plugin update (agent/skill/command/hook tweak)
- [ ] Tooling / scripts / CI
- [ ] Docs only
- [ ] Bug fix

## Checklist

- [ ] `marketplace.json` updated (skip if doc-only)
- [ ] `python scripts/synthesize-plugin-manifests.py --check` passes (no drift)
- [ ] `./scripts/validate-all.sh` passes with zero errors and zero warnings
- [ ] New agent files have YAML frontmatter
- [ ] Commit message follows the existing style (Conventional Commits, optional gitmoji)

## Notes for reviewer

<!-- Anything specific you'd like eyes on, or known follow-ups. -->
