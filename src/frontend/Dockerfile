# =============================================================================
# Auth0 Enterprise Platform - Frontend Dockerfile
# =============================================================================
# Next.js 14 frontend with Node 20
# =============================================================================

FROM node:20-alpine

# Set work directory
WORKDIR /app

# Install dependencies for node-gyp (if needed)
RUN apk add --no-cache libc6-compat

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build argument for environment
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Expose port
EXPOSE 3000

# Set hostname to listen on all interfaces
ENV HOSTNAME="0.0.0.0"

# Development command (with hot reload)
CMD ["npm", "run", "dev"]
