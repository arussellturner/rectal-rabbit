#!/usr/bin/env bash
# Build the current branch and publish it to the gh-pages branch, in a folder
# named after the branch. It's playable at
# https://arussellturner.github.io/rectal-rabbit/<branch-name>/
#
#   npm run deploy
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
root=$(git rev-parse --show-toplevel)
cd "$root"

npm run build
git fetch -q origin gh-pages

work=$(mktemp -d)
trap 'git worktree remove --force "$work" >/dev/null 2>&1 || true' EXIT
git worktree add -q "$work" origin/gh-pages --detach

rm -rf "${work:?}/$branch"
mkdir -p "$work/$branch"
cp -R dist/. "$work/$branch/"
touch "$work/.nojekyll"

cd "$work"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed since the last deploy."
  exit 0
fi
git commit -q -m "Deploy $branch ($(git -C "$root" rev-parse --short HEAD))"
git push -q origin HEAD:gh-pages
echo "Deployed $branch to gh-pages/$branch/"
