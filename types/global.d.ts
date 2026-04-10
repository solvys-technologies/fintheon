export {};

declare global {
  interface Window {
    Sentry?: typeof import("@sentry/react");
  }
}
