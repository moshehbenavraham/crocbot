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

# Layer 1b: Copy extension package manifests so pnpm workspace resolves them
COPY extensions/ /tmp/extensions/
RUN find /tmp/extensions -maxdepth 2 -name 'package.json' | while read f; do \
      dir="extensions/$(basename $(dirname $f))"; \
      mkdir -p "$dir" && cp "$f" "$dir/"; \
    done && rm -rf /tmp/extensions

# Layer 2: Install all dependencies (cached unless package files change)
RUN pnpm install --frozen-lockfile

# Layer 3: Copy source and static assets
COPY src ./src
COPY tsconfig.json tsdown.config.ts ./
COPY docs ./docs
COPY assets ./assets
COPY skills ./skills
COPY extensions ./extensions

# Layer 3b: Flatten extension node_modules so they are fully self-contained
# and survive the pruner stage (which strips the pnpm store).
# For each symlinked dep, resolve its pnpm virtual-store node_modules dir
# (the parent containing all transitive deps as siblings) and copy them in.
# Uses sed to extract the virtual-store node_modules path, which handles
# both scoped (@scope/pkg) and non-scoped packages correctly.
RUN for ext in extensions/*/node_modules; do \
      [ -d "$ext" ] || continue; \
      rm -f "$ext/crocbot"; \
      for pkg in "$ext"/*/ "$ext"/@*/*/; do \
        [ -L "${pkg%/}" ] || continue; \
        target=$(readlink -f "${pkg%/}"); \
        store_nm=$(echo "$target" | sed 's|\(.*node_modules\)/.*|\1|'); \
        [ -d "$store_nm" ] || continue; \
        for sibling in "$store_nm"/*/; do \
          [ -d "$sibling" ] || continue; \
          name=$(basename "$sibling"); \
          [ "$name" = ".bin" ] && continue; \
          [ -e "$ext/$name" ] && continue; \
          cp -rL "$sibling" "$ext/$name" 2>/dev/null || true; \
        done; \
        for scope in "$store_nm"/@*/; do \
          [ -d "$scope" ] || continue; \
          scopename=$(basename "$scope"); \
          for scopepkg in "$scope"/*/; do \
            [ -d "$scopepkg" ] || continue; \
            pkgname=$(basename "$scopepkg"); \
            [ -e "$ext/$scopename/$pkgname" ] && continue; \
            mkdir -p "$ext/$scopename"; \
            cp -rL "$scopepkg" "$ext/$scopename/$pkgname" 2>/dev/null || true; \
          done; \
        done; \
      done; \
      cp -rL "$ext" "$ext.real" && rm -rf "$ext" && mv "$ext.real" "$ext"; \
      find "$ext" -mindepth 2 -name node_modules -type d -exec sh -c \
        'ls -A1 "$1" | grep -qvx ".bin" && exit 1; rm -rf "$1"' _ {} \; ; \
    done 2>/dev/null; true

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
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      git \
      gosu \
      jq \
      openssh-client \
      ripgrep && \
    # GitHub CLI (gh)
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh && \
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
COPY --from=builder --chown=node:node /app/package.json ./

# Copy pruned node_modules from pruner stage
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules

# Copy built artifacts from builder
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy additional required files
COPY --from=builder --chown=node:node /app/docs ./docs
COPY --from=builder --chown=node:node /app/assets ./assets
COPY --from=builder --chown=node:node /app/skills ./skills
COPY --from=builder --chown=node:node /app/extensions ./extensions

# Create directories for runtime (no recursive chown needed — COPY --chown handles /app)
RUN mkdir -p /home/node/.crocbot /home/node/croc && \
    chown -R node:node /home/node

# Entrypoint: adjusts node user UID/GID at runtime via PUID/PGID env vars,
# then drops privileges with gosu. No special build args needed.
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set production environment
ENV NODE_ENV=production

ENTRYPOINT ["docker-entrypoint.sh"]

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/index.js"]
