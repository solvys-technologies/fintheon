import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installEasternTimeFormatOverride } from "./lib/eastern-time-format";
import { installRuntimeApiBaseFetchBridge } from "./lib/runtime-api-base";
import { routeSurfaceForClient } from "../shared/surface-routing";
import "./index.css";

installEasternTimeFormatOverride();
installRuntimeApiBaseFetchBridge();

// Suppress noisy third-party warnings (e.g. Snowplow "Invalid environment undefined")
const _origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    args.some((a) => typeof a === "string" && a.includes("Invalid environment"))
  )
    return;
  _origWarn.apply(console, args);
};

if (
  !routeSurfaceForClient({
    currentSurface: "desktop",
    desktopUrl: import.meta.env.VITE_FINTHEON_DESKTOP_URL,
    mobileUrl: import.meta.env.VITE_FINTHEON_MOBILE_URL,
  })
) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
