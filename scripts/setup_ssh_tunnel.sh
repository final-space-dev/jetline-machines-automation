#!/bin/bash
# SSH Tunnel Setup for Database Access via Jump Server
#
# Usage:
# 1. Update SSH_HOST and SSH_USER below
# 2. Run: ./scripts/setup_ssh_tunnel.sh
# 3. Keep this terminal open
# 4. In another terminal, set: export USE_SSH_TUNNEL=true
# 5. Run: python3 scripts/export_comparison_excel.py

# CONFIGURE THESE:
SSH_HOST="172.20.246.163"
SSH_USER="finalspace"
SSH_PASS="nBqKbCXVQ86gzj4dNZkMhU"
LOCAL_PORT=3306

echo "=========================================="
echo "SSH Tunnel for Database Access"
echo "=========================================="
echo ""
echo "This will create an SSH tunnel from:"
echo "  localhost:$LOCAL_PORT → $SSH_HOST → 172.20.251.127:3306"
echo ""
echo "IMPORTANT: Before running this script:"
echo "  1. Update SSH_HOST and SSH_USER in this file"
echo "  2. Ensure you have SSH key access to $SSH_HOST"
echo ""
echo "After tunnel is established:"
echo "  1. Open a NEW terminal"
echo "  2. Run: export USE_SSH_TUNNEL=true"
echo "  3. Run: python3 scripts/export_comparison_excel.py"
echo ""
echo "Press ENTER to continue or Ctrl+C to abort..."
read

echo ""
echo "Creating SSH tunnel..."
echo "Press Ctrl+C to close the tunnel when done"
echo ""

# Create the SSH tunnel
# -L: Local port forwarding
# -N: Don't execute remote commands
# -v: Verbose (remove for less output)
ssh -L $LOCAL_PORT:172.20.251.127:3306 $SSH_USER@$SSH_HOST -N
