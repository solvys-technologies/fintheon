#!/bin/bash
# [claude-code 2026-03-16] Distribution pipeline — builds frontend, backend, Mac DMG
set -e

VERSION=$(node -p "require('./package.json').version")
echo "=== Building Fintheon v$VERSION ==="

echo "[0/3] Stopping running Fintheon app..."
pkill -f "Fintheon.app/Contents/MacOS/Fintheon" 2>/dev/null || true
pkill -f "Fintheon Helper" 2>/dev/null || true
sleep 1

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
echo "=== Deploy ==="
DMG="desktop-dist/Fintheon-${VERSION}-arm64.dmg"
if [ -f "$DMG" ]; then
  # Copy DMG to Downloads
  cp "$DMG" "$HOME/Downloads/Fintheon-${VERSION}-arm64.dmg"
  echo "  ✓ DMG → ~/Downloads"

  # Eject any previously mounted Fintheon volumes
  for vol in /Volumes/Fintheon*; do
    hdiutil detach "$vol" -quiet 2>/dev/null || true
  done

  # Install to /Applications
  rm -rf /Applications/Fintheon.app /Applications/fintheon.app 2>/dev/null || true
  hdiutil attach "$DMG" -nobrowse -quiet
  VOLUME=$(ls -d /Volumes/Fintheon* 2>/dev/null | head -1)
  if [ -n "$VOLUME" ]; then
    cp -R "$VOLUME/Fintheon.app" /Applications/
    hdiutil detach "$VOLUME" -quiet
    xattr -cr /Applications/Fintheon.app
    echo "  ✓ App → /Applications"
  else
    echo "  ✗ DMG mounted but volume not found"
  fi
else
  echo "  ✗ DMG not found: $DMG"
fi

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
