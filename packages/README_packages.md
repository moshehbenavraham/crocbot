# packages/

Workspace packages in the pnpm monorepo.

## Contents

- **crocbot/** — The main `crocbot` package workspace entry. Contains its own `package.json` for workspace-level dependency resolution.

## Notes

The root `package.json` is the primary build target. This `packages/` directory supports pnpm workspace features for dependency isolation where needed.
