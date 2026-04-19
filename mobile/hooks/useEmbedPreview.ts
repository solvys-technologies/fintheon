// [claude-code 2026-04-19] S25: fetch + cache OG preview metadata for EmbedPreview component.
//   Module-scoped Map cache (10-min TTL) keyed on URL so tapping into the same headline again
//   feels instant. Abort controller prevents a stale fetch from clobbering current state.
import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const TTL_MS = 10 * 60 * 1000;

export type EmbedKind = "tweet" | "youtube" | "generic";

export interface OgPreview {
  url: string;
  kind: EmbedKind;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  embedUrl?: string;
}

interface CacheEntry {
  at: number;
  preview: OgPreview | null;
}

const cache = new Map<string, CacheEntry>();

export function useEmbedPreview(url: string | null | undefined) {
  const [preview, setPreview] = useState<OgPreview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cache.get(url);
    if (cached && Date.now() - cached.at < TTL_MS) {
      setPreview(cached.preview);
      setIsLoading(false);
      setError(cached.preview ? null : "Preview unavailable");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/preview/og?url=${encodeURIComponent(url)}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          cache.set(url, { at: Date.now(), preview: null });
          setPreview(null);
          setError(`Preview unavailable (${res.status})`);
          return;
        }
        const data = (await res.json()) as OgPreview;
        cache.set(url, { at: Date.now(), preview: data });
        setPreview(data);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError("Preview failed");
      } finally {
        setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [url]);

  return { preview, isLoading, error };
}
