FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/app/data/deskhop.sqlite
RUN groupadd --system --gid 1001 deskhop && useradd --system --uid 1001 --gid deskhop deskhop && mkdir -p /app/data && chown deskhop:deskhop /app/data
COPY --from=build --chown=deskhop:deskhop /app/.next/standalone ./
COPY --from=build --chown=deskhop:deskhop /app/.next/static ./.next/static
COPY --from=build --chown=deskhop:deskhop /app/public ./public
COPY --from=build --chown=deskhop:deskhop /app/scripts/ops.mjs ./scripts/ops.mjs
USER deskhop
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
