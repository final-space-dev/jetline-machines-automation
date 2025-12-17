#!/usr/bin/env python3
"""
Export comparison with SSH tunnel support
Creates SSH tunnel automatically, runs the export, then closes tunnel
"""

import subprocess
import time
import os
import sys
from pathlib import Path

# SSH tunnel configuration
SSH_HOST = "172.20.246.163"
SSH_USER = "finalspace"
SSH_PASS = "nBqKbCXVQ86gzj4dNZkMhU"
LOCAL_PORT = 3307  # Use 3307 to avoid conflicts with local MySQL
REMOTE_HOST = "172.20.251.127"
REMOTE_PORT = 3306

def check_sshpass():
    """Check if sshpass is installed"""
    try:
        subprocess.run(["sshpass", "-V"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def install_sshpass():
    """Install sshpass via homebrew"""
    print("Installing sshpass...")
    try:
        subprocess.run(["brew", "install", "sshpass"], check=True)
        return True
    except subprocess.CalledProcessError:
        print("ERROR: Failed to install sshpass")
        print("Please install manually: brew install sshpass")
        return False

def create_tunnel():
    """Create SSH dynamic tunnel (SOCKS proxy) using sshpass"""
    cmd = [
        "sshpass", f"-p{SSH_PASS}",
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-D", str(LOCAL_PORT),  # Dynamic port forwarding (SOCKS proxy)
        f"{SSH_USER}@{SSH_HOST}",
        "-N"
    ]

    print(f"Creating SSH SOCKS proxy: localhost:{LOCAL_PORT} → {SSH_HOST}", flush=True)
    print(f"All database connections will be proxied through the jump server", flush=True)
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait a bit for tunnel to establish
    time.sleep(3)

    # Check if process is still running
    if process.poll() is not None:
        stderr = process.stderr.read().decode()
        print(f"ERROR: SSH tunnel failed to start:\n{stderr}")
        return None

    print("✓ SSH SOCKS proxy established", flush=True)
    return process

def run_export():
    """Run the export script with SSH tunnel mode enabled"""
    print("\nRunning export script...", flush=True)

    # Set environment variable to use SSH tunnel
    env = os.environ.copy()
    env["USE_SSH_TUNNEL"] = "true"
    env["SSH_TUNNEL_PORT"] = str(LOCAL_PORT)

    # Run the export script
    script_path = Path(__file__).parent / "export_comparison_excel.py"
    result = subprocess.run(
        ["python3", str(script_path)],
        env=env
    )

    return result.returncode == 0

def main():
    print("=" * 60, flush=True)
    print("Volume Comparison Export with SSH Tunnel", flush=True)
    print("=" * 60, flush=True)
    print(flush=True)

    # Check for sshpass
    if not check_sshpass():
        print("sshpass not found")
        if not install_sshpass():
            sys.exit(1)

    tunnel_process = None

    try:
        # Create SSH tunnel
        tunnel_process = create_tunnel()
        if not tunnel_process:
            sys.exit(1)

        # Run export
        success = run_export()

        if success:
            print("\n✓ Export completed successfully", flush=True)
        else:
            print("\n✗ Export failed", flush=True)
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")

    finally:
        # Clean up tunnel
        if tunnel_process and tunnel_process.poll() is None:
            print("\nClosing SSH tunnel...", flush=True)
            tunnel_process.terminate()
            tunnel_process.wait(timeout=5)
            print("✓ Tunnel closed", flush=True)

if __name__ == "__main__":
    main()
