#!/usr/bin/env bash
set -euo pipefail

cd /repo

export CROCBOT_STATE_DIR="/tmp/crocbot-test"
export CROCBOT_CONFIG_PATH="${CROCBOT_STATE_DIR}/crocbot.json"

echo "==> Seed state"
mkdir -p "${CROCBOT_STATE_DIR}/credentials"
mkdir -p "${CROCBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${CROCBOT_CONFIG_PATH}"
echo 'creds' >"${CROCBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${CROCBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm crocbot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${CROCBOT_CONFIG_PATH}"
test ! -d "${CROCBOT_STATE_DIR}/credentials"
test ! -d "${CROCBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${CROCBOT_STATE_DIR}/credentials"
echo '{}' >"${CROCBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm crocbot uninstall --state --yes --non-interactive

test ! -d "${CROCBOT_STATE_DIR}"

echo "OK"
