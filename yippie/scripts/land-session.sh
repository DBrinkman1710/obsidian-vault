#!/usr/bin/env bash
# land-session.sh <label>
# Rebases the session branch onto sandbox, merges it, pushes, and removes the worktree.
#
# Usage:
#   ./scripts/land-session.sh b

set -euo pipefail

LABEL="${1:?Usage: land-session.sh <label>}"
WORKTREE="$HOME/yippie-${LABEL}"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

if ! git -C "$REPO_ROOT" worktree list | grep -q "$WORKTREE"; then
  echo "ERROR: No worktree found at $WORKTREE"
  echo "       Run new-session.sh $LABEL first, or check the label."
  exit 1
fi

BRANCH=$(git -C "$WORKTREE" branch --show-current)
echo "→ Landing branch: $BRANCH"

# Ensure no uncommitted changes in the session worktree
if ! git -C "$WORKTREE" diff --quiet || ! git -C "$WORKTREE" diff --cached --quiet; then
  echo "ERROR: Uncommitted changes in $WORKTREE — commit or stash them first."
  exit 1
fi

# Sync sandbox
echo "→ Pulling latest sandbox…"
git -C "$REPO_ROOT" fetch origin sandbox:sandbox

# Rebase session branch onto latest sandbox (keeps history linear)
echo "→ Rebasing $BRANCH onto sandbox…"
git -C "$WORKTREE" rebase sandbox

# Merge into sandbox in the main worktree
echo "→ Merging into sandbox…"
git -C "$REPO_ROOT" checkout sandbox
git -C "$REPO_ROOT" merge --no-ff "$BRANCH" -m "land: $BRANCH"

# Push
echo "→ Pushing sandbox to origin…"
git -C "$REPO_ROOT" push origin sandbox

# Tear down
echo "→ Removing worktree and branch…"
git -C "$REPO_ROOT" worktree remove "$WORKTREE" --force
git -C "$REPO_ROOT" branch -d "$BRANCH"

echo ""
echo "  Landed and cleaned up."
echo "  Main worktree is on sandbox at: $REPO_ROOT"
