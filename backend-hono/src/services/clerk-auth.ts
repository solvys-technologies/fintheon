// [claude-code 2026-03-22] Clerk auth removed — migrated to Supabase
// This file is a no-op stub. Delete in next cleanup pass.
// See supabase-auth.ts for the replacement.

export async function verifyClerkToken(_token: string): Promise<any> {
  throw new Error('Clerk auth has been removed. Use Supabase auth instead.');
}

export function clerkHealth() {
  return { hasSecret: false, mockMode: true, issuer: null, template: null };
}

export class ClerkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClerkConfigError';
  }
}
