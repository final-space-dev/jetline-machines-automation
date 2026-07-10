#!/usr/bin/env bash
set -euo pipefail

# Defaults - same server as zara-leads-analytics
REMOTE_HOST="${REMOTE_HOST:-172.20.246.163}"
REMOTE_USER="${REMOTE_USER:-finalspace}"
REMOTE_PATH="${REMOTE_PATH:-~/finalspace/jetline-machines}"

# Parse arguments (override defaults)
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--host)
      REMOTE_HOST="$2"
      shift 2
      ;;
    -u|--user)
      REMOTE_USER="$2"
      shift 2
      ;;
    -p|--path)
      REMOTE_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [-h <host>] [-u <user>] [-p <remote_path>]"
      exit 1
      ;;
  esac
done

SSH_OPTS="-o StrictHostKeyChecking=no"

echo "Deploying to $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

# Build locally first
echo "[local] Generating Prisma client..."
npx prisma generate

echo "[local] Building Next.js..."
npm run build

# Rsync project to remote (exclude node_modules, .git, etc.)
echo "[rsync] Syncing files to remote..."
rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next/cache' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.pem' \
  ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# SSH and run the deploy script on remote
echo "[remote] Running deployment on server..."
ssh $SSH_OPTS "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && bash scripts/deploy-remote.sh"

echo "Deployment complete!"
echo "App running at: http://$REMOTE_HOST:3003"
