#!/usr/bin/env bash
# ci-local.sh -- Local CI pipeline fallback
# Replicates the GitHub Actions CI matrix checks locally.
# Use when GitHub Actions is unavailable (billing, outage, etc.)
#
# Usage: bash scripts/ci-local.sh [--skip-e2e]
set -euo pipefail

SKIP_E2E=false
for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=true ;;
    -h|--help)
      echo "Usage: bash scripts/ci-local.sh [--skip-e2e]"
      echo "  --skip-e2e  Skip E2E tests (faster)"
      exit 0
      ;;
  esac
done

PASS=0
FAIL=0
SKIP=0

run_check() {
  local name="$1"
  shift
  printf "\n=== %s ===\n" "$name"
  if "$@"; then
    printf "  PASS: %s\n" "$name"
    PASS=$((PASS + 1))
  else
    printf "  FAIL: %s\n" "$name" >&2
    FAIL=$((FAIL + 1))
  fi
}

skip_check() {
  local name="$1"
  printf "\n=== %s (skipped) ===\n" "$name"
  SKIP=$((SKIP + 1))
}

echo "=============================="
echo " crocbot local CI pipeline"
echo "=============================="
echo ""
echo "Date: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "pnpm: $(pnpm -v 2>/dev/null || echo 'not found')"
echo ""

# -- Code Quality --
run_check "Lint (oxlint)" pnpm lint
run_check "Format (oxfmt)" pnpm format
run_check "Typecheck (tsc)" pnpm build

# -- Build & Test --
run_check "Unit tests (node)" pnpm test

# -- E2E Tests --
if [ "$SKIP_E2E" = "true" ]; then
  skip_check "E2E tests"
else
  run_check "E2E tests" pnpm test:e2e
fi

# -- Security --
run_check "npm audit (high)" pnpm audit --audit-level=high || true

# -- Protocol Check --
run_check "Protocol schema" pnpm protocol:check

echo ""
echo "=============================="
echo " Results"
echo "=============================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
echo "=============================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "CI FAILED -- $FAIL check(s) did not pass." >&2
  exit 1
fi

echo ""
echo "CI PASSED -- all checks green."
exit 0
