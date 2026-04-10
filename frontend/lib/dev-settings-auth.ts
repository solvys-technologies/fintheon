// [claude-code 2026-03-27] S2-T6: Password gate for Developer Settings — SHA-256 check, session + local storage

const DEV_PASSWORD_HASH =
  "aea2cc6e020ed4b32498fb2683a5543b3efce8191ce85a33641f5a64a9fb0854";

const LS_KEY = "fintheon-dev-auth";
const SS_KEY = "fintheon-dev-session";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isDevAuthenticated(): boolean {
  return (
    localStorage.getItem(LS_KEY) === "true" &&
    sessionStorage.getItem(SS_KEY) === "true"
  );
}

export async function authenticateDev(password: string): Promise<boolean> {
  const hash = await sha256(password);
  if (hash === DEV_PASSWORD_HASH) {
    localStorage.setItem(LS_KEY, "true");
    sessionStorage.setItem(SS_KEY, "true");
    return true;
  }
  return false;
}

export function clearDevAuth(): void {
  localStorage.removeItem(LS_KEY);
  sessionStorage.removeItem(SS_KEY);
}
