#!/usr/bin/env bash
# promote.sh — promote code between environments
#
# Usage:
#   ./scripts/promote.sh devsandbox→sandbox       # test → staging
#   ./scripts/promote.sh sandbox→production        # staging → app + dev (main branch)
#
# Railway autodeploys on push:
#   sandbox branch     → sandbox.getyippie.com
#   main branch        → app.getyippie.com  (production env)
#                      → dev.getyippie.com  (development env)
#   devsandbox branch  → devsandbox.getyippie.com

set -euo pipefail

STEP="$1"

confirm() {
  read -r -p "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
}

case "$STEP" in

  "devsandbox→sandbox")
    echo "Promoting devsandbox → sandbox"
    echo "This will update sandbox.getyippie.com"
    confirm "Proceed?"
    git fetch origin
    git checkout sandbox
    git pull origin sandbox
    git merge --no-ff origin/devsandbox -m "Promote devsandbox → sandbox"
    git push origin sandbox
    echo "Done. Railway will deploy to sandbox.getyippie.com shortly."
    ;;

  "sandbox→production")
    echo "Promoting sandbox → production (app.getyippie.com + dev.getyippie.com)"
    echo "This will update BOTH production and development Railway environments."
    confirm "Are you sure? This affects live clients."
    git fetch origin
    git checkout main
    git pull origin main
    git merge --no-ff origin/sandbox -m "Promote sandbox → production"
    git push origin main
    echo "Done. Railway will deploy to app.getyippie.com and dev.getyippie.com shortly."
    ;;

  *)
    echo "Usage: $0 <step>"
    echo ""
    echo "Steps:"
    echo "  devsandbox→sandbox    Promote devsandbox to sandbox (staging)"
    echo "  sandbox→production    Promote sandbox to production + dev"
    exit 1
    ;;

esac
