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

# Stage 3: Production image
FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled backend JS from stage 2
COPY --from=backend-build /app/dist/backend ./dist/backend

# Copy built React frontend from stage 1 into public/
COPY --from=build /app/dist ./public

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "node dist/backend/server.js 2>&1; echo 'EXIT:' $?; sleep 3600"]