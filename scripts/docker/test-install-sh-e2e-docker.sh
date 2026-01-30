#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE_NAME="${CROCBOT_INSTALL_E2E_IMAGE:-crocbot-install-e2e:local}"
INSTALL_URL="${CROCBOT_INSTALL_URL:-https://github.com/moshehbenavraham/crocbot/install.sh}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
CROCBOT_E2E_MODELS="${CROCBOT_E2E_MODELS:-}"

echo "==> Build image: $IMAGE_NAME"
docker build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker/install-sh-e2e"

echo "==> Run E2E installer test"
docker run --rm \
  -e CROCBOT_INSTALL_URL="$INSTALL_URL" \
  -e CROCBOT_INSTALL_TAG="${CROCBOT_INSTALL_TAG:-latest}" \
  -e CROCBOT_E2E_MODELS="$CROCBOT_E2E_MODELS" \
  -e CROCBOT_INSTALL_E2E_PREVIOUS="${CROCBOT_INSTALL_E2E_PREVIOUS:-}" \
  -e CROCBOT_INSTALL_E2E_SKIP_PREVIOUS="${CROCBOT_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ANTHROPIC_API_TOKEN="$ANTHROPIC_API_TOKEN" \
  "$IMAGE_NAME"
