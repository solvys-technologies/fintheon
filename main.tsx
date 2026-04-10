import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release:
      import.meta.env.VITE_SENTRY_RELEASE ??
      import.meta.env.VERCEL_GIT_COMMIT_SHA ??
      import.meta.env.GITHUB_SHA ??
      "local-dev",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
    replaysSessionSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0.01",
    ),
    replaysOnErrorSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? "1.0",
    ),
  });

  if (typeof window !== "undefined") {
    (window as typeof window & { Sentry?: typeof Sentry }).Sentry = Sentry;
  }
}

const ErrorFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-black text-white">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-gray-300">
        Our team has been notified via Sentry. Please refresh the page or
        contact support if the issue persists.
      </p>
      <button
        className="rounded bg-white/10 px-4 py-2 text-sm"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  </div>
);

const Root = sentryDsn ? (
  <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog>
    <App />
  </Sentry.ErrorBoundary>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{Root}</React.StrictMode>,
);
