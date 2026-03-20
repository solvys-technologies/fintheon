// [claude-code 2026-03-09] Feature flags hook for skill permissions
import { useState, useEffect, useMemo } from 'react';

interface FeatureFlag {
  enabled: boolean;
  reason?: string;
}

type FeatureFlags = Record<string, FeatureFlag>;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

let cachedFlags: FeatureFlags | null = null;

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(cachedFlags ?? {});
  const [loaded, setLoaded] = useState(!!cachedFlags);

  useEffect(() => {
    if (cachedFlags) return;

    fetch(`${API_BASE}/api/ai/features`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data: FeatureFlags) => {
        cachedFlags = data;
        setFlags(data);
        setLoaded(true);
      })
      .catch(() => {
        // Fail open — if backend is down, allow all skills
        setLoaded(true);
      });
  }, []);

  const disabledSkills = useMemo(() => {
    const result: Record<string, { reason: string }> = {};
    for (const [id, flag] of Object.entries(flags)) {
      if (!flag.enabled) {
        result[id] = { reason: flag.reason || 'This skill is currently disabled.' };
      }
    }
    return result;
  }, [flags]);

  return {
    flags,
    loaded,
    disabledSkills,
    isSkillEnabled: (id: string) => {
      const flag = flags[id];
      return flag ? flag.enabled : true;
    },
    getDisabledReason: (id: string) => {
      const flag = flags[id];
      return flag && !flag.enabled ? flag.reason : undefined;
    },
  };
}
