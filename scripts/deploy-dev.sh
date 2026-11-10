#!/usr/bin/env bash
# Deploys the `dev` branch to the dev copy (docs/DEV-ENVIRONMENT.md).
#
# The dev copy is its own Vercel project, `jetline-machines-dev`. Machines'
# production is a different project, `jetline-machines`, and this script cannot
# reach it: it names the dev project by id, checks that the id still belongs to
# a project called jetline-machines-dev, and stops if it does not. It makes a
# Preview deployment and points the dev address at it. There is no production
# deploy flag here and there must never be.
set -euo pipefail
cd "$(dirname "$0")/.."

# The FinalSpace team and the project jetline-machines-dev. Ids, not secrets.
export VERCEL_ORG_ID="team_rdzvPFmt6vykW9Fg69BxJNi0"
export VERCEL_PROJECT_ID="prj_v9CCDtNAkX7ACQegeOpg3DuOurxk"
DEV_PROJECT="jetline-machines-dev"
DEV_ALIAS="${DEV_ALIAS:-jetline-machines-dev.vercel.app}"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "dev" ]; then
  echo "deploy-dev: this checkout is on '$branch'. The dev copy is deployed from 'dev' only." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "deploy-dev: there are uncommitted changes. Commit them to 'dev' first, so what is deployed is what is in git." >&2
  exit 1
fi

name=$(vercel api "/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).name||"")}catch{console.log("")}})')
if [ "$name" != "$DEV_PROJECT" ]; then
  echo "deploy-dev: project $VERCEL_PROJECT_ID is '$name', not '$DEV_PROJECT'. Refusing to deploy." >&2
  exit 1
fi

echo "deploy-dev: deploying $(git rev-parse --short HEAD) of dev to $DEV_PROJECT as a Preview deployment"
out=$(vercel deploy --yes --target=preview)
# The CLI prints either the address alone or a JSON report holding it.
url=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.deployment?.url||"")}catch{const m=s.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/);console.log(m?m[0]:"")}})')
if [ -z "$url" ]; then
  echo "deploy-dev: could not read the deployment's address from the CLI's output:" >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
echo "deploy-dev: built at $url"
vercel alias set "$url" "$DEV_ALIAS" >/dev/null
echo "deploy-dev: https://$DEV_ALIAS now serves $(git rev-parse --short HEAD)"
