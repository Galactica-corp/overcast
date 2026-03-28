# Bridge-TX-MCP Server Dockerfile
FROM node:24-alpine AS builder

RUN corepack enable yarn && corepack prepare yarn@4.13.0 --activate

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml tsconfig.json ./
COPY .yarn/ .yarn/

# Copy all workspace package.json files before install
# This allows Yarn to properly resolve the workspace structure
COPY packages/bridge-tx-mcp/package.json ./packages/bridge-tx-mcp/
COPY packages/private-stablecoin/package.json ./packages/private-stablecoin/
COPY packages/stablecoin-wrapper/package.json ./packages/stablecoin-wrapper/

# Install dependencies without running scripts (some packages need source code for postinstall)
RUN yarn install --mode=skip-build

COPY scripts/ ./scripts/
COPY packages/ ./packages/

# Build only the specific workspace we need
RUN yarn workspace @galactica-net/overcast-bridge-tx-mcp build

# Stage 2: Production runtime stage
FROM node:24-alpine AS runner

RUN corepack enable yarn && corepack prepare yarn@4.13.0 --activate

WORKDIR /app

# Create non-root user for security
RUN addgroup -S -g 1001 nodejs && \
  adduser -S -G nodejs -u 1001 nodejs

# Copy Yarn configuration and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/.yarn ./.yarn
COPY --from=builder --chown=nodejs:nodejs /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder --chown=nodejs:nodejs /app/yarn.lock ./yarn.lock
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy workspace package.json files
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/package.json ./packages/bridge-tx-mcp/package.json

# Copy node_modules if using node-modules linker, or .pnp files if using PnP
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy the built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/dist ./packages/bridge-tx-mcp/dist

# Set up environment variables
ENV NODE_ENV=production \
  NODE_NO_WARNINGS=1

# Switch to non-root user
USER nodejs

ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=4000
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('OK')"

# Run the MCP server
# By default uses stdio transport (for IDE integration)
# To use HTTP transport, set MCP_TRANSPORT=http and ensure server is accessible on port
CMD ["node", "./packages/bridge-tx-mcp/dist/index.js"]
