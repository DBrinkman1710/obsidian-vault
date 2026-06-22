#!/usr/bin/env bash
# new-session.sh <label> [description]
# Creates a git worktree for a parallel Claude Code session.
#
# Usage:
#   ./scripts/new-session.sh b "rbac-fixes"
#   → worktree at ~/yippie-b/  on branch session/b-20260620-rbac-fixes
#
# The second Claude Code instance should open ~/yippie-b/yippie/ as its working dir.
# When done, run:  ./scripts/land-session.sh b

set -euo pipefail

LABEL="${1:?Usage: new-session.sh <label> [description]}"
DESC="${2:-work}"
DESC_SLUG=$(echo "$DESC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
DATE=$(date +%Y%m%d)
BRANCH="session/${LABEL}-${DATE}-${DESC_SLUG}"
WORKTREE="$HOME/yippie-${LABEL}"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

if git -C "$REPO_ROOT" worktree list | grep -q "$WORKTREE"; then
  echo "ERROR: Worktree already exists at $WORKTREE"
  echo "       Run: land-session.sh $LABEL  (or remove it manually)"
  exit 1
fi

# Sync sandbox so the new branch starts clean
echo "→ Fetching latest sandbox…"
git -C "$REPO_ROOT" fetch origin sandbox:sandbox 2>/dev/null || \
  git -C "$REPO_ROOT" fetch origin sandbox

echo "→ Creating worktree at $WORKTREE on branch ${BRANCH}…"
git -C "$REPO_ROOT" worktree add "$WORKTREE" -b "$BRANCH" sandbox

echo ""
echo "  Worktree : $WORKTREE"
echo "  Branch   : $BRANCH"
echo ""
echo "  Open Claude Code in:  $WORKTREE/yippie/"
echo "  When done, run:       $REPO_ROOT/yippie/scripts/land-session.sh $LABEL"
