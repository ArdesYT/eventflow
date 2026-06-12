FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/backend ./src/backend
COPY tsconfig.json ./
RUN npm install ts-node typescript --no-save
EXPOSE 3000
CMD ["npx", "ts-node", "--transpile-only", "src/backend/server.ts"]
