import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface LocalConnection {
  username: string;
  apiKey: string;
  activeAccountId?: string;
  updatedAt: string;
}

interface LocalConfig {
  version: 1;
  users: Record<string, LocalConnection>;
}

const CONFIG_PATH = join(homedir(), ".fintheon", "projectx-connections.json");

function normalizeUserId(userId: string): string {
  return userId.trim() || "local-user";
}

function readConfig(): LocalConfig {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  if (!existsSync(CONFIG_PATH)) return { version: 1, users: {} };
  try {
    const parsed = JSON.parse(
      readFileSync(CONFIG_PATH, "utf-8"),
    ) as LocalConfig;
    if (!parsed?.users || typeof parsed.users !== "object") {
      return { version: 1, users: {} };
    }
    return { version: 1, users: parsed.users };
  } catch {
    return { version: 1, users: {} };
  }
}

function writeConfig(config: LocalConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  void chmod(CONFIG_PATH, 0o600).catch(() => undefined);
}

export function readLocalProjectX(userId: string): LocalConnection | null {
  const config = readConfig();
  return config.users[normalizeUserId(userId)] ?? null;
}

export function writeLocalProjectX(
  userId: string,
  input: { username: string; apiKey: string; activeAccountId?: string },
): void {
  const config = readConfig();
  config.users[normalizeUserId(userId)] = {
    username: input.username,
    apiKey: input.apiKey,
    ...(input.activeAccountId
      ? { activeAccountId: input.activeAccountId }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  writeConfig(config);
}
