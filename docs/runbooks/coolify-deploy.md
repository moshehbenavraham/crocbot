# Coolify Auto-Deploy Setup

How to configure Coolify webhook auto-deploy so new Docker images trigger automatic redeployment.

## Prerequisites

- Coolify instance with crocbot application configured
- GitHub repository with `docker-release.yml` workflow
- Repository admin access (for adding variables)

---

## Step 1: Get Webhook URL from Coolify

1. Open your Coolify dashboard
2. Navigate to your crocbot application
3. Go to **Settings** > **Webhooks**
4. Copy the **Deploy Webhook URL**
   - Format: `https://your-coolify-instance.com/api/v1/deploy?uuid=APP_UUID&force=false`

---

## Step 2: Add Webhook URL to GitHub

1. Go to your GitHub repository **Settings**
2. Navigate to **Secrets and variables** > **Actions** > **Variables** tab
3. Click **New repository variable**
4. Set:
   - **Name**: `COOLIFY_WEBHOOK_URL`
   - **Value**: The webhook URL from Step 1

> Using a repository **variable** (not secret) because the Coolify deploy webhook URL contains a UUID that acts as the authentication token. The URL itself is the credential. If your Coolify instance requires a separate Bearer token, store that as a **secret** named `COOLIFY_WEBHOOK_TOKEN` and update the workflow accordingly.

---

## Step 3: Verify

After the next push to `main`:

1. Check the **Docker Release** workflow in GitHub Actions
2. The `deploy` job should appear after `create-manifest`
3. Verify it reports: `Coolify deploy triggered successfully (HTTP 2xx)`
4. Confirm in Coolify dashboard that a new deployment was triggered

---

## How It Works

The `deploy` job in `.github/workflows/docker-release.yml`:

1. Runs **only** on pushes to `main` (not tags)
2. Runs **only** if `COOLIFY_WEBHOOK_URL` variable is set
3. Sends a GET request to the Coolify webhook
4. Reports success (2xx) or warns on failure (non-2xx)
5. Does **not** block the workflow on webhook failure (warning only)

---

## Skipping Auto-Deploy

To temporarily disable auto-deploy without removing the webhook:

- Delete or empty the `COOLIFY_WEBHOOK_URL` repository variable
- The `deploy` job will be skipped (the `if` condition checks for non-empty value)

---

## Troubleshooting

### Deploy job skipped
- Verify `COOLIFY_WEBHOOK_URL` is set as a repository **variable** (not secret)
- Verify the push was to `main` branch (tags skip the deploy job)

### Webhook returns non-2xx
- Verify the Coolify instance is reachable from GitHub Actions runners
- Check that the UUID in the webhook URL is still valid
- Review Coolify application logs for errors

### Coolify deploys but container unhealthy
- Check the `/health` endpoint: `curl -f https://your-domain.com/health`
- Review container logs in Coolify dashboard
- See [Health Checks](/runbooks/health-checks) runbook

---

## Related Documentation

- [Docker Operations](/runbooks/docker-operations) - Container management
- [Health Checks](/runbooks/health-checks) - Health monitoring
- [Backup and Restore](/runbooks/backup-restore) - Data protection
