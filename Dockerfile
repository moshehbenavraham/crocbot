# =============================================================================
# Stage 1: Builder
# Full build environment with all dev dependencies, Bun, and toolchain
# =============================================================================
FROM node:22-bookworm AS builder

# Install Bun (required for build scripts) — pinned version
ARG BUN_VERSION=1.2.2
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
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
COPY patches ./patches
COPY scripts ./scripts

# Layer 2: Install all dependencies (cached unless package files change)
RUN pnpm install --frozen-lockfile

# Layer 3: Copy source and static assets
COPY src ./src
COPY tsconfig.json tsdown.config.ts ./
COPY docs ./docs
COPY assets ./assets
COPY skills ./skills
COPY extensions ./extensions

# Layer 4: Build TypeScript and UI
ENV CROCBOT_A2UI_SKIP_MISSING=1
ENV CROCBOT_PREFER_PNPM=1
RUN pnpm build

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

# Runtime tooling
# Included: curl, ca-certificates, git, jq, openssh-client, gh (GitHub CLI), gog (Google Workspace CLI)
# NOT included (too large / optional):
#   - claude-code (~npm global, install separately if needed)
#   - chromium / playwright (~300 MB, mount or sidecar if needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      git \
      jq \
      openssh-client && \
    # GitHub CLI (gh)
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh && \
    # gog (Google Workspace CLI) — pinned version, arch-aware download
    GOG_VER=v0.9.0 && \
    GOG_ARCH=$(dpkg --print-architecture) && \
    curl -fsSL "https://github.com/steipete/gogcli/releases/download/${GOG_VER}/gogcli_${GOG_VER#v}_linux_${GOG_ARCH}.tar.gz" \
      -o /tmp/gog.tar.gz && \
    tar xz -C /usr/local/bin gog -f /tmp/gog.tar.gz && \
    rm /tmp/gog.tar.gz && \
    chmod +x /usr/local/bin/gog && \
    # Cleanup
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
COPY --from=builder /app/extensions ./extensions

# Create directories for runtime
# UID/GID default to 1000 (node) but can be overridden at build time
# to match the user: directive in docker-compose.yml
ARG APP_UID=1000
ARG APP_GID=1000
RUN if [ "${APP_UID}" != "1000" ]; then \
      groupmod -g ${APP_GID} node && \
      usermod -u ${APP_UID} -g ${APP_GID} node; \
    fi && \
    mkdir -p /home/node/.crocbot /home/node/croc && \
    chown -R ${APP_UID}:${APP_GID} /home/node /app

# Set production environment
ENV NODE_ENV=production

# Security hardening: Run as non-root user
USER node

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/index.js"]
