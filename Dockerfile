# Stage 1: Build the React frontend
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Compile TypeScript backend
FROM node:18-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install
COPY src/backend ./src/backend
RUN npx tsc --project tsconfig.json || npx tsc --skipLibCheck

# Stage 3: Production image
FROM node:18-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled backend JS from stage 2
COPY --from=backend-build /app/dist/backend ./dist/backend

# Copy built React frontend from stage 1 into public/
COPY --from=build /app/dist ./public

# Back4App injects PORT at runtime — default to 8080
ENV PORT=8080
EXPOSE 8080

# Serve static React files from Express and run compiled JS (no ts-node needed)
CMD ["node", "dist/backend/server.js"]