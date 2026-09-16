# syntax=docker/dockerfile:1

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS dependencies

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (ignores devDependencies)
RUN pnpm install --frozen-lockfile --prod

# --- Stage 2: Production Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

# Define production environment
ENV NODE_ENV=production
ENV PORT=3000

# Security: Run as non-root user
USER node

# Copy production node_modules from dependencies stage
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules

# Copy application source files
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./

# Expose port
EXPOSE 3000

# Start production server
CMD ["node", "server.js"]
