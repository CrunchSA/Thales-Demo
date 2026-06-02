# Stage 1: Build Frontend
FROM node:20-alpine@sha256:f4d1b5d7c5e4c5e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e AS build-frontend
RUN apk update && apk upgrade --no-cache
WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ ./
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM node:20-alpine@sha256:f4d1b5d7c5e4c5e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY app/backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY app/backend/ ./backend/
COPY --from=build-frontend /app/frontend/dist ./frontend-dist

EXPOSE 3001
CMD ["node", "backend/index.js"]
