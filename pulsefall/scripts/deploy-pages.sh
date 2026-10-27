#!/usr/bin/env bash
# Build Pulsefall and publish dist/ to the repository's gh-pages branch (GitHub Pages).
# One-time setup on GitHub: Settings -> Pages -> Deploy from a branch -> gh-pages / (root).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
ROOT=$(git rev-parse --show-toplevel)
SRC_REV=$(git rev-parse --short HEAD)
TMP=$(mktemp -d)
cleanup() { git -C "$ROOT" worktree remove --force "$TMP" 2>/dev/null || true; }
trap cleanup EXIT
git -C "$ROOT" fetch origin gh-pages 2>/dev/null || true
if git -C "$ROOT" show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git -C "$ROOT" worktree add -B gh-pages "$TMP" origin/gh-pages
else
  git -C "$ROOT" worktree add --detach "$TMP"
  git -C "$TMP" checkout --orphan gh-pages
  git -C "$TMP" rm -rf --quiet .
fi
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
git -C "$TMP" add -A
if git -C "$TMP" diff --cached --quiet; then
  echo "Nothing changed; gh-pages is up to date."
else
  git -C "$TMP" commit -q -m "Deploy Pulsefall from ${SRC_REV}"
  git -C "$TMP" push origin gh-pages
fi
