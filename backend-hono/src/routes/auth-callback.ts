// [claude-code 2026-03-24] Supabase OAuth callback relay for Electron deep link
// After Google auth → Supabase → redirects here → serves page that opens fintheon:// deep link
import { Hono } from 'hono';

export function createAuthCallbackRoute() {
  const app = new Hono();

  // GET /api/auth/supabase/callback?code=xxx
  // Supabase redirects here after Google OAuth completes.
  // We serve a minimal HTML page that:
  // 1. Attempts to open fintheon://auth/callback?code=xxx (deep link to Electron)
  // 2. Shows a "Redirecting back to Fintheon..." message
  // 3. Auto-closes or tells user to close the tab
  app.get('/callback', (c) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code') || '';

    // Build the deep link URL with all query params forwarded
    const deepLink = `fintheon://auth/callback?code=${encodeURIComponent(code)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fintheon — Signing In</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #050402;
      color: #f0ead6;
      font-family: 'Cinzel', Georgia, serif;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 300;
      letter-spacing: 0.5em;
      color: #c79f4a;
      margin-bottom: 1.5rem;
    }
    p {
      font-size: 0.85rem;
      letter-spacing: 0.2em;
      color: rgba(240, 234, 214, 0.5);
      margin-bottom: 1rem;
    }
    .pulse {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #c79f4a;
      animation: pulse 1.5s ease-in-out infinite;
      margin-right: 8px;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    a {
      color: #c79f4a;
      text-decoration: none;
      font-size: 0.75rem;
      letter-spacing: 0.15em;
      opacity: 0.6;
      transition: opacity 0.3s;
    }
    a:hover { opacity: 1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>FINTHEON</h1>
    <p><span class="pulse"></span>Redirecting back to the app...</p>
    <p style="font-size: 0.7rem; margin-top: 2rem;">
      If Fintheon doesn't open automatically,
      <a href="${deepLink}">click here</a>.
    </p>
    <p style="font-size: 0.65rem; opacity: 0.3; margin-top: 1rem;">
      You can close this tab.
    </p>
  </div>
  <script>
    // Attempt the deep link immediately
    window.location.href = "${deepLink}";
    // Try closing the tab after a delay
    setTimeout(function() { window.close(); }, 3000);
  </script>
</body>
</html>`;

    return c.html(html);
  });

  return app;
}
