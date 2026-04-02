# Frontend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy-peer-deps flag for react-chessboard compatibility
RUN npm ci --legacy-peer-deps --force

# Copy source code and config files
COPY . ./

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built dist application
COPY --from=builder /app/dist ./dist

# Copy public assets into dist
COPY --from=builder /app/public/pieces ./dist/pieces

EXPOSE 5173

# Serve with SPA fallback to index.html
CMD ["serve", "-s", "dist", "-l", "5173"]
