#!/usr/bin/env bash
# Deploys the `dev` branch as a Preview deployment of the Vercel project
# `jetline-machines-dev` and points the stable dev address at it
# (docs/DEV-ENVIRONMENT.md). The dev copy is its own Vercel project; this
# script names that project by id, so it cannot reach the production project
# (`jetline-machines`) whatever this checkout is linked to. There is no --prod
# here and there must never be.
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_ALIAS="${DEV_ALIAS:-jetline-machines-dev.vercel.app}"

# The FinalSpace team and the project jetline-machines-dev. Ids, not secrets.
export VERCEL_ORG_ID="team_rdzvPFmt6vykW9Fg69BxJNi0"
export VERCEL_PROJECT_ID="prj_v9CCDtNAkX7ACQegeOpg3DuOurxk"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "dev" ]; then
  echo "deploy-dev: this checkout is on '$branch'. The dev environment is deployed from 'dev' only." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "deploy-dev: there are uncommitted changes. Commit them to 'dev' first, so what is deployed is what is in git." >&2
  exit 1
fi

echo "deploy-dev: deploying $(git rev-parse --short HEAD) of dev as a Preview deployment"
url=$(vercel deploy --yes --target=preview)
echo "deploy-dev: built at $url"
vercel alias set "$url" "$DEV_ALIAS"
echo "deploy-dev: https://$DEV_ALIAS now serves $(git rev-parse --short HEAD)"
