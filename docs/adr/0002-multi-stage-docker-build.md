# 2. Multi-Stage Docker Build

**Status:** Superseded
**Date:** 2026-01-30

> **Superseded**: The multi-stage Dockerfile was replaced by a simple runtime-only
> Dockerfile that copies pre-built `dist/` and `node_modules/` into `node:22-slim`.
> Building happens locally via `pnpm build` before `docker build`.

## Context

The initial Docker image was 2.61GB, primarily due to:
- Full node:22-bookworm base image
- Bun included in final image
- Dev dependencies in production build
- Optional heavy dependencies (node-llama-cpp)

## Decision

Implement a 3-stage Docker build:

1. **Builder stage**: Full build environment with Bun, pnpm, TypeScript
2. **Pruner stage**: Run pnpm prune --prod to remove dev dependencies
3. **Runtime stage**: Minimal node:22-slim base with only production deps

Key optimizations:
- Remove node-llama-cpp optional dependency (700MB+)
- Use node:22-slim instead of node:22-bookworm

## Consequences

### Results
- Image size reduced from 2.61GB to 688MB (73% reduction)
- Startup time remains under 10 seconds
- Graceful shutdown in ~660ms

### Trade-offs
- Image still larger than 300MB target due to irreducible core dependencies (playwright-core, pdfjs-dist, AI SDK clients)
- Would require removing core functionality or using Alpine (with native dependency issues) to further reduce
