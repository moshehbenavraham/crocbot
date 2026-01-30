---
title: Fly.io Backups
description: Backup and restore your crocbot data on Fly.io using volume snapshots
---

# Fly.io Backups

**Goal:** Protect your crocbot configuration, sessions, and credentials with automated volume snapshots on Fly.io.

## Overview

crocbot stores persistent state on a Fly.io volume mounted at `/data`. This includes:

| Data | Path | Critical |
|------|------|----------|
| Configuration | `/data/crocbot.json` | Yes |
| Credentials | `/data/credentials/` | Yes |
| Sessions | `/data/agents/*/sessions/` | Medium |
| Memory | `/data/agents/*/memory/` | Medium |
| Logs | `/data/logs/` | Low |

Fly.io provides **automatic daily snapshots** retained for 5 days. You can also create manual snapshots before risky operations.

## Automatic Snapshots

Fly.io automatically snapshots volumes daily. To verify:

```bash
# List snapshots for your volume
fly volumes snapshots list vol_<your-volume-id> -a my-crocbot

# Or list all volumes first to get the ID
fly volumes list -a my-crocbot
```

Output shows snapshot history:

```
ID                                     CREATED AT
vs_<snapshot-id-1>                     2026-01-29T00:00:00Z
vs_<snapshot-id-2>                     2026-01-28T00:00:00Z
vs_<snapshot-id-3>                     2026-01-27T00:00:00Z
```

**Note:** Snapshots are retained for 5 days by default. For longer retention, create manual snapshots or export data.

## Manual Snapshots

Create a snapshot before deployments, configuration changes, or any risky operation:

```bash
# Get volume ID
fly volumes list -a my-crocbot

# Create snapshot
fly volumes snapshots create vol_<volume-id> -a my-crocbot
```

**Best practice:** Create a snapshot before:
- Deploying new versions (`fly deploy`)
- Editing configuration via SSH
- Testing new agent configurations
- Running data migrations

## Restore from Snapshot

If something goes wrong, restore from a snapshot:

### Option 1: Create new volume from snapshot (recommended)

This approach creates a fresh volume from the snapshot, then updates the machine to use it.

```bash
# 1. List available snapshots
fly volumes snapshots list vol_<volume-id> -a my-crocbot

# 2. Create new volume from snapshot
fly volumes create crocbot_data_restored \
  --snapshot-id vs_<snapshot-id> \
  --region iad \
  --size 1 \
  -a my-crocbot

# 3. Stop the machine
fly machines list -a my-crocbot
fly machines stop <machine-id> -a my-crocbot

# 4. Detach old volume and attach new one
# (Currently requires destroying and recreating the machine)
fly machines destroy <machine-id> -a my-crocbot --force

# 5. Create new machine with restored volume
fly machines create \
  --app my-crocbot \
  --volume crocbot_data_restored:/data \
  --vm-size shared-cpu-2x \
  --vm-memory 2048 \
  --env NODE_ENV=production \
  --env CLAWDBOT_STATE_DIR=/data \
  --env CLAWDBOT_PREFER_PNPM=1 \
  --entrypoint "node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan"
```

### Option 2: SSH in and verify first

Before restoring, you can SSH in to assess the damage:

```bash
fly ssh console -a my-crocbot

# Check config
cat /data/crocbot.json

# Check credentials
ls -la /data/credentials/

# Check session data
ls -la /data/agents/
```

## Export Data (Manual Backup)

For off-platform backups, export critical files:

```bash
# Create local backup directory
mkdir -p ~/crocbot-backup

# Download config
fly ssh console -a my-crocbot -C "cat /data/crocbot.json" > ~/crocbot-backup/crocbot.json

# Download credentials (if not using env vars)
fly sftp shell -a my-crocbot
> get /data/credentials/* ~/crocbot-backup/credentials/
> exit

# Or create tarball on server and download
fly ssh console -a my-crocbot -C "tar czf /tmp/backup.tar.gz -C /data crocbot.json credentials agents"
fly sftp shell -a my-crocbot
> get /tmp/backup.tar.gz ~/crocbot-backup/
> exit
```

**Security note:** Backup files contain sensitive credentials. Store securely and delete after use.

## Import Data (Manual Restore)

To restore from a manual backup:

```bash
# Upload tarball
fly sftp shell -a my-crocbot
> put ~/crocbot-backup/backup.tar.gz /tmp/
> exit

# Extract on server
fly ssh console -a my-crocbot
cd /data
tar xzf /tmp/backup.tar.gz
rm /tmp/backup.tar.gz
exit

# Restart to apply
fly machines restart <machine-id> -a my-crocbot
```

Or upload individual files:

```bash
# Upload config
cat ~/crocbot-backup/crocbot.json | fly ssh console -a my-crocbot -C "tee /data/crocbot.json"

# Restart
fly machines restart <machine-id> -a my-crocbot
```

## Disaster Recovery Checklist

If your Fly.io deployment is lost:

1. **Check for snapshots**: `fly volumes snapshots list vol_<id> -a my-crocbot`
2. **Recreate app** (if needed): `fly apps create my-crocbot`
3. **Create volume from snapshot**: See [Restore from Snapshot](#restore-from-snapshot)
4. **Set secrets again**: API keys and tokens (not stored in snapshots)
   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ant-... -a my-crocbot
   fly secrets set TELEGRAM_BOT_TOKEN=... -a my-crocbot
   fly secrets set CLAWDBOT_GATEWAY_TOKEN=$(openssl rand -hex 32) -a my-crocbot
   ```
5. **Deploy**: `fly deploy -a my-crocbot`

**Note:** Fly secrets are stored separately from volumes. You must re-set secrets after recreating an app.

## Backup Schedule Recommendations

| Scenario | Backup Strategy |
|----------|-----------------|
| Production | Rely on auto snapshots + manual before deploys |
| Development | Manual snapshots before experiments |
| Critical data | Weekly off-platform export |
| Pre-migration | Manual snapshot + off-platform export |

## Monitoring Backup Health

Periodically verify your backups:

```bash
# Check snapshot exists
fly volumes snapshots list vol_<id> -a my-crocbot

# Verify snapshot age (should be < 24h for daily)
# Look at CREATED AT column

# Test restore to verify backup integrity (optional)
# Create test volume from snapshot, inspect contents
fly volumes create test_restore --snapshot-id vs_<id> --size 1 -a my-crocbot
# ... inspect, then clean up
fly volumes destroy vol_<test-vol-id> -a my-crocbot
```

## Troubleshooting

### No snapshots available

Snapshots require the volume to have been attached to a running machine for at least 24 hours.

**Fix:** Wait 24 hours, or create a manual snapshot immediately after volume creation.

### Snapshot restore fails

The snapshot region must match the target volume region.

**Fix:** Specify the same region when creating the restored volume:
```bash
fly volumes create crocbot_data_restored --snapshot-id vs_<id> --region iad -a my-crocbot
```

### Volume full

If the volume fills up, snapshots may fail.

**Fix:** Increase volume size or clean up old data:
```bash
# Check usage
fly ssh console -a my-crocbot -C "df -h /data"

# Clean old sessions (careful!)
fly ssh console -a my-crocbot -C "find /data/agents -name '*.jsonl' -mtime +30 -delete"

# Or extend volume
fly volumes extend vol_<id> --size 2 -a my-crocbot
```

## See Also

- [Fly.io Deployment](/platforms/fly) - Initial setup guide
- [Gateway Configuration](/gateway/configuration) - Config file reference
- [Fly.io Volume Snapshots](https://fly.io/docs/volumes/snapshots/) - Official docs
