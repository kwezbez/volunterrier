# Portable container image (works on Fly.io, Railway, Google Cloud Run, a VPS, ...)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY package.json ./
USER node
EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://localhost:3001/healthz || exit 1
CMD ["node", "server/index.js"]
