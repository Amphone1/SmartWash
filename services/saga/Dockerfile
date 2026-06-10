# syntax=docker/dockerfile:1
# Saga is NOT esbuild-bundled — Temporal bundles the workflow code itself from
# the compiled multi-file output, so we ship tsc output + node_modules.
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc -p services/saga/tsconfig.app.json

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/dist/services/saga ./dist
EXPOSE 3010
CMD ["node", "dist/main.js"]
