# Fintheon API — Production Build
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (need typescript for build)
RUN npm install --legacy-peer-deps

# Copy source code and config
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
