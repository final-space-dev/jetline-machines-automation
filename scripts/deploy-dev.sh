#!/usr/bin/env bash
# Deploys the `dev` branch to its Vercel Preview deployment and points the
# stable dev address at it (docs/DEV-ENVIRONMENT.md). It never deploys to
# Production: there is no --prod here and there must never be.
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_ALIAS="${DEV_ALIAS:-jetline-machines-dev.vercel.app}"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "dev" ]; then
  echo "deploy-dev: this checkout is on '$branch'. The dev environment is deployed from 'dev' only." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "deploy-dev: there are uncommitted changes. Commit them to 'dev' first, so what is deployed is what is in git." >&2
  exit 1
fi
if [ ! -f .vercel/project.json ]; then
  echo "deploy-dev: this checkout is not linked to the Vercel project. Run 'vercel link' and choose jetline-machines." >&2
  exit 1
fi

echo "deploy-dev: deploying $(git rev-parse --short HEAD) of dev as a Preview deployment"
url=$(vercel deploy --yes --target=preview)
echo "deploy-dev: built at $url"
vercel alias set "$url" "$DEV_ALIAS"
echo "deploy-dev: https://$DEV_ALIAS now serves $(git rev-parse --short HEAD)"
