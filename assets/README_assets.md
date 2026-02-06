# assets/

Static assets bundled with the crocbot package.

## Contents

- **avatar-crocbot.png** — Bot avatar image used in Telegram and docs
- **chrome-extension/** — Chrome extension resources (icons, manifest helpers)

## Usage

Assets in this directory are included in the npm package via the `"files"` field in `package.json`. Reference them at build time or runtime using path resolution from the package root.
