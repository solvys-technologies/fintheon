// [claude-code 2026-03-20] 8i: Read version from package.json for Epoch display
// Vite injects import.meta.env at build time, but we can also use a define.
// Fallback: read from the root package.json version field via Vite's JSON import.
import pkgJson from '../../package.json';

export const EPOCH_VERSION: string = pkgJson.version ?? '0.0.0';
