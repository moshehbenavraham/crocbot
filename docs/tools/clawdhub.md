---
summary: "CrocHub guide: public skills registry + CLI workflows"
read_when:
  - Introducing CrocHub to new users
  - Installing, searching, or publishing skills
  - Explaining CrocHub CLI flags and sync behavior
---

# CrocHub

CrocHub is the **public skill registry for crocbot**. It is a free service: all skills are public, open, and visible to everyone for sharing and reuse. A skill is just a folder with a `SKILL.md` file (plus supporting text files). You can browse skills in the web app or use the CLI to search, install, update, and publish skills.

Site: [crochub.com](https://crochub.com)

## Who this is for (beginner-friendly)

If you want to add new capabilities to your crocbot agent, CrocHub is the easiest way to find and install skills. You do not need to know how the backend works. You can:

- Search for skills by plain language.
- Install a skill into your workspace.
- Update skills later with one command.
- Back up your own skills by publishing them.

## Quick start (non-technical)

1) Install the CLI (see next section).
2) Search for something you need:
   - `crochub search "calendar"`
3) Install a skill:
   - `crochub install <skill-slug>`
4) Start a new crocbot session so it picks up the new skill.

## Install the CLI

Pick one:

```bash
npm i -g crochub
```

```bash
pnpm add -g crochub
```

## How it fits into crocbot

By default, the CLI installs skills into `./skills` under your current working directory. If a crocbot workspace is configured, `crochub` falls back to that workspace unless you override `--workdir` (or `CROCHUB_WORKDIR`). crocbot loads workspace skills from `<workspace>/skills` and will pick them up in the **next** session. If you already use `~/.crocbot/skills` or bundled skills, workspace skills take precedence.

For more detail on how skills are loaded, shared, and gated, see
[Skills](/tools/skills).

## What the service provides (features)

- **Public browsing** of skills and their `SKILL.md` content.
- **Search** powered by embeddings (vector search), not just keywords.
- **Versioning** with semver, changelogs, and tags (including `latest`).
- **Downloads** as a zip per version.
- **Stars and comments** for community feedback.
- **Moderation** hooks for approvals and audits.
- **CLI-friendly API** for automation and scripting.

## CLI commands and parameters

Global options (apply to all commands):

- `--workdir <dir>`: Working directory (default: current dir; falls back to crocbot workspace).
- `--dir <dir>`: Skills directory, relative to workdir (default: `skills`).
- `--site <url>`: Site base URL (browser login).
- `--registry <url>`: Registry API base URL.
- `--no-input`: Disable prompts (non-interactive).
- `-V, --cli-version`: Print CLI version.

Auth:

- `crochub login` (browser flow) or `crochub login --token <token>`
- `crochub logout`
- `crochub whoami`

Options:

- `--token <token>`: Paste an API token.
- `--label <label>`: Label stored for browser login tokens (default: `CLI token`).
- `--no-browser`: Do not open a browser (requires `--token`).

Search:

- `crochub search "query"`
- `--limit <n>`: Max results.

Install:

- `crochub install <slug>`
- `--version <version>`: Install a specific version.
- `--force`: Overwrite if the folder already exists.

Update:

- `crochub update <slug>`
- `crochub update --all`
- `--version <version>`: Update to a specific version (single slug only).
- `--force`: Overwrite when local files do not match any published version.

List:

- `crochub list` (reads `.crochub/lock.json`)

Publish:

- `crochub publish <path>`
- `--slug <slug>`: Skill slug.
- `--name <name>`: Display name.
- `--version <version>`: Semver version.
- `--changelog <text>`: Changelog text (can be empty).
- `--tags <tags>`: Comma-separated tags (default: `latest`).

Delete/undelete (owner/admin only):

- `crochub delete <slug> --yes`
- `crochub undelete <slug> --yes`

Sync (scan local skills + publish new/updated):

- `crochub sync`
- `--root <dir...>`: Extra scan roots.
- `--all`: Upload everything without prompts.
- `--dry-run`: Show what would be uploaded.
- `--bump <type>`: `patch|minor|major` for updates (default: `patch`).
- `--changelog <text>`: Changelog for non-interactive updates.
- `--tags <tags>`: Comma-separated tags (default: `latest`).
- `--concurrency <n>`: Registry checks (default: 4).

## Common workflows for agents

### Search for skills

```bash
crochub search "postgres backups"
```

### Download new skills

```bash
crochub install my-skill-pack
```

### Update installed skills

```bash
crochub update --all
```

### Back up your skills (publish or sync)

For a single skill folder:

```bash
crochub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

To scan and back up many skills at once:

```bash
crochub sync --all
```

## Advanced details (technical)

### Versioning and tags

- Each publish creates a new **semver** `SkillVersion`.
- Tags (like `latest`) point to a version; moving tags lets you roll back.
- Changelogs are attached per version and can be empty when syncing or publishing updates.

### Local changes vs registry versions

Updates compare the local skill contents to registry versions using a content hash. If local files do not match any published version, the CLI asks before overwriting (or requires `--force` in non-interactive runs).

### Sync scanning and fallback roots

`crochub sync` scans your current workdir first. If no skills are found, it falls back to known legacy locations (for example `~/crocbot/skills` and `~/.crocbot/skills`). This is designed to find older skill installs without extra flags.

### Storage and lockfile

- Installed skills are recorded in `.crochub/lock.json` under your workdir.
- Auth tokens are stored in the CrocHub CLI config file (override via `CROCHUB_CONFIG_PATH`).

### Telemetry (install counts)

When you run `crochub sync` while logged in, the CLI sends a minimal snapshot to compute install counts. You can disable this entirely:

```bash
export CROCHUB_DISABLE_TELEMETRY=1
```

## Environment variables

- `CROCHUB_SITE`: Override the site URL.
- `CROCHUB_REGISTRY`: Override the registry API URL.
- `CROCHUB_CONFIG_PATH`: Override where the CLI stores the token/config.
- `CROCHUB_WORKDIR`: Override the default workdir.
- `CROCHUB_DISABLE_TELEMETRY=1`: Disable telemetry on `sync`.
