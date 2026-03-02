FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY sql ./sql
COPY .env.example ./.env.example

EXPOSE 3100

CMD ["npm", "run", "start"]
