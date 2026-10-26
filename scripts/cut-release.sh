#!/usr/bin/env bash
# cut-release.sh — fast-forward a plugin's directory release branch to origin/main.
#
# Anthropic's plugin directory follows one git ref per submitted plugin. Each
# submitted plugin tracks `release/<plugin>`, so work on main never reaches the
# directory until this script moves that branch. It refuses to cut when the
# plugin's version on main isn't higher than the version already released, or
# when the release branch isn't an ancestor of main (never force-pushes).
#
# Usage: scripts/cut-release.sh <plugin> [--dry-run] [--yes]
#   --dry-run   show what would be released and stop
#   --yes       skip the confirmation prompt (for scripts)
set -euo pipefail

PLUGIN="${1:-}"; DRY_RUN=false; YES=false
for arg in "${@:2}"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes)     YES=true ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done
if [[ -z "$PLUGIN" ]]; then
  echo "usage: scripts/cut-release.sh <plugin> [--dry-run] [--yes]" >&2; exit 1
fi
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

BRANCH="release/$PLUGIN"
git fetch -q origin

version_at() {  # version_at <ref> -> the plugin's version in that ref's catalog, or empty
  git show "$1:.claude-plugin/marketplace.json" 2>/dev/null \
    | jq -r --arg p "$PLUGIN" '.plugins[] | select(.name == $p) | .version' 2>/dev/null || true
}

MAIN_VERSION="$(version_at origin/main)"
if [[ -z "$MAIN_VERSION" ]]; then
  echo "no plugin named '$PLUGIN' in the catalog on origin/main" >&2; exit 1
fi

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  RELEASED_VERSION="$(version_at "origin/$BRANCH")"
  if ! git merge-base --is-ancestor "origin/$BRANCH" origin/main; then
    echo "origin/$BRANCH is not an ancestor of origin/main; refusing to force-push a release branch" >&2; exit 1
  fi
  if [[ "$(git rev-parse "origin/$BRANCH")" == "$(git rev-parse origin/main)" ]]; then
    echo "$BRANCH is already at origin/main ($PLUGIN $RELEASED_VERSION); nothing to cut"; exit 0
  fi
  if [[ "$(printf '%s\n%s\n' "$RELEASED_VERSION" "$MAIN_VERSION" | sort -V | tail -1)" != "$MAIN_VERSION" || "$RELEASED_VERSION" == "$MAIN_VERSION" ]]; then
    echo "$PLUGIN is $MAIN_VERSION on main and $RELEASED_VERSION on $BRANCH: bump the version in the catalog before cutting" >&2; exit 1
  fi
  RANGE="origin/$BRANCH..origin/main"
  echo "$PLUGIN: $RELEASED_VERSION -> $MAIN_VERSION ($BRANCH -> origin/main, $(git rev-list --count "$RANGE") commits)"
  echo
  echo "Changelog lines added since the last cut:"
  git diff "$RANGE" -- CHANGELOG.md | grep '^+' | grep -v '^+++' | sed 's/^+/  /' || true
  echo
  echo "Files changed under plugins/$PLUGIN/:"
  git diff --stat "$RANGE" -- "plugins/$PLUGIN" | sed 's/^/  /'
else
  echo "$PLUGIN $MAIN_VERSION: first cut, creating $BRANCH at origin/main"
fi

if $DRY_RUN; then echo; echo "dry run: nothing pushed"; exit 0; fi
if ! $YES; then
  read -r -p "Push origin/main to $BRANCH? [y/N] " answer
  [[ "$answer" == [yY] ]] || { echo "not pushed"; exit 0; }
fi
git push origin "origin/main:refs/heads/$BRANCH"
echo "pushed: $BRANCH is at $(git rev-parse --short origin/main). The directory picks it up on its next check (or now, with the push webhook)."
