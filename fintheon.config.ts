// [claude-code 2026-04-19] S27-T7 (W2d): portless-style hostname config.
// Consumed by a local portless daemon to resolve stable `.fintheon.test`
// hostnames regardless of which worktree is serving which port. Agent MCP
// configs + local scripts reference the named URL so a port flip between
// worktrees doesn't break anything.

export interface LocalAppConfig {
  name: string;
  port: number;
  subdomain?: string;
}

export interface FintheonPortlessConfig {
  tld: "fintheon.test";
  apps: LocalAppConfig[];
}

const config: FintheonPortlessConfig = {
  tld: "fintheon.test",
  apps: [
    { name: "fintheon", port: 8080 }, // fintheon.test → backend-hono
    { name: "hermes", port: 8318, subdomain: "hermes" }, // hermes.fintheon.test
    { name: "news", port: 8082, subdomain: "news" }, // news.fintheon.test
  ],
};

export default config;
