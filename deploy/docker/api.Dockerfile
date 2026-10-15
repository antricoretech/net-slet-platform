FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/exam-rules/package.json packages/exam-rules/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @net-slet/exam-rules build
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm --filter @net-slet/api db:generate
RUN pnpm --filter @net-slet/api build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production APP_ENV=production PORT=4000
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/src/generated ./apps/api/src/generated
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
