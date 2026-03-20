// [claude-code 2026-03-06] Handles GitHub OAuth redirect callback — popup window flow
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Intercepts GitHub OAuth callback URL and exchanges code for token.
 * When running in a popup window, posts the result back to the opener and closes.
 * Renders nothing when not on callback URL.
 */
export function GitHubOAuthCallback() {
  const { gitHub } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!url.pathname.includes('/auth/github/callback') || !code) return;
    if (processing) return;

    setProcessing(true);

    gitHub.handleCallback(code, state ?? '')
      .then(() => {
        // If opened as popup, notify the opener and close
        if (window.opener) {
          window.opener.postMessage({ type: 'github-oauth-success' }, '*');
          window.close();
        } else {
          // Fallback: direct navigation — clean URL
          window.history.replaceState({}, '', '/');
        }
      })
      .catch((err) => {
        if (window.opener) {
          window.opener.postMessage({ type: 'github-oauth-error', error: err.message }, '*');
          window.close();
        } else {
          setError(err.message);
        }
      })
      .finally(() => setProcessing(false));
  }, []);

  const url = new URL(window.location.href);
  if (!url.pathname.includes('/auth/github/callback')) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">GitHub authentication failed: {error}</p>
          <button
            onClick={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded text-sm hover:bg-zinc-700"
          >
            Return to Fintheon
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <p className="text-zinc-400 text-sm animate-pulse">Connecting GitHub...</p>
    </div>
  );
}
