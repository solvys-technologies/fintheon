// [claude-code 2026-04-19] S27-T7 (W2d): Portless hostname config.
// scripts/portless-desktop-services.mjs registers these static aliases with a
// local Portless proxy started on the IANA-reserved `.test` TLD.

export interface LocalAppConfig {
  name: string;
  port: number;
  subdomain?: string;
}

export interface FintheonPortlessConfig {
  tld: "test";
  apps: LocalAppConfig[];
}

const config: FintheonPortlessConfig = {
  tld: "test",
  apps: [
    { name: "fintheon", port: 8080 }, // fintheon.test → backend-hono
    { name: "hermes.fintheon", port: 8318, subdomain: "hermes" },
    { name: "news.fintheon", port: 8082, subdomain: "news" },
  ],
};

export default config;
