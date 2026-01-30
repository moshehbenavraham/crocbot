# =============================================================================
# Stage 1: Builder
# Full build environment with all dev dependencies, Bun, and toolchain
# =============================================================================
FROM node:22-bookworm AS builder

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Optional: Install additional apt packages if needed for build
ARG CROCBOT_DOCKER_APT_PACKAGES=""
RUN if [ -n "$CROCBOT_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $CROCBOT_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

# Layer 1: Package manifests and scripts (changes least frequently)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

# Layer 2: Install all dependencies (cached unless package files change)
RUN pnpm install --frozen-lockfile

# Layer 3: Copy source and static assets
COPY src ./src
COPY tsconfig.json ./
COPY ui ./ui
COPY docs ./docs
COPY assets ./assets
COPY skills ./skills

# Layer 4: Build TypeScript and UI
ENV CROCBOT_A2UI_SKIP_MISSING=1
ENV CROCBOT_PREFER_PNPM=1
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

# =============================================================================
# Stage 2: Dependencies Pruner
# Prune dev dependencies from node_modules
# =============================================================================
FROM node:22-bookworm AS pruner

RUN corepack enable

WORKDIR /app

# Copy package files and node_modules from builder
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/patches ./patches
COPY --from=builder /app/node_modules ./node_modules

# Prune dev dependencies and remove large optional packages not needed for gateway
RUN pnpm prune --prod --ignore-scripts && \
    rm -rf node_modules/.pnpm/@node-llama-cpp* \
           node_modules/.pnpm/node-llama-cpp* \
           node_modules/.pnpm/@napi-rs+canvas* \
           node_modules/.pnpm/typescript* \
           node_modules/.pnpm/playwright@* \
           node_modules/.pnpm/*linuxmusl* \
           node_modules/.pnpm/*linux-arm* \
           node_modules/@node-llama-cpp \
           node_modules/node-llama-cpp \
           node_modules/@napi-rs/canvas \
           node_modules/typescript \
           node_modules/playwright

# =============================================================================
# Stage 3: Production Runtime
# Minimal image with only production dependencies and built artifacts
# =============================================================================
FROM node:22-slim AS runtime

# Install curl for health checks (minimal package)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json for runtime
COPY --from=builder /app/package.json ./

# Copy pruned node_modules from pruner stage
COPY --from=pruner /app/node_modules ./node_modules

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy additional required files
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/skills ./skills

# Create directories for runtime
RUN mkdir -p /home/node/.crocbot /home/node/croc && \
    chown -R node:node /home/node /app

# Set production environment
ENV NODE_ENV=production

# Security hardening: Run as non-root user
USER node

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/index.js"]
