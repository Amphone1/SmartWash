# syntax=docker/dockerfile:1
# Build the auth service bundle, then run it on a slim runtime.
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node tools/build-service.mjs auth

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/dist/services/auth ./dist
EXPOSE 3001
CMD ["node", "dist/main.cjs"]
