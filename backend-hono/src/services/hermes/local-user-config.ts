import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type LocalProviderId = "deepseek" | "opencode-go";
export type LocalHarperProvider = "deepseek-direct" | "opencode-go";

interface LocalProviderConfig {
  apiKey: string;
  baseUrl?: string;
  updatedAt: string;
}

interface LocalRoutingConfig {
  defaultProvider?: LocalHarperProvider;
  opencodeGoModel?: string;
  updatedAt: string;
}

interface LocalUserEntry {
  providers?: Partial<Record<LocalProviderId, LocalProviderConfig>>;
  routing?: LocalRoutingConfig;
}

interface LocalConfigFile {
  version: 1;
  users: Record<string, LocalUserEntry>;
}

const LOCAL_CONFIG_PATH = join(
  homedir(),
  ".hermes",
  "fintheon-user-config.json",
);

function normalizeUserId(userId: string): string {
  return userId && userId.trim() ? userId.trim() : "local-user";
}

function ensureConfigDir(): void {
  mkdirSync(dirname(LOCAL_CONFIG_PATH), { recursive: true });
}

function readConfig(): LocalConfigFile {
  ensureConfigDir();
  if (!existsSync(LOCAL_CONFIG_PATH)) {
    return { version: 1, users: {} };
  }
  try {
    const raw = readFileSync(LOCAL_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as LocalConfigFile;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.users !== "object"
    ) {
      return { version: 1, users: {} };
    }
    return {
      version: 1,
      users: parsed.users ?? {},
    };
  } catch {
    return { version: 1, users: {} };
  }
}

function writeConfig(config: LocalConfigFile): void {
  ensureConfigDir();
  writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  void chmod(LOCAL_CONFIG_PATH, 0o600).catch(() => undefined);
}

function ensureUser(config: LocalConfigFile, userId: string): LocalUserEntry {
  const key = normalizeUserId(userId);
  if (!config.users[key]) config.users[key] = {};
  return config.users[key];
}

export function upsertLocalProviderKey(
  userId: string,
  provider: LocalProviderId,
  apiKey: string,
  baseUrl?: string,
): void {
  const config = readConfig();
  const user = ensureUser(config, userId);
  if (!user.providers) user.providers = {};
  user.providers[provider] = {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeConfig(config);
}

export function deleteLocalProviderKey(
  userId: string,
  provider: LocalProviderId,
): void {
  const config = readConfig();
  const key = normalizeUserId(userId);
  const user = config.users[key];
  if (!user?.providers?.[provider]) return;
  delete user.providers[provider];
  writeConfig(config);
}

export function getLocalProviderKey(
  userId: string,
  provider: LocalProviderId,
): string | null {
  const config = readConfig();
  const key = normalizeUserId(userId);
  const value = config.users[key]?.providers?.[provider]?.apiKey;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function setLocalRoutingConfig(
  userId: string,
  routing: {
    defaultProvider?: LocalHarperProvider;
    opencodeGoModel?: string;
  },
): void {
  const config = readConfig();
  const user = ensureUser(config, userId);
  user.routing = {
    ...(routing.defaultProvider
      ? { defaultProvider: routing.defaultProvider }
      : {}),
    ...(routing.opencodeGoModel
      ? { opencodeGoModel: routing.opencodeGoModel }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  writeConfig(config);
}

export function getLocalRoutingConfig(userId: string): {
  defaultProvider?: LocalHarperProvider;
  opencodeGoModel?: string;
} | null {
  const config = readConfig();
  const key = normalizeUserId(userId);
  const routing = config.users[key]?.routing;
  if (!routing) return null;
  return {
    defaultProvider: routing.defaultProvider,
    opencodeGoModel: routing.opencodeGoModel,
  };
}
