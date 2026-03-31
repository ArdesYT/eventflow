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
# Copy full src so tsconfig paths resolve correctly
COPY src ./src
# Use tsconfig for esModuleInterop etc, but force outDir so output path is predictable
RUN npx tsc --project tsconfig.json --skipLibCheck --outDir /app/dist/backend --noEmit false

# Stage 3: Production image
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled backend JS from stage 2
COPY --from=backend-build /app/dist/src/backend ./dist/src/backend

# Copy built React frontend from stage 1 into public/
COPY --from=build /app/dist ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/backend/server.js"]
