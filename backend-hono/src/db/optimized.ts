import { Pool, type PoolConfig, type QueryResult } from "pg";

export class DatabaseError extends Error {
  status: number;
  code?: string;

  constructor(
    message: string,
    options: { status?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "DatabaseError";
    this.status = options.status ?? 503;
    this.code = options.code;
    (this as { cause?: unknown }).cause = options.cause;
  }
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class LruCache<K, V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly map: Map<K, CacheEntry<V>>;

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlOverride?: number) {
    if (this.map.has(key)) this.map.delete(key);
    const ttl = ttlOverride ?? this.ttlMs;
    this.map.set(key, { value, expiresAt: Date.now() + ttl });
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
  }
}

const isDev = process.env.NODE_ENV !== "production";

const resolveConnectionString = (): string | null => {
  const neon = process.env.NEON_DATABASE_URL;
  if (neon) return neon;

  const legacy = process.env.DATABASE_URL;
  if (legacy) {
    console.warn("[db] DATABASE_URL detected. Prefer NEON_DATABASE_URL.");
    return legacy;
  }

  if (isDev) {
    console.warn("[db] No database URL - using mock mode in development");
    return null;
  }

  throw new Error("Missing NEON_DATABASE_URL or DATABASE_URL");
};

const connectionString = resolveConnectionString();

const buildPoolConfig = (): PoolConfig | null => {
  if (!connectionString) return null;
  return {
    connectionString,
    max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: Number.parseInt(
      process.env.DB_IDLE_TIMEOUT_MS ?? "30000",
      10,
    ),
    connectionTimeoutMillis: Number.parseInt(
      process.env.DB_CONNECT_TIMEOUT_MS ?? "5000",
      10,
    ),
  };
};

const poolConfig = buildPoolConfig();
const pool = poolConfig ? new Pool(poolConfig) : null;

if (pool) {
  pool.on("error", (error) => {
    console.error("[db] pool error", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

const cache = new LruCache<string, QueryResult>(200, 60_000);

const normalizeSql = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 500);

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const isConnectionError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (!code) return false;
  return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(
    code,
  );
};

const wrapDbError = (
  error: unknown,
  context: { label: string; text: string; params: readonly unknown[] },
) => {
  const code = getErrorCode(error);
  const status = isConnectionError(error) ? 503 : 500;
  const message = error instanceof Error ? error.message : String(error);

  console.error("[db] query failed", {
    label: context.label,
    status,
    code,
    message,
    sql: normalizeSql(context.text),
    paramsCount: context.params.length,
  });

  return new DatabaseError("Database query failed", {
    status,
    code,
    cause: error,
  });
};

const buildCacheKey = (text: string, params: readonly unknown[]) => {
  const serializedParams = params.length ? JSON.stringify(params) : "";
  return `${text}::${serializedParams}`;
};

export const isPoolAvailable = (): boolean => pool !== null;

export const dbPool = () => pool;

export async function cachedQuery<T = unknown>(
  text: string,
  params: readonly unknown[] = [],
  options: { cacheKey?: string; ttlMs?: number } = {},
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new DatabaseError("Database not configured", { status: 503 });
  }

  const key = options.cacheKey ?? buildCacheKey(text, params);
  const cached = cache.get(key);
  if (cached) return cached as QueryResult<T>;

  try {
    const result = await pool.query<T>(text, params as unknown[]);
    cache.set(key, result as QueryResult, options.ttlMs);
    return result;
  } catch (error) {
    throw wrapDbError(error, { label: "cachedQuery", text, params });
  }
}

export async function query<T = unknown>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new DatabaseError("Database not configured", { status: 503 });
  }

  try {
    return await pool.query<T>(text, params as unknown[]);
  } catch (error) {
    throw wrapDbError(error, { label: "query", text, params });
  }
}

export async function pingDb(): Promise<void> {
  if (!pool) {
    throw new DatabaseError("Database not configured", { status: 503 });
  }
  await query("SELECT 1");
}
