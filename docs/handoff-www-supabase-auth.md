# Handoff Prompt: Supabase Auth — WWW / Dashboard Tasks

> **For**: Claude In Chrome (browser agent)
> **From**: Codi (Claude Code) — 2026-03-22
> **Context**: Auth migrated from Clerk → Supabase in the Fintheon codebase. Code changes are done. These are the browser/dashboard tasks that must be completed for the auth flow to work end-to-end.

---

## What Was Done (Code — Already Complete)

The Fintheon app has been migrated from Clerk to Supabase Auth:

- **Backend** (`backend-hono/`): Auth middleware now verifies Supabase JWTs via `supabase.auth.getUser(token)`. `@clerk/backend` removed. New `supabase-auth.ts` service.
- **Frontend** (root): `ClerkProvider` replaced with Supabase `onAuthStateChange` session listener. `@clerk/clerk-react` and `@clerk/themes` removed. New `SupabaseSignIn.tsx` component (Google OAuth button, Solvys Gold theme). `AuthContext` uses Supabase session. `lib/backend.ts` sends Supabase `access_token` as Bearer header.
- **Env vars**: `CLERK_SECRET_KEY` removed. `SUPABASE_ANON_KEY` added to both backend and frontend env files.

**No code changes needed from you.** Only dashboard/browser configuration below.

---

## Task 1: Enable Google OAuth in Supabase Dashboard

1. Go to **https://supabase.com/dashboard/project/nrcfnzclbjboctptxaxx/auth/providers**
2. Find **Google** in the provider list → click to expand
3. Toggle **Enable** to ON
4. You'll need:
   - **Client ID** from Google Cloud Console
   - **Client Secret** from Google Cloud Console
5. If PIC already has a Google OAuth app configured (it was used with Clerk), reuse those credentials. Check the Clerk dashboard at **https://dashboard.clerk.com** → Social Connections → Google → copy the Client ID and Secret.
6. If not, create a new Google OAuth app:
   - Go to **https://console.cloud.google.com/apis/credentials**
   - Create OAuth 2.0 Client ID (Web application)
   - App name: **Fintheon**
   - Authorized JavaScript origins:
     - `https://fintheon-solvys.vercel.app`
     - `http://localhost:5173` (dev)
   - Authorized redirect URIs:
     - `https://nrcfnzclbjboctptxaxx.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret
7. Paste Client ID and Client Secret into the Supabase Google provider config
8. Click **Save**

---

## Task 2: Configure Supabase Auth Redirect URLs

1. Go to **https://supabase.com/dashboard/project/nrcfnzclbjboctptxaxx/auth/url-configuration**
2. Set **Site URL** to: `https://fintheon-solvys.vercel.app`
3. Add **Redirect URLs** (one per line):
   - `https://fintheon-solvys.vercel.app`
   - `https://fintheon-solvys.vercel.app/**`
   - `http://localhost:5173`
   - `http://localhost:5173/**`
4. Click **Save**

---

## Task 3: Update Vercel Environment Variables

The Vercel deployment needs the new Supabase env vars (replacing the old Clerk ones).

1. Go to **https://vercel.com** → Fintheon project → Settings → Environment Variables
2. **Delete** these Clerk variables (if they exist):
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_CLERK_DOMAIN`
   - `VITE_CLERK_PROXY_URL`
3. **Add** these new variables (apply to Production + Preview + Development):
   - `VITE_SUPABASE_URL` = `<supabase-project-url>`
   - `VITE_SUPABASE_ANON_KEY` = `<supabase-anon-or-publishable-key>`
   - `VITE_BYPASS_AUTH` = `false` (Production only)
4. Trigger a **redeploy** after adding the variables

---

## Task 4: Update Fly.io Backend Environment Variables

The backend on Fly also needs updated secrets.

1. Go to **https://fly.io/apps/fintheon** → Secrets
2. **Delete**: `CLERK_SECRET_KEY`
3. **Add** (if not already present):
   - `SUPABASE_ANON_KEY` = `<supabase-anon-or-publishable-key>`
4. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are still set
5. Verify `BYPASS_AUTH` is NOT set (or set to `false`) for production

---

## Task 5: Verify End-to-End Auth Flow

After completing Tasks 1-4:

1. Open `https://fintheon-solvys.vercel.app` in browser
2. You should see the AuthShell landing page with the animated logo
3. Click "LOGIN" → the auth window should show "Continue with Google" button
4. Click it → should redirect to Google OAuth consent screen
5. After granting access → should redirect back to Fintheon → show the main app (FeedSection, etc.)
6. Check browser DevTools console for any auth errors
7. Check Network tab → requests to `/api/account` should include `Authorization: Bearer <supabase_access_token>` and return 200

---

## Task 6 (Optional): Decommission Clerk

Once Supabase auth is verified working:

1. Go to **https://dashboard.clerk.com** → Fintheon/PIC application
2. Consider downgrading to free tier or deleting the application
3. Remove the `clerk.app.pricedinresearch.io` DNS records if they exist
4. The `@clerk/clerk-react` and `@clerk/backend` packages have already been removed from the codebase

---

## Architecture Reference

```
User clicks "Continue with Google"
  → Supabase OAuth redirect → Google consent → callback to Supabase
  → Supabase creates session → redirect to app origin
  → App.tsx: onAuthStateChange fires → session set → AppInner renders
  → AuthContext: reads session.user.id → initializes account
  → lib/backend.ts: getAccessToken() → session.access_token
  → Backend: authMiddleware → verifySupabaseToken(token) → auth.getUser()
  → c.set('userId', user.id) → handlers proceed
```

**BYPASS_AUTH=true** still works for local Electron/dev — skips all of the above.

---

## Files Changed (for reference)

| File                                           | What Changed                                                |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `backend-hono/src/services/supabase-auth.ts`   | NEW — Supabase JWT verification                             |
| `backend-hono/src/middleware/auth.ts`          | Clerk → Supabase                                            |
| `backend-hono/src/services/health-service.ts`  | `clerk` → `auth`                                            |
| `backend-hono/src/routes/diagnostics/index.ts` | `checkClerkAuth` → `checkSupabaseAuth`                      |
| `App.tsx`                                      | ClerkProvider → SupabaseAuthGate                            |
| `contexts/AuthContext.tsx`                     | Clerk hooks → Supabase session                              |
| `lib/supabase.ts`                              | Added auth helpers                                          |
| `lib/backend.ts`                               | Clerk getToken → Supabase getAccessToken                    |
| `components/auth/SupabaseSignIn.tsx`           | NEW — Google OAuth button                                   |
| `components/layout/MainLayout.tsx`             | Clerk signOut → Supabase signOut                            |
| `components/ChatInterface.tsx`                 | Clerk getToken → Supabase getAccessToken                    |
| `mini-widget-entry.tsx`                        | ClerkProvider removed                                       |
| `package.json`                                 | -@clerk/clerk-react, -@clerk/themes, +@supabase/supabase-js |
| `backend-hono/package.json`                    | -@clerk/backend                                             |
