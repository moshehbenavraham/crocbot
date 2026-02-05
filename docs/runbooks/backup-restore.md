# Backup & Restore

## Overview

crocbot stores configuration and state in persistent storage. This guide covers backup procedures for Docker/Coolify deployments.

## What Gets Backed Up

| Component | Location | Description |
|-----------|----------|-------------|
| Configuration | `/data/crocbot.json` | Main config (auth, channels, skills) |
| Credentials | `/data/credentials/` | API keys, tokens |
| Identity | `/data/identity/` | Agent identity files |
| Memory | `/data/memory/` | Agent memory and context |
| Settings | `/data/settings/` | User preferences |

## Backup Methods

### Method 1: Config Export (Recommended)

Export configuration via the setup wizard endpoint:

```bash
# From any machine with access to the gateway
curl -o crocbot-config.json https://your-domain.com/setup/export
```

This creates a portable backup that can be imported on any crocbot instance.

### Method 2: Backup Script

Use the included backup script for automated backups:

```bash
# Basic usage
./scripts/backup.sh

# Specify output directory
./scripts/backup.sh --output-dir ~/crocbot-backups

# For Coolify deployments
CROCBOT_GATEWAY_URL=https://your-domain.com ./scripts/backup.sh
```

### Method 3: Docker Volume Backup

For full state backup including all files:

```bash
# Stop the container (recommended but optional)
docker compose stop crocbot

# Create tarball of the volume
docker run --rm \
  -v crocbot-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/crocbot-data-$(date +%Y%m%d).tar.gz -C /data .

# Restart
docker compose start crocbot
```

### Method 4: Coolify Volumes

Coolify automatically manages volumes. To back up:

1. Go to your service in Coolify dashboard
2. Navigate to **Storages** tab
3. Click the volume to view its path on the host
4. Back up the host directory:

```bash
# SSH to your VPS
sudo tar -czf /root/crocbot-backup.tar.gz /var/lib/docker/volumes/crocbot-data/_data
```

## Restore Procedures

### Restore from Config Export

1. Deploy a fresh crocbot instance
2. Visit `https://your-domain.com/setup`
3. Import the config file via the setup wizard

### Restore from Volume Backup

```bash
# Stop the container
docker compose stop crocbot

# Restore the volume
docker run --rm \
  -v crocbot-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar -xzf /backup/crocbot-data-YYYYMMDD.tar.gz -C /data"

# Start the container
docker compose start crocbot
```

## Scheduled Backups

### Using Cron (Local/VPS)

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/crocbot/scripts/backup.sh --output-dir /backups >> /var/log/crocbot-backup.log 2>&1

# Weekly cleanup (keep 7 days)
0 3 * * 0 find /backups -name "crocbot-backup-*.tar.gz" -mtime +7 -delete
```

### Using GitHub Actions

Create `.github/workflows/backup.yml`:

```yaml
name: Scheduled Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Export config
        run: |
          curl -sf -o config.json ${{ secrets.CROCBOT_GATEWAY_URL }}/setup/export

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: crocbot-backup-${{ github.run_number }}
          path: config.json
          retention-days: 30
```

## Backup Verification

Always verify backups are valid:

```bash
# Check config export is valid JSON
jq . crocbot-config.json > /dev/null && echo "Valid JSON"

# Check tarball integrity
tar -tzf crocbot-data-*.tar.gz > /dev/null && echo "Valid archive"
```

## Retention Policy

| Backup Type | Retention | Notes |
|-------------|-----------|-------|
| Config export | 30 days | Small, keep more |
| Full volume | 7 days | Large, rotate frequently |
| Pre-upgrade | Until next upgrade | Keep one before each upgrade |

## Disaster Recovery

1. **Provision new VPS/Coolify instance**
2. **Deploy crocbot** following [Deployment guide](/platforms/deployment)
3. **Restore config** via setup wizard or volume restore
4. **Verify channels** are connected (Telegram, etc.)
5. **Test** by sending a message

## Troubleshooting

### Export endpoint returns 401

The `/setup/export` endpoint may require authentication:
- Set `SETUP_PASSWORD` environment variable
- Include password in request headers

### Volume backup permission denied

Run backup commands with `sudo` or ensure Docker socket access.

### Restore fails with "volume in use"

Stop all containers using the volume before restore:

```bash
docker compose down
# Then restore
docker compose up -d
```
