#!/usr/bin/env bash
# fly-backup.sh - Export crocbot data from Fly.io for off-platform backup
#
# Usage:
#   ./scripts/fly-backup.sh [app-name]
#
# Creates a timestamped backup tarball in ~/crocbot-backups/
#
# Prerequisites:
#   - flyctl CLI installed and authenticated
#   - SSH access to the Fly.io app
#
# What gets backed up:
#   - crocbot.json (configuration)
#   - credentials/ (auth tokens, if stored locally)
#   - agents/ (session data, memory)
#
# Note: Fly secrets (env vars) are NOT included - store those separately.

set -euo pipefail

APP_NAME="${1:-crocbot}"
BACKUP_DIR="${HOME}/crocbot-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${APP_NAME}-backup-${TIMESTAMP}.tar.gz"

echo "==> Backing up Fly.io app: ${APP_NAME}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Create tarball on remote server
echo "==> Creating archive on remote server..."
fly ssh console -a "${APP_NAME}" -C "tar czf /tmp/backup.tar.gz -C /data crocbot.json credentials agents 2>/dev/null || tar czf /tmp/backup.tar.gz -C /data crocbot.json 2>/dev/null || echo 'Warning: Some files may be missing'"

# Download via SSH cat (sftp can be flaky)
echo "==> Downloading backup..."
fly ssh console -a "${APP_NAME}" -C "cat /tmp/backup.tar.gz" > "${BACKUP_FILE}"

# Clean up remote temp file
fly ssh console -a "${APP_NAME}" -C "rm -f /tmp/backup.tar.gz" || true

# Verify
if [[ -f "${BACKUP_FILE}" ]] && [[ -s "${BACKUP_FILE}" ]]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "==> Backup complete: ${BACKUP_FILE} (${SIZE})"
    echo ""
    echo "Contents:"
    tar tzf "${BACKUP_FILE}" | head -20
    echo ""
    echo "To restore, see: https://docs.molt.bot/platforms/fly-backups#import-data-manual-restore"
else
    echo "ERROR: Backup file is empty or missing"
    exit 1
fi
