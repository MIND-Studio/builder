# syntax=docker/dockerfile:1.7
#
# Production image for mind-builder. Two stages:
#   builder — installs deps (incl. C toolchain for better-sqlite3) and runs
#             `next build` to emit .next/standalone.
#   runtime — minimal Debian-slim running the standalone server as non-root.
#
# bookworm-slim (glibc), not Alpine, because better-sqlite3's prebuilt binary
# wants glibc. Mirrors the mind-codespaces bridge image.

# --- Stage 1: build --------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# `.npmrc` points the @mind-studio scope at GitHub Packages and reads the auth
# token from $NODE_AUTH_TOKEN, passed as a BuildKit secret (never layer-baked).
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=node_auth_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth_token 2>/dev/null || true)" \
    npm ci --no-audit --no-fund

# Guarantee Next's native swc binary. `npm ci` intermittently omits a
# platform-optional native dep even when it's correctly in the lockfile
# (npm/cli #4828) — and Next 16's Turbopack has NO WASM fallback, so a missing
# binary aborts the build ("Turbopack is not supported on this platform"). We
# force-install the binary matching the build platform's arch + the resolved
# next version (process.arch is "x64"/"arm64", matching the package names) so the
# build never depends on npm-ci luck. It's a public package (no GHCR auth), and
# `--no-save` leaves package.json/lock untouched.
RUN npm install --no-save "@next/swc-linux-$(node -p process.arch)-gnu@$(node -p "require('next/package.json').version")"

COPY . .
RUN mkdir -p public

# NEXT_PUBLIC_* are inlined at build time. builder additionally needs the
# bridge URL — it orchestrates the codespaces bridge through its own API routes.
ARG NEXT_PUBLIC_OIDC_ISSUER
ARG NEXT_PUBLIC_SOLID_ISSUER
ARG NEXT_PUBLIC_POD_BASE_URL
ARG NEXT_PUBLIC_CODESPACES_BRIDGE_URL
ENV NEXT_PUBLIC_OIDC_ISSUER=$NEXT_PUBLIC_OIDC_ISSUER \
    NEXT_PUBLIC_SOLID_ISSUER=$NEXT_PUBLIC_SOLID_ISSUER \
    NEXT_PUBLIC_POD_BASE_URL=$NEXT_PUBLIC_POD_BASE_URL \
    NEXT_PUBLIC_CODESPACES_BRIDGE_URL=$NEXT_PUBLIC_CODESPACES_BRIDGE_URL

# The app launcher (shared @mind-studio/core) links to the sibling Mind apps;
# their public URLs are inlined here too.
ARG NEXT_PUBLIC_APP_DOCK_URL
ARG NEXT_PUBLIC_APP_DRIVE_URL
ARG NEXT_PUBLIC_APP_BUILDER_URL
ARG NEXT_PUBLIC_APP_CODESPACES_URL
ENV NEXT_PUBLIC_APP_DOCK_URL=$NEXT_PUBLIC_APP_DOCK_URL \
    NEXT_PUBLIC_APP_DRIVE_URL=$NEXT_PUBLIC_APP_DRIVE_URL \
    NEXT_PUBLIC_APP_BUILDER_URL=$NEXT_PUBLIC_APP_BUILDER_URL \
    NEXT_PUBLIC_APP_CODESPACES_URL=$NEXT_PUBLIC_APP_CODESPACES_URL

# App-owned feedback inbox (public-append container). Inlined at build time.
ARG NEXT_PUBLIC_FEEDBACK_INBOX
ENV NEXT_PUBLIC_FEEDBACK_INBOX=$NEXT_PUBLIC_FEEDBACK_INBOX

RUN npm run build

# --- Stage 2: runtime ------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# WORKDIR /app is root-owned but the server runs as USER node, so the relative
# default `./.builder-data` (= /app/.builder-data) can't be created (EACCES).
# Pre-create the non-authoritative sqlite cache dir, owned by node (must happen
# as root, before the USER switch — node can't write to root-owned /app).
RUN mkdir -p /app/.builder-data && chown node:node /app/.builder-data

USER node

COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    INDEXER_DATA_DIR=/app/.builder-data

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
