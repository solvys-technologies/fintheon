import {
  ProjectXAccountSchema,
  ProjectXAuthResponseSchema,
  ProjectXTradeSchema,
  type ProjectXAccount,
  type ProjectXCredentials,
  type ProjectXTrade,
} from "./types.js";

const API_BASE = process.env.PROJECTX_API_URL ?? "https://api.topstepx.com";
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

function cacheKey(credentials: ProjectXCredentials): string {
  return `${credentials.source}:${credentials.userId}:${credentials.username}`;
}

function gatewayError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

async function requestToken(credentials: ProjectXCredentials): Promise<string> {
  if (!credentials.username || !credentials.apiKey) {
    throw gatewayError(400, "ProjectX userName and apiKey are required");
  }

  const cached = tokenCache.get(cacheKey(credentials));
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`${API_BASE}/api/Auth/loginKey`, {
    method: "POST",
    headers: { accept: "text/plain", "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: credentials.username,
      apiKey: credentials.apiKey,
    }),
  });

  const body = await parseJson(res);
  if (!res.ok)
    throw gatewayError(res.status, `ProjectX auth failed: ${res.status}`);

  const parsed = ProjectXAuthResponseSchema.safeParse(body);
  if (!parsed.success || !parsed.data.token || parsed.data.success === false) {
    throw gatewayError(
      401,
      parsed.data?.errorMessage ?? "ProjectX auth failed",
    );
  }

  tokenCache.set(cacheKey(credentials), {
    token: parsed.data.token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return parsed.data.token;
}

async function projectXPost<T>(
  credentials: ProjectXCredentials,
  path: string,
  payload: Record<string, unknown>,
  parse: (body: unknown) => T,
): Promise<T> {
  const token = await requestToken(credentials);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      accept: "text/plain",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const error = gatewayError(
      res.status,
      `ProjectX request failed: ${res.status}`,
    );
    throw error;
  }
  return parse(body);
}

export async function searchProjectXAccounts(
  credentials: ProjectXCredentials,
): Promise<ProjectXAccount[]> {
  return projectXPost(
    credentials,
    "/api/Account/search",
    {
      onlyActiveAccounts: true,
    },
    (body) => {
      const raw = body as { accounts?: unknown[] };
      return (raw.accounts ?? [])
        .map((account) => ProjectXAccountSchema.safeParse(account))
        .filter((result) => result.success)
        .map((result) => result.data);
    },
  );
}

export async function searchProjectXTrades(
  credentials: ProjectXCredentials,
  accountId: number,
  from: string,
  to: string,
): Promise<ProjectXTrade[]> {
  return projectXPost(
    credentials,
    "/api/Trade/search",
    {
      accountId,
      startTimestamp: from,
      endTimestamp: to,
    },
    (body) => {
      const raw = body as { trades?: unknown[] };
      return (raw.trades ?? [])
        .map((trade) => ProjectXTradeSchema.safeParse(trade))
        .filter((result) => result.success)
        .map((result) => result.data)
        .filter((trade) => trade.voided !== true);
    },
  );
}
