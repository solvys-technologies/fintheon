#!/bin/bash
# Fintheon Desktop release preflight.
# Fails the release unless the GitHub-ready DMG is buildable, sealed, and sane.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
EXPECTED_APP_ID="io.pricedinresearch.fintheon"
DMG="$ROOT/desktop-dist/Fintheon-${VERSION}-arm64.dmg"
APP="$ROOT/desktop-dist/mac-arm64/Fintheon.app"
ALLOW_S100_UNSIGNED="${FINTHEON_ALLOW_S100_UNSIGNED:-0}"
SKIP_DMG_BUILD=0
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_DMG_BUILD=1
fi

step() { printf '\n[%s] %s\n' "$1" "$2"; }
fail() { echo "FAIL: $1" >&2; exit 1; }
bundle_id() {
  plutil -extract CFBundleIdentifier raw -o - "$1/Contents/Info.plist" 2>/dev/null ||
    /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$1/Contents/Info.plist"
}

step "1/10" "Checking version sync"
BACKEND_VERSION="$(node -p "require('$ROOT/backend-hono/package.json').version")"
MOBILE_VERSION="$(node -p "require('$ROOT/mobile/package.json').version")"
PACKAGE_APP_ID="$(node -p "require('$ROOT/package.json').build.appId")"
[[ "$BACKEND_VERSION" == "$VERSION" ]] || fail "backend-hono version $BACKEND_VERSION != $VERSION"
[[ "$MOBILE_VERSION" == "$VERSION" ]] || fail "mobile version $MOBILE_VERSION != $VERSION"
[[ "$PACKAGE_APP_ID" == "$EXPECTED_APP_ID" ]] || fail "package appId $PACKAGE_APP_ID != $EXPECTED_APP_ID"
grep -q "RELEASE_REF=\"v${VERSION}\"" "$ROOT/scripts/fintheon-setup.sh" || fail "setup script release ref is stale"
grep -q "UPDATE_VERSION=\"${VERSION}\"" "$ROOT/scripts/fintheon-update.sh" || fail "update script version is stale"

step "2/10" "Checking out-of-box desktop runtime config"
grep -q '^VITE_API_URL=https://fintheon.fly.dev$' "$ROOT/frontend/.env.production" || fail "production API URL must not point at localhost"
grep -q '^VITE_CLIENT_TARGET=https://fintheon.fly.dev$' "$ROOT/frontend/.env.production" || fail "production client target must not point at localhost"
grep -q '^VITE_SUPABASE_URL=https://nrcfnzclbjboctptxaxx.supabase.co$' "$ROOT/frontend/.env.production" || fail "production Supabase URL is missing"
grep -Eq '^VITE_SUPABASE_(ANON_KEY|PUBLISHABLE_KEY)=.+' "$ROOT/frontend/.env.production" || fail "production Supabase public key is missing"
grep -q 'LIVEKIT_URL=wss://fintheon-livekit.fly.dev' "$ROOT/scripts/fintheon-update.sh" || fail "LiveKit public URL default is missing from update script"

step "3/10" "Typechecking frontend"
npx tsc --noEmit --project "$ROOT/frontend/tsconfig.json"

step "4/10" "Building frontend cleanly"
rm -rf "$ROOT/frontend/dist"
(cd "$ROOT/frontend" && bun run build)

step "5/10" "Building backend"
(cd "$ROOT/backend-hono" && bun run build)

step "6/10" "Checking updater scripts"
bash -n \
  "$ROOT/scripts/fintheon-install-update.sh" \
  "$ROOT/scripts/fintheon-update.sh" \
  "$ROOT/scripts/install-cli.sh" \
  "$ROOT/scripts/fintheon-cli.sh"

step "7/10" "Building Mac DMG"
if [[ "$SKIP_DMG_BUILD" == "1" ]]; then
  echo "Skipping DMG rebuild; validating existing desktop-dist artifacts"
else
  rm -rf "$ROOT/desktop-dist"
  if [[ "$ALLOW_S100_UNSIGNED" == "1" ]]; then
    (cd "$ROOT" && FINTHEON_AD_HOC_SIGN_MAC=true CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --mac dmg)
  else
    (cd "$ROOT" && FINTHEON_NOTARIZE_MAC=true bunx electron-builder --mac dmg)
  fi
fi
[[ -f "$DMG" ]] || fail "DMG missing: $DMG"

step "8/10" "Checking app identity, seal, DMG contents, and Gatekeeper assessment"
[[ "$(bundle_id "$APP")" == "$EXPECTED_APP_ID" ]] || fail "app bundle id does not match $EXPECTED_APP_ID"
codesign --verify --deep --strict --verbose=2 "$APP"

MOUNT_DIR="$(mktemp -d)"
cleanup_mount() {
  hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
  rm -rf "$MOUNT_DIR"
}
trap cleanup_mount EXIT
hdiutil attach "$DMG" -nobrowse -readonly -quiet -mountpoint "$MOUNT_DIR"
[[ -d "$MOUNT_DIR/Fintheon.app" ]] || fail "DMG does not contain Fintheon.app"
[[ "$(bundle_id "$MOUNT_DIR/Fintheon.app")" == "$EXPECTED_APP_ID" ]] || fail "DMG app bundle id does not match $EXPECTED_APP_ID"
codesign --verify --deep --strict --verbose=2 "$MOUNT_DIR/Fintheon.app"
cleanup_mount
trap - EXIT

if spctl -a -vv -t exec "$APP" && spctl -a -vv -t open "$DMG"; then
  echo "Gatekeeper assessment accepted"
elif [[ "$ALLOW_S100_UNSIGNED" == "1" ]]; then
  echo "WARN: Gatekeeper rejected unsigned/ad-hoc macOS artifact under Sprint 100 exception"
else
  fail "Gatekeeper rejected this release; set FINTHEON_ALLOW_S100_UNSIGNED=1 only under the Sprint 100 Developer ID exception"
fi

step "9/10" "Checking update metadata"
[[ -f "$ROOT/desktop-dist/latest-mac.yml" ]] || fail "latest-mac.yml missing"
grep -q "Fintheon-${VERSION}-arm64.dmg" "$ROOT/desktop-dist/latest-mac.yml" || fail "latest-mac.yml points at the wrong DMG"
node - "$ROOT/desktop-dist/latest-mac.yml" "$DMG" <<'NODE'
const crypto = require("crypto");
const fs = require("fs");
const manifest = fs.readFileSync(process.argv[2], "utf8");
const dmgPath = process.argv[3];
const sha512 = manifest.match(/^sha512:\s*([^\r\n]+)/m)?.[1]?.trim();
const size = Number.parseInt(manifest.match(/^\s{4}size:\s*([0-9]+)/m)?.[1] ?? "", 10);
if (!sha512) {
  console.error("FAIL: latest-mac.yml is missing sha512");
  process.exit(1);
}
const stat = fs.statSync(dmgPath);
if (!Number.isFinite(size) || stat.size !== size) {
  console.error(`FAIL: latest-mac.yml size ${size} != DMG size ${stat.size}`);
  process.exit(1);
}
const actual = crypto.createHash("sha512").update(fs.readFileSync(dmgPath)).digest("base64");
if (actual !== sha512) {
  console.error("FAIL: latest-mac.yml sha512 does not match DMG");
  process.exit(1);
}
NODE

step "10/10" "Writing checksum"
shasum -a 256 "$DMG"
if [[ "$ALLOW_S100_UNSIGNED" == "1" ]]; then
  echo "PASS WITH S100 UNSIGNED EXCEPTION: Fintheon Desktop v$VERSION release preflight complete"
else
  echo "PASS: Fintheon Desktop v$VERSION release preflight complete"
fi
