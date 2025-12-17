#!/usr/bin/env python3
"""
Run export script remotely on the jump server
This avoids complex SSH tunneling by running the script where it has direct database access
"""

import subprocess
import sys
import os
from pathlib import Path

# SSH configuration
SSH_HOST = "172.20.246.163"
SSH_USER = "finalspace"
SSH_PASS = "nBqKbCXVQ86gzj4dNZkMhU"

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXCEL_SOURCE = PROJECT_ROOT / "Volumes from Xerox.xlsx"
DEVICE_METERS_SOURCE = PROJECT_ROOT / "Device Current Meters based on last Reading Date.xlsx"
EXPORT_SCRIPT = SCRIPT_DIR / "export_comparison_excel.py"
ENV_FILE = PROJECT_ROOT / ".env"

# Remote paths
REMOTE_DIR = "/tmp/jetline_export"
REMOTE_SCRIPT = f"{REMOTE_DIR}/export_comparison_excel.py"
REMOTE_EXCEL = f"{REMOTE_DIR}/Volumes from Xerox.xlsx"
REMOTE_DEVICE_METERS = f"{REMOTE_DIR}/Device Current Meters based on last Reading Date.xlsx"
REMOTE_ENV = f"{REMOTE_DIR}/.env"
REMOTE_OUTPUT = f"{REMOTE_DIR}/Volume_Comparison_Report.xlsx"
REMOTE_BALANCE_OUTPUT = f"{REMOTE_DIR}/Xerox_vs_BMS_Balances.xlsx"
REMOTE_BMS_INFO = f"{REMOTE_DIR}/bms_machine_info.json"

def run_ssh_command(cmd, check=True):
    """Run command via SSH"""
    full_cmd = [
        "sshpass", f"-p{SSH_PASS}",
        "ssh", "-o", "StrictHostKeyChecking=no",
        f"{SSH_USER}@{SSH_HOST}",
        cmd
    ]
    result = subprocess.run(full_cmd, capture_output=True, text=True, check=check)
    return result

def copy_to_remote(local_path, remote_path):
    """Copy file to remote server via SCP"""
    cmd = [
        "sshpass", f"-p{SSH_PASS}",
        "scp", "-o", "StrictHostKeyChecking=no",
        str(local_path),
        f"{SSH_USER}@{SSH_HOST}:{remote_path}"
    ]
    subprocess.run(cmd, check=True)

def copy_from_remote(remote_path, local_path):
    """Copy file from remote server via SCP"""
    cmd = [
        "sshpass", f"-p{SSH_PASS}",
        "scp", "-o", "StrictHostKeyChecking=no",
        f"{SSH_USER}@{SSH_HOST}:{remote_path}",
        str(local_path)
    ]
    subprocess.run(cmd, check=True)

def main():
    print("=" * 60)
    print("Remote Export via Jump Server")
    print("=" * 60)
    print()

    # Check sshpass
    try:
        subprocess.run(["sshpass", "-V"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: sshpass not found")
        print("Install: brew install sshpass")
        sys.exit(1)

    print(f"Target server: {SSH_USER}@{SSH_HOST}")
    print()

    # Create remote directory
    print("Setting up remote environment...")
    run_ssh_command(f"mkdir -p {REMOTE_DIR}")
    print("✓ Remote directory created")

    # Copy files to remote
    print("Copying files to jump server...")
    copy_to_remote(EXPORT_SCRIPT, REMOTE_SCRIPT)
    print(f"✓ Copied {EXPORT_SCRIPT.name}")

    copy_to_remote(EXCEL_SOURCE, REMOTE_EXCEL)
    print(f"✓ Copied {EXCEL_SOURCE.name}")

    if DEVICE_METERS_SOURCE.exists():
        copy_to_remote(DEVICE_METERS_SOURCE, REMOTE_DEVICE_METERS)
        print(f"✓ Copied {DEVICE_METERS_SOURCE.name}")

    copy_to_remote(ENV_FILE, REMOTE_ENV)
    print(f"✓ Copied .env")

    # Install Python dependencies on remote if needed
    print("\nInstalling dependencies on jump server...")
    result = run_ssh_command("python3 -m pip list | grep mysql-connector-python", check=False)
    if result.returncode != 0:
        print("Installing mysql-connector-python...")
        run_ssh_command("python3 -m pip install --user mysql-connector-python openpyxl python-dotenv")
    print("✓ Dependencies ready")

    # Run the export script remotely
    print("\nRunning export on jump server...")
    print("(This will query all 63 databases directly from the jump server)")
    print()

    result = run_ssh_command(f"cd {REMOTE_DIR} && python3 export_comparison_excel.py")

    # Print output
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    # Copy results back
    print("\nDownloading results...")
    local_output = PROJECT_ROOT / "Volume_Comparison_Report.xlsx"
    copy_from_remote(REMOTE_OUTPUT, local_output)
    print(f"✓ Report saved: {local_output}")

    # Copy balance report
    local_balance_output = PROJECT_ROOT / "Xerox_vs_BMS_Balances.xlsx"
    try:
        copy_from_remote(REMOTE_BALANCE_OUTPUT, local_balance_output)
        print(f"✓ Balance report saved: {local_balance_output}")
    except subprocess.CalledProcessError:
        print("⚠ Balance report not found (Device Meters file may be missing)")

    # Copy BMS machine info JSON
    local_bms_info = PROJECT_ROOT / "bms_machine_info.json"
    try:
        copy_from_remote(REMOTE_BMS_INFO, local_bms_info)
        print(f"✓ BMS machine info saved: {local_bms_info}")
    except subprocess.CalledProcessError:
        print("⚠ BMS machine info not found")

    # Cleanup remote files
    print("\nCleaning up...")
    run_ssh_command(f"rm -rf {REMOTE_DIR}")
    print("✓ Remote files cleaned up")

    print("\n" + "=" * 60)
    print("✓ Export completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
