# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
RUN apk update && apk upgrade --no-cache
WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS build-backend
RUN apk update && apk upgrade --no-cache
WORKDIR /app/backend
COPY app/backend/package*.json ./
RUN npm ci --omit=dev
COPY app/backend/ ./

# Stage 3: Final Hardened Production Image
FROM cgr.dev/chainguard/node:latest
WORKDIR /app

# Copy production backend dependencies and source
COPY --from=build-backend --chown=node:node /app/backend ./backend

# Copy built frontend assets
COPY --from=build-frontend --chown=node:node /app/frontend/dist ./frontend-dist

EXPOSE 3001

# The Chainguard node image has 'node' as the ENTRYPOINT
CMD ["backend/index.js"]
