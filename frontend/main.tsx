import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress noisy third-party warnings (e.g. Snowplow "Invalid environment undefined")
const _origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (args.some(a => typeof a === 'string' && a.includes('Invalid environment'))) return;
  _origWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
