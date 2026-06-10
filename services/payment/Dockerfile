# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node tools/build-service.mjs payment

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/dist/services/payment ./dist
EXPOSE 3009
CMD ["node", "dist/main.cjs"]
