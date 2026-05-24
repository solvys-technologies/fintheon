// [claude-code 2026-05-03] S58-T1: DeepSeek direct and OC API health checks.
const DEEPSEEK_MODEL = "deepseek-reasoner";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const OC_API_BASE_URL = "http://localhost:8081/v1";

function normalizeUrl(raw: string): string {
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

function getDeepSeekDirectBaseUrl(): string {
  return normalizeUrl(process.env.DEEPSEEK_API_BASE_URL || DEEPSEEK_BASE_URL);
}

function getOpenCodeGoBaseUrl(): string {
  return normalizeUrl(
    process.env.OPENCODE_GO_API_URL ||
      process.env.HERMES_API_URL ||
      OC_API_BASE_URL,
  );
}

async function checkOpenAiCompatHealth(
  baseUrl: string,
  apiKey: string,
): Promise<{ available: boolean; error: string | null }> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`models endpoint returned ${res.status}`);
    return { available: true, error: null };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkDeepSeekDirectHealth(): Promise<{
  available: boolean;
  error: string | null;
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { available: false, error: "DEEPSEEK_API_KEY not set" };
  return checkOpenAiCompatHealth(getDeepSeekDirectBaseUrl(), apiKey);
}

export async function checkDeepSeekOcApiHealth(): Promise<{
  available: boolean;
  error: string | null;
}> {
  const apiKey =
    process.env.OPENCODE_GO_API_KEY ||
    process.env.HERMES_API_KEY ||
    "opencode-go";
  return checkOpenAiCompatHealth(getOpenCodeGoBaseUrl(), apiKey);
}
