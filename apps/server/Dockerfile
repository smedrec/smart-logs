# Production-optimized Dockerfile for SMEDREC Audit Server
# Multi-stage build with security best practices

# Stage 1: Base image with Node.js and security updates
FROM node:22-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs auditserver

WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps

# Copy workspace configuration files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY turbo.json ./

# Copy package.json files for workspace dependency resolution
COPY apps/server/package.json ./apps/server/
COPY packages/audit/package.json ./packages/audit/
COPY packages/audit-db/package.json ./packages/audit-db/
COPY packages/audit-sdk/package.json ./packages/audit-sdk/
COPY packages/audit-client/package.json ./packages/audit-client/
COPY packages/auth/package.json ./packages/auth/
COPY packages/hono-helpers/package.json ./packages/hono-helpers/
COPY packages/redis-client/package.json ./packages/redis-client/
COPY packages/send-mail/package.json ./packages/send-mail/
COPY packages/logs/package.json ./packages/logs/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install all dependencies with cache mount for faster builds
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --strict-peer

# Stage 3: Build application
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app /app

# Copy source code for server and its workspace dependencies
COPY apps/server ./apps/server
COPY packages/audit ./packages/audit
COPY packages/audit-db ./packages/audit-db
COPY packages/audit-sdk ./packages/audit-sdk
COPY packages/audit-client ./packages/audit-client
COPY packages/auth ./packages/auth
COPY packages/hono-helpers ./packages/hono-helpers
COPY packages/redis-client ./packages/redis-client
COPY packages/send-mail ./packages/send-mail
COPY packages/logs ./packages/logs
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

# Build the server application and its dependencies
RUN pnpm --filter "server...^" build

# Stage 4: Production runtime
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Security: Use non-root user
USER auditserver

# Copy built application and production dependencies
COPY --from=builder --chown=auditserver:nodejs /app/apps/server/dist ./dist
COPY --from=builder --chown=auditserver:nodejs /app/apps/server/package.json ./package.json

# Copy built workspace packages that are runtime dependencies
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit/dist ./node_modules/@repo/audit/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit/package.json ./node_modules/@repo/audit/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-db/dist ./node_modules/@repo/audit-db/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-db/package.json ./node_modules/@repo/audit-db/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-sdk/dist ./node_modules/@repo/audit-sdk/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-sdk/package.json ./node_modules/@repo/audit-sdk/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-client/dist ./node_modules/@repo/audit-client/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/audit-client/package.json ./node_modules/@repo/audit-client/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/auth/dist ./node_modules/@repo/auth/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/auth/package.json ./node_modules/@repo/auth/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/hono-helpers/dist ./node_modules/@repo/hono-helpers/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/hono-helpers/package.json ./node_modules/@repo/hono-helpers/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/redis-client/dist ./node_modules/@repo/redis-client/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/redis-client/package.json ./node_modules/@repo/redis-client/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/send-mail/dist ./node_modules/@repo/send-mail/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/send-mail/package.json ./node_modules/@repo/send-mail/package.json
COPY --from=builder --chown=auditserver:nodejs /app/packages/logs/dist ./node_modules/@repo/logs/dist
COPY --from=builder --chown=auditserver:nodejs /app/packages/logs/package.json ./node_modules/@repo/logs/package.json

# Copy external node_modules for production dependencies
COPY --from=builder --chown=auditserver:nodejs /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Readiness probe endpoint (for Kubernetes)
# The application should implement /ready endpoint for readiness checks

# Use dumb-init for proper signal handling and zombie reaping
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]