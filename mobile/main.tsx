import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// [claude-code 2026-04-19] S24 unify: belt-and-suspenders against shipping a bundle with
// VITE_API_URL=http://localhost:8080 baked in (happened once — every fetch pointed at the user's phone).
// Vite inlines import.meta.env at build time, so we can't fix the baked constant. Instead wrap fetch:
// any absolute call to localhost/127.* in production gets rewritten to a relative path. The Vercel
// vercel.json rewrite then proxies /api/* → https://fintheon.fly.dev/api/*.
if (import.meta.env.PROD && typeof window !== "undefined") {
  const baked = import.meta.env.VITE_API_URL ?? "";
  const hostIsLocal = /^(localhost|127\.0\.0\.1)$/i.test(
    window.location.hostname,
  );
  const bakedIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(
    baked,
  );
  if (!hostIsLocal && bakedIsLocal) {
    console.warn(
      "[fintheon] Bundle had localhost baked into VITE_API_URL. Rewriting requests to relative paths.",
    );
    const origFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        typeof input === "string" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(input)
      ) {
        const rewritten = input.replace(
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
          "",
        );
        return origFetch(rewritten, init);
      }
      if (
        input instanceof URL &&
        /^(localhost|127\.0\.0\.1)$/i.test(input.hostname)
      ) {
        return origFetch(input.pathname + input.search + input.hash, init);
      }
      return origFetch(input, init);
    };
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker in production for push notifications + offline
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js");
}
