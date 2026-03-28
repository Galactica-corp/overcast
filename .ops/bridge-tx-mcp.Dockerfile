# Bridge-TX-MCP Server Dockerfile
#
# Aztec's native bb binary is glibc-linked, so Alpine's musl base image causes
# runtime ENOENT failures when the deposit tool tries to spawn it.
FROM node:24-bookworm-slim AS base

RUN corepack enable yarn && corepack prepare yarn@4.13.0 --activate

WORKDIR /app

FROM base AS deps

COPY package.json yarn.lock .yarnrc.yml tsconfig.json ./
COPY .yarn/ .yarn/
COPY packages/private-stablecoin/package.json ./packages/private-stablecoin/package.json
COPY packages/stablecoin-wrapper/package.json ./packages/stablecoin-wrapper/package.json
COPY packages/bridge-tx-mcp/package.json ./packages/bridge-tx-mcp/package.json

RUN yarn workspaces focus @galactica-net/overcast-bridge-tx-mcp

FROM deps AS builder

COPY packages/bridge-tx-mcp/ ./packages/bridge-tx-mcp/

# Build only the specific workspace we need
RUN yarn workspace @galactica-net/overcast-bridge-tx-mcp build

FROM node:24-bookworm-slim AS runner

RUN corepack enable yarn && corepack prepare yarn@4.13.0 --activate

WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
  useradd --system --uid 1001 --gid nodejs --create-home nodejs

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/package.json ./packages/bridge-tx-mcp/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/dist ./packages/bridge-tx-mcp/dist

ENV NODE_ENV=production \
  NODE_NO_WARNINGS=1 \
  MCP_HOST=0.0.0.0 \
  MCP_PORT=4000

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('OK')"

CMD ["node", "./packages/bridge-tx-mcp/dist/index.js"]
