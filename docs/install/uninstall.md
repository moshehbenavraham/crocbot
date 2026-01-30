---
summary: "Uninstall crocbot completely (CLI, service, state, workspace)"
read_when:
  - You want to remove crocbot from a machine
  - The gateway service is still running after uninstall
---

# Uninstall

Two paths:
- **Easy path** if `crocbot` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
crocbot uninstall
```

Non-interactive (automation / npx):

```bash
crocbot uninstall --all --yes --non-interactive
npx -y crocbot uninstall --all --yes --non-interactive
```

Manual steps (same result):

1) Stop the gateway service:

```bash
crocbot gateway stop
```

2) Uninstall the gateway service (launchd/systemd/schtasks):

```bash
crocbot gateway uninstall
```

3) Delete state + config:

```bash
rm -rf "${CROCBOT_STATE_DIR:-$HOME/.crocbot}"
```

If you set `CROCBOT_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4) Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/croc
```

5) Remove the CLI install (pick the one you used):

```bash
npm rm -g crocbot
pnpm remove -g crocbot
bun remove -g crocbot
```

6) If you installed the macOS app:

```bash
rm -rf /Applications/crocbot.app
```

Notes:
- If you used profiles (`--profile` / `CROCBOT_PROFILE`), repeat step 3 for each state dir (defaults are `~/.crocbot-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `crocbot` is missing.

### macOS (launchd)

Default label is `com.crocbot.gateway` (or `com.crocbot.<profile>`):

```bash
launchctl bootout gui/$UID/com.crocbot.gateway
rm -f ~/Library/LaunchAgents/com.crocbot.gateway.plist
```

If you used a profile, replace the label and plist name with `com.crocbot.<profile>`.

### Linux (systemd user unit)

Default unit name is `crocbot-gateway.service` (or `crocbot-gateway-<profile>.service`):

```bash
systemctl --user disable --now crocbot-gateway.service
rm -f ~/.config/systemd/user/crocbot-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `crocbot Gateway` (or `crocbot Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "crocbot Gateway"
Remove-Item -Force "$env:USERPROFILE\.crocbot\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.crocbot-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://github.com/moshehbenavraham/crocbot/install.sh` or `install.ps1`, the CLI was installed with `npm install -g crocbot@latest`.
Remove it with `npm rm -g crocbot` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `crocbot ...` / `bun run crocbot ...`):

1) Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2) Delete the repo directory.
3) Remove state + workspace as shown above.
