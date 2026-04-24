// [claude-code 2026-04-24] S37: password rotated to PricedInResearch122356 + exposed generic gate helpers so the Refinement Engine edit-lock can reuse the same session.
// [claude-code 2026-03-27] S2-T6: Password gate for Developer Settings — SHA-256 check, session + local storage

const DEV_PASSWORD_HASH =
  "4d4bbd3b48212c6f80879321bc6a372c6ffcf86c66124022eeddf0abfac27a0d";

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

/** Same password covers the Refinement Engine edit lock. Frontend-only gate —
 *  anything mutation-level must still be Supabase-JWT-gated on the backend. */
export { isDevAuthenticated as isRefinementEditUnlocked };
export { authenticateDev as unlockRefinementEdit };
export { clearDevAuth as lockRefinementEdit };
