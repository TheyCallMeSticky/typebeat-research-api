# ---------- install deps ---------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY typebeat-research-api/pnpm-lock.yaml .
COPY typebeat-research-api/package.json .
RUN pnpm install --frozen-lockfile

# ---------- dev runtime ----------
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
# Installer curl pour les health checks
RUN apk add --no-cache curl
COPY --from=deps /app/node_modules ./node_modules
COPY typebeat-research-api/. .
EXPOSE 3002
CMD ["pnpm","dev"]

