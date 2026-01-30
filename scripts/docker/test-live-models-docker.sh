#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE_NAME="${CROCBOT_IMAGE:-crocbot:local}"
CONFIG_DIR="${CROCBOT_CONFIG_DIR:-$HOME/.crocbot}"
WORKSPACE_DIR="${CROCBOT_WORKSPACE_DIR:-$HOME/croc}"
PROFILE_FILE="${CROCBOT_PROFILE_FILE:-$HOME/.profile}"

PROFILE_MOUNT=()
if [[ -f "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
fi

echo "==> Build image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Run live model tests (profile keys)"
docker run --rm -t \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e CROCBOT_LIVE_TEST=1 \
  -e CROCBOT_LIVE_MODELS="${CROCBOT_LIVE_MODELS:-all}" \
  -e CROCBOT_LIVE_PROVIDERS="${CROCBOT_LIVE_PROVIDERS:-}" \
  -e CROCBOT_LIVE_MODEL_TIMEOUT_MS="${CROCBOT_LIVE_MODEL_TIMEOUT_MS:-}" \
  -e CROCBOT_LIVE_REQUIRE_PROFILE_KEYS="${CROCBOT_LIVE_REQUIRE_PROFILE_KEYS:-}" \
  -v "$CONFIG_DIR":/home/node/.crocbot \
  -v "$WORKSPACE_DIR":/home/node/croc \
  "${PROFILE_MOUNT[@]}" \
  "$IMAGE_NAME" \
  -lc "set -euo pipefail; [ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" || true; cd /app && pnpm test:live"
