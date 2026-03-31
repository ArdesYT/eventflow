# Stage 1: Build the React frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Compile TypeScript backend
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install --legacy-peer-deps
COPY src/backend ./src/backend
RUN npx tsc --project tsconfig.backend.json

# DEBUG: print compiled output so we can see what was actually generated
RUN find /app/dist -type f

# Stage 3: Production image
FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=backend-build /app/dist/backend ./dist/backend
COPY --from=build /app/dist ./public

# DEBUG: verify files exist and test module load
RUN find /app/dist -type f
RUN node -e "require('./dist/backend/server.js')" || true

ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/backend/server.js"]