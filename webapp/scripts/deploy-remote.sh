#!/usr/bin/env bash
set -Eeuo pipefail

# Config
APP_DIR="${APP_DIR:-$PWD}"
BASE_PORT="${BASE_PORT:-3003}"
MAX_PORTS="${MAX_PORTS:-1}"
APP_NAME="${APP_NAME:-jetline-machines}"

cd "$APP_DIR"

# --- Helpers ---------------------------------------------------------------
ensure_nvm_and_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi
  # Install NVM (no sudo required)
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # Load NVM for this non-interactive shell
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm alias default 20
}

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  npm i -g pm2
}

ensure_profiles_source_nvm() {
  # Make future shells find node/npm without manual source
  local line='export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
  for f in "$HOME/.bashrc" "$HOME/.profile" "$HOME/.bash_profile"; do
    [ -f "$f" ] || touch "$f"
    grep -q 'NVM_DIR=.*/.nvm' "$f" || echo "$line" >> "$f"
  done
}

kill_port() {
  local port="$1"
  echo "[deploy] Clearing port ${port}..."
  # Stop PM2 app first (common case)
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    fi
  fi
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti :"${port}" 2>/dev/null || true)"
  fi
  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "${port}" 2>/dev/null || true)"
  fi
  if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null | awk -v p=":${port}" '$4 ~ p {split($7,a,","); print a[2]}' | tr '\n' ' ' | xargs echo -n)"
  elif [ -z "$pids" ] && command -v netstat >/dev/null 2>&1; then
    pids="$(netstat -ltnp 2>/dev/null | awk -v p=":${port}" '$4 ~ p {split($7,a,"/"); print a[1]}' | tr '\n' ' ' | xargs echo -n)"
  fi
  if [ -n "$pids" ]; then
    echo "[deploy] Killing PIDs on ${port}: $pids"
    kill -9 $pids 2>/dev/null || true
    sleep 1
  else
    echo "[deploy] No listeners found on ${port}."
  fi
}

try_enable_pm2_startup() {
  # Try to configure PM2 to resurrect on reboot if sudo is available (non-interactive only)
  if command -v sudo >/dev/null 2>&1; then
    set +e
    START_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null | tail -n1)
    if echo "$START_CMD" | grep -q '^sudo'; then
      # Use sudo -n to never prompt for password; silently skip if sudo requires password
      sudo -n bash -lc "$START_CMD" 2>/dev/null || echo "[INFO] pm2 startup skipped (no passwordless sudo available)."
    fi
    set -e
  fi
}

# Install Node (via NVM) and PM2 if missing
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true
ensure_nvm_and_node
# reload after install
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
ensure_profiles_source_nvm

# Now Node/npm exist; ensure pm2
ensure_pm2

# Install dependencies
echo "[deploy] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# Generate Prisma client for production
echo "[deploy] Generating Prisma client..."
npx prisma generate

echo "[deploy] Skipping build - using pre-built .next from local machine"

# Force-clear the base port before picking it
kill_port "$BASE_PORT"

# Pick a free port starting at BASE_PORT
find_port() {
  local base="$1" max="$2" p
  for ((i=0; i<max; i++)); do
    p=$((base+i))
    if command -v ss >/dev/null 2>&1; then
      if ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${p}$"; then
        echo "$p"; return 0
      fi
    else
      if ! lsof -iTCP:"$p" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
        echo "$p"; return 0
      fi
    fi
  done
  return 1
}

PORT="$(find_port "$BASE_PORT" "$MAX_PORTS")"
if [ -z "${PORT:-}" ]; then
  echo "No free port found in range ${BASE_PORT}..$((BASE_PORT+MAX_PORTS-1))" >&2
  exit 1
fi

echo "$PORT" > .port

# Ensure .env exists before starting
if [ ! -f .env ]; then
  echo ".env not found in $APP_DIR. Copy your production .env and re-run deploy." >&2
  exit 1
fi

# Start via PM2 ecosystem config
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Save PM2 process list and try to enable auto-start on reboot
pm2 save >/dev/null 2>&1 || true
try_enable_pm2_startup

echo "Started $APP_NAME on port $PORT"
pm2 list
