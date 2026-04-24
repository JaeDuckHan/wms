FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY sql ./sql
COPY .env.example ./.env.example

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001 -G nodejs \
  && chown -R nextjs:nodejs /app

EXPOSE 3100

USER nextjs

CMD ["npm", "run", "start"]
