#!/usr/bin/env bash
# crocbot Backup Script for Docker/Coolify Deployments
#
# Backs up crocbot configuration and state to a specified directory.
# Supports both local Docker Compose and Coolify deployments.
#
# Usage:
#   ./scripts/backup.sh [--output-dir <path>] [--gateway-url <url>]
#
# Options:
#   --output-dir    Directory to store backups (default: ./backups)
#   --gateway-url   Gateway URL (default: http://localhost:8080 or $CROCBOT_GATEWAY_URL)
#   --help          Show this help message
#
# Environment Variables:
#   CROCBOT_GATEWAY_URL   Gateway URL (e.g., https://your-domain.com)
#   CROCBOT_GATEWAY_TOKEN Gateway auth token (optional, for authenticated endpoints)
#   CROCBOT_STATE_DIR     State directory for volume backups (default: /data or ~/.crocbot)
#
# Examples:
#   # Local Docker Compose
#   ./scripts/backup.sh --output-dir ~/crocbot-backups
#
#   # Coolify deployment
#   CROCBOT_GATEWAY_URL=https://your-domain.com ./scripts/backup.sh
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults
OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-./backups}"
GATEWAY_URL="${CROCBOT_GATEWAY_URL:-http://localhost:8080}"
GATEWAY_TOKEN="${CROCBOT_GATEWAY_TOKEN:-}"
STATE_DIR="${CROCBOT_STATE_DIR:-}"

print_help() {
  head -30 "$0" | tail -28 | sed 's/^# //' | sed 's/^#//'
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --gateway-url)
      GATEWAY_URL="$2"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      print_help
      exit 1
      ;;
  esac
done

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="crocbot-backup-$TIMESTAMP"
BACKUP_DIR="$OUTPUT_DIR/$BACKUP_NAME"

mkdir -p "$BACKUP_DIR"

log_info "Starting backup: $BACKUP_NAME"
log_info "Gateway URL: $GATEWAY_URL"

# Step 1: Health check
log_info "Checking gateway health..."
HEALTH_RESPONSE=$(curl -sf "$GATEWAY_URL/health" 2>/dev/null || echo "")
if [[ -z "$HEALTH_RESPONSE" ]]; then
  log_error "Gateway not reachable at $GATEWAY_URL/health"
  log_warn "Make sure the gateway is running and accessible"
  exit 1
fi

echo "$HEALTH_RESPONSE" > "$BACKUP_DIR/health.json"
log_info "Gateway is healthy"

# Step 2: Export configuration via /setup/export
log_info "Exporting configuration..."
EXPORT_URL="$GATEWAY_URL/setup/export"

# Try with token if available
CURL_OPTS=(-sf)
if [[ -n "$GATEWAY_TOKEN" ]]; then
  CURL_OPTS+=(-H "Authorization: Bearer $GATEWAY_TOKEN")
fi

CONFIG_EXPORT=$(curl "${CURL_OPTS[@]}" "$EXPORT_URL" 2>/dev/null || echo "")
if [[ -n "$CONFIG_EXPORT" ]]; then
  echo "$CONFIG_EXPORT" > "$BACKUP_DIR/config-export.json"
  log_info "Configuration exported successfully"
else
  log_warn "Could not export configuration from $EXPORT_URL"
  log_warn "This endpoint may require authentication or setup password"
fi

# Step 3: Backup state directory if accessible
if [[ -n "$STATE_DIR" && -d "$STATE_DIR" ]]; then
  log_info "Backing up state directory: $STATE_DIR"

  # Create state backup (exclude large/transient files)
  tar -czf "$BACKUP_DIR/state.tar.gz" \
    -C "$(dirname "$STATE_DIR")" \
    --exclude='*.log' \
    --exclude='logs/*' \
    --exclude='media/*' \
    --exclude='cache/*' \
    "$(basename "$STATE_DIR")" 2>/dev/null || {
      log_warn "Could not create state backup (permission denied or directory empty)"
    }

  if [[ -f "$BACKUP_DIR/state.tar.gz" ]]; then
    log_info "State directory backed up"
  fi
else
  log_warn "State directory not set or not accessible"
  log_warn "For Docker volume backups, use: docker cp <container>:/data ./backup"
fi

# Step 4: Create backup manifest
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "version": "1.0",
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "gateway_url": "$GATEWAY_URL",
  "files": [
$(ls -1 "$BACKUP_DIR" | grep -v manifest.json | sed 's/^/    "/' | sed 's/$/"/' | paste -sd, -)
  ]
}
EOF

# Step 5: Create final archive
ARCHIVE_PATH="$OUTPUT_DIR/$BACKUP_NAME.tar.gz"
tar -czf "$ARCHIVE_PATH" -C "$OUTPUT_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_DIR"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

log_info "Backup complete!"
echo ""
echo "Backup archive: $ARCHIVE_PATH"
echo "Size: $ARCHIVE_SIZE"
echo ""
echo "To restore:"
echo "  1. Extract: tar -xzf $ARCHIVE_PATH"
echo "  2. Import config via /setup or copy state files"
