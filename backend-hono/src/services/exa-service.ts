// [claude-code 2026-03-09] Exa Search API client for deep-research flow
// Graceful: never throws, returns empty results on failure

export interface ExaSearchResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

interface ExaSearchOptions {
  numResults?: number;
  type?: "auto" | "neural" | "keyword";
  useAutoprompt?: boolean;
  includeDomains?: string[];
}

const EXA_API_URL = "https://api.exa.ai/search";

function getApiKey(): string | undefined {
  return process.env.EXA_API_KEY || undefined;
}

export function isExaAvailable(): boolean {
  return Boolean(getApiKey());
}

export async function exaSearch(
  query: string,
  options: ExaSearchOptions = {},
): Promise<ExaSearchResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log("[Exa] API key not configured, skipping research");
    return [];
  }

  const {
    numResults = 5,
    type = "auto",
    useAutoprompt = true,
    includeDomains,
  } = options;

  try {
    const body: Record<string, unknown> = {
      query,
      numResults,
      type,
      useAutoprompt,
      contents: {
        text: { maxCharacters: 500 },
      },
    };
    if (includeDomains?.length) body.includeDomains = includeDomains;

    const response = await fetch(EXA_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(
        `[Exa] Search failed: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        text?: string;
        publishedDate?: string;
      }>;
    };

    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      text: r.text ?? "",
      publishedDate: r.publishedDate,
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown";
    console.error(`[Exa] Search error: ${msg}`);
    return [];
  }
}

export function formatExaContext(results: ExaSearchResult[]): string {
  if (results.length === 0) return "";

  const lines = results.map((r, i) => {
    const date = r.publishedDate ? ` (${r.publishedDate.split("T")[0]})` : "";
    const snippet = r.text.length > 300 ? r.text.slice(0, 300) + "..." : r.text;
    return `Source ${i + 1}: ${r.title}${date}\n${r.url}\n${snippet}`;
  });

  return `[RESEARCH CONTEXT — via Exa]\n${lines.join("\n\n")}\n[END RESEARCH CONTEXT]`;
}
