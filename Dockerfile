FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build && npx prisma generate

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY scripts/seed-production.mjs ./scripts/seed-production.mjs
COPY scripts/sync-catalog-production.mjs ./scripts/sync-catalog-production.mjs
COPY scripts/verify-whatsapp-token.mjs ./scripts/verify-whatsapp-token.mjs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/seed-production.mjs && node scripts/sync-catalog-production.mjs && node scripts/verify-whatsapp-token.mjs && node dist/index.js"]
