#!/bin/bash
# Build the public macOS updater artifact with Developer ID signing and notarization.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PUBLISH="${1:-}"
TAG="v$VERSION"
DMG="$ROOT/desktop-dist/Fintheon-${VERSION}-arm64.dmg"
LATEST_MAC="$ROOT/desktop-dist/latest-mac.yml"
BLOCKMAP="$ROOT/desktop-dist/Fintheon-${VERSION}-arm64.dmg.blockmap"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

has_notary_credentials() {
  [[ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]] && return 0
  [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]] && return 0
  [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]] && return 0
  return 1
}

echo "=== Building signed Fintheon v$VERSION ==="

APP_ID="$(node -p "require('$ROOT/package.json').build.appId")"
[[ "$APP_ID" == "io.pricedinresearch.fintheon" ]] || fail "package build.appId is $APP_ID"

if [[ -z "${CSC_LINK:-}" && -z "${CSC_NAME:-}" ]]; then
  if ! security find-identity -p codesigning -v 2>/dev/null | grep -q "Developer ID Application"; then
    fail "Developer ID Application identity not found. Set CSC_LINK/CSC_KEY_PASSWORD or install the certificate."
  fi
fi

has_notary_credentials || fail "Notary credentials missing. Set APPLE_KEYCHAIN_PROFILE, API key env vars, or Apple ID app-specific password env vars."

bun run frontend:build
(cd "$ROOT/backend-hono" && bun run build)

rm -rf "$ROOT/desktop-dist"
export FINTHEON_NOTARIZE_MAC=true
unset FINTHEON_AD_HOC_SIGN_MAC

(cd "$ROOT" && bunx electron-builder --mac dmg --publish never)

"$ROOT/scripts/desktop-release-preflight.sh" --skip-build

if [[ "$PUBLISH" == "--publish" ]]; then
  command -v gh >/dev/null 2>&1 || fail "GitHub CLI is required to publish updater assets"
  [[ -f "$DMG" ]] || fail "DMG missing: $DMG"
  [[ -f "$LATEST_MAC" ]] || fail "latest-mac.yml missing: $LATEST_MAC"

  assets=("$DMG" "$LATEST_MAC")
  [[ -f "$BLOCKMAP" ]] && assets+=("$BLOCKMAP")

  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "${assets[@]}" --clobber
  else
    gh release create "$TAG" "${assets[@]}" \
      --title "Fintheon v$VERSION" \
      --notes "Signed and notarized Fintheon desktop updater release."
  fi
fi
