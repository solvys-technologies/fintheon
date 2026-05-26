const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface DeskMapDesk {
  id: string;
  name: string;
  slug: string;
  color: string;
  mapImageUrl: string | null;
  mapImagePrompt: string | null;
  mapImageUpdatedAt: string | null;
}

export async function fetchDeskMap(): Promise<DeskMapDesk> {
  const data = await requestJson<{ desk?: Partial<DeskMapDesk> }>(
    "/api/narrative/desk-map",
  );
  return normalizeDesk(data.desk);
}

export async function updateDeskMapImage(input: {
  mapImageUrl: string | null;
  mapImagePrompt: string | null;
}): Promise<DeskMapDesk> {
  const data = await requestJson<{ desk?: Partial<DeskMapDesk> }>(
    "/api/narrative/desk-map",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeDesk(data.desk);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `DeskMap ${response.status}`);
  }
  return data as T;
}

function normalizeDesk(value: Partial<DeskMapDesk> | undefined): DeskMapDesk {
  return {
    id: String(value?.id ?? "default"),
    name: String(value?.name ?? "Priced In Capital"),
    slug: String(value?.slug ?? "priced-in-capital"),
    color: String(value?.color ?? "#c79f4a"),
    mapImageUrl: toOptionalString(value?.mapImageUrl),
    mapImagePrompt: toOptionalString(value?.mapImagePrompt),
    mapImageUpdatedAt: toOptionalString(value?.mapImageUpdatedAt),
  };
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
