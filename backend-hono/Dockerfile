# Fintheon API — Production Build
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (need typescript for build)
RUN npm install --legacy-peer-deps

# Copy source code and config
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

# [claude-code 2026-04-26] S45.5/F3: Piper voice weights ride along with the
# image so /api/voice/sample?voice=cori works without an extra mount. The
# `piper` binary itself is NOT yet installed here — install via `apk add piper`
# (or build from source) before Cori synth will work in prod. Until then
# synthesizeWithPiper returns null and the voice router falls back to
# ElevenLabs.
COPY assets ./assets

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
