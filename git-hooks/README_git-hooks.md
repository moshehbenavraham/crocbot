# git-hooks/

Git hook scripts installed into the local repository.

## Contents

- **pre-commit** — Runs format and lint checks on staged files before allowing a commit

## Setup

Hooks are installed automatically via `scripts/setup-git-hooks.js` (triggered by `postinstall`). They symlink from `.git/hooks/` to this directory so hooks are version-controlled and shared across the team.
