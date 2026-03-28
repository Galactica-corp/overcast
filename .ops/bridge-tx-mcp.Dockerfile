# Bridge-TX-MCP Server Dockerfile
FROM node:24-alpine AS builder

RUN corepack enable yarn && corepack prepare yarn@4.13.0 --activate

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ .yarn/
RUN yarn install --immutable

COPY scripts/ ./scripts/
COPY packages/ ./packages/

# Build the specific workspace
RUN yarn workspace @galactica-net/overcast-bridge-tx-mcp build

# Stage 2: Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 --gid nodejs nodejs

# Copy Yarn cache from builder
COPY --from=builder --chown=nodejs:nodejs /app/.yarn/cache /app/.yarn/cache
COPY --from=builder --chown=nodejs:nodejs /app/.yarn/releases /app/.yarn/releases
COPY --from=builder --chown=nodejs:nodejs /app/.yarn/state /app/.yarn/state

# Copy package.json for metadata
COPY --from=builder --chown=nodejs:nodejs package.json ./

# Copy the built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/dist ./packages/bridge-tx-mcp/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/bridge-tx-mcp/src ./packages/bridge-tx-mcp/src

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
