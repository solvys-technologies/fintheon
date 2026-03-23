#!/bin/bash
# [claude-code 2026-03-16] Distribution pipeline — builds frontend, backend, Mac DMG
set -e

VERSION=$(node -p "require('./package.json').version")
echo "=== Building Fintheon v$VERSION ==="

# 1. Build frontend
echo "[1/3] Building frontend..."
bun run frontend:build

# 2. Build backend
echo "[2/3] Building backend..."
cd backend-hono && bun run build && cd ..

# 3. Build Mac DMG
echo "[3/3] Building Mac DMG..."
bunx electron-builder --mac dmg

# Windows NSIS (uncomment on Windows or cross-compile CI)
# bunx electron-builder --win nsis

echo ""
echo "=== Artifacts ==="
ls -la desktop-dist/Fintheon-*.dmg 2>/dev/null || echo "  No DMG found"
ls -la desktop-dist/Fintheon-*.exe 2>/dev/null || echo "  No EXE found"

echo ""
echo "=== Checksums ==="
shasum -a 256 desktop-dist/Fintheon-* 2>/dev/null || echo "  No artifacts to checksum"

echo ""
echo "Done. Upload via:"
echo "  gh release create v$VERSION desktop-dist/Fintheon-* --title 'Fintheon v$VERSION'"
