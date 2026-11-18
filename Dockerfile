FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig*.json vite.config.ts ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
USER node
EXPOSE 3000

CMD ["node", "--require", "ts-node/register/transpile-only", "src/backend/server.ts"]
