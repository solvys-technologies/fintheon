// [claude-code 2026-03-24] Supabase OAuth callback relay for Electron
// Handles both PKCE (?code=xxx) and implicit (#access_token=xxx) flows
import { Hono } from "hono";

// In-memory store for pending auth data (single-user local app)
let pendingAuth: { data: Record<string, string>; ts: number } | null = null;

export function createAuthCallbackRoute() {
  const app = new Hono();

  // GET /callback — Supabase redirects here after Google OAuth
  // Code may arrive as ?code=xxx (PKCE) or #access_token=xxx (implicit)
  // Hash fragments never reach the server, so the page uses JS to handle both
  app.get("/callback", (c) => {
    const url = new URL(c.req.url);
    const serverCode = url.searchParams.get("code") || "";

    // If we got the code server-side (PKCE), store it immediately
    if (serverCode) {
      pendingAuth = { data: { code: serverCode }, ts: Date.now() };
    }

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fintheon — Signing In</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#050402; color:#f0ead6; font-family:'Cinzel',Georgia,serif; }
    h1 { font-size:1.5rem; font-weight:300; letter-spacing:0.5em; color:#c79f4a; margin-bottom:1.5rem; }
    p { font-size:0.85rem; letter-spacing:0.2em; color:rgba(240,234,214,0.5); margin-bottom:1rem; }
    .pulse { display:inline-block; width:8px; height:8px; border-radius:50%; background:#c79f4a; animation:p 1.5s ease-in-out infinite; margin-right:8px; }
    @keyframes p { 0%,100%{opacity:0.3} 50%{opacity:1} }
    a { color:#c79f4a; text-decoration:none; font-size:0.75rem; letter-spacing:0.15em; opacity:0.6; }
    a:hover { opacity:1; }
    #status { font-size:0.7rem; color:rgba(199,159,74,0.5); margin-top:1rem; }
  </style>
</head>
<body>
  <div style="text-align:center;padding:2rem">
    <h1>FINTHEON</h1>
    <p><span class="pulse"></span>Signing you in...</p>
    <p id="status"></p>
    <p style="font-size:0.65rem;opacity:0.3;margin-top:2rem">You can close this tab after Fintheon opens.</p>
  </div>
  <script>
    (function() {
      var status = document.getElementById('status');
      var serverCode = "${serverCode}";

      // Parse hash fragment (implicit flow: #access_token=xxx&refresh_token=xxx)
      var hash = window.location.hash.substring(1);
      var params = {};
      if (hash) {
        hash.split('&').forEach(function(pair) {
          var kv = pair.split('=');
          params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
        });
      }

      // Also check query params (PKCE flow: ?code=xxx)
      var urlParams = new URLSearchParams(window.location.search);
      var code = urlParams.get('code') || serverCode;

      // Determine what we have
      var hasTokens = params.access_token && params.refresh_token;
      var hasCode = !!code;

      if (hasTokens) {
        // Implicit flow — POST tokens to backend for frontend to pick up
        status.textContent = 'Session received, redirecting...';
        fetch('/api/auth/supabase/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        }).then(function() {
          // Also try deep link
          window.location.href = 'fintheon://auth/callback?access_token=' +
            encodeURIComponent(params.access_token) +
            '&refresh_token=' + encodeURIComponent(params.refresh_token);
          setTimeout(function() { window.close(); }, 2000);
        });
      } else if (hasCode) {
        // PKCE flow — deep link with code, backend already has it stored
        status.textContent = 'Authorization received, redirecting...';
        window.location.href = 'fintheon://auth/callback?code=' + encodeURIComponent(code);
        setTimeout(function() { window.close(); }, 2000);
      } else {
        status.textContent = 'No auth data received. Please try again.';
      }
    })();
  </script>
</body>
</html>`);
  });

  // POST /store — relay page POSTs tokens here for frontend polling
  app.post("/store", async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, string>;
      if (body.access_token) {
        pendingAuth = { data: body, ts: Date.now() };
        return c.json({ ok: true });
      }
    } catch {
      /* ignore */
    }
    return c.json({ ok: false }, 400);
  });

  // GET /pending — frontend polls this to get auth data
  app.get("/pending", (c) => {
    if (pendingAuth && Date.now() - pendingAuth.ts < 120_000) {
      const data = pendingAuth.data;
      pendingAuth = null; // consume once
      return c.json(data);
    }
    return c.json({ code: null });
  });

  return app;
}
