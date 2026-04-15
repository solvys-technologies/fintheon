// [claude-code 2026-04-15] T4: Daily brief hook — fetches MDB from backend NotionService
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getMobileBackend } from "../lib/backend";

interface BriefItem {
  title: string;
  detail: string;
}

interface BriefingState {
  items: BriefItem[];
  briefType?: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBriefing(): BriefingState {
  const { getAccessToken } = useAuth();
  const [items, setItems] = useState<BriefItem[]>([]);
  const [briefType, setBriefType] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const backend = getMobileBackend(getAccessToken);
      const res = await backend.notion.getMdbBrief();
      setItems(res.items ?? []);
      setBriefType(res.briefType);
    } catch {
      setError("Failed to load brief");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { items, briefType, isLoading, error, refresh: fetch_ };
}
