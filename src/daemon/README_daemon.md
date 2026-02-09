# src/daemon/

System service integration — installs and manages crocbot as a background daemon.

## Key Files

| File               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `constants.ts`     | Service labels and identifiers             |
| `launchd.ts`       | macOS launchd service management           |
| `schtasks.ts`      | Windows Task Scheduler integration         |
| `paths.ts`         | System path resolution for service files   |
| `service-audit.ts` | Validates service health and configuration |

## Supported Platforms

- **Linux** — systemd user service (`systemctl --user`)
- **macOS** — launchd plist (`~/Library/LaunchAgents/`)
- **Windows** — Task Scheduler (via WSL2 recommended)

## Usage

```bash
crocbot onboard --install-daemon   # Install and enable the daemon
systemctl --user status crocbot-gateway   # Check status (Linux)
systemctl --user restart crocbot-gateway  # Restart (Linux)
```

## Related

- Daemon CLI: `src/cli/daemon-cli/`
- Onboarding wizard: `src/wizard/`
