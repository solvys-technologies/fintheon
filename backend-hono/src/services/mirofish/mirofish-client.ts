// [claude-code 2026-03-16] HTTP client for MiroFish simulation API

import type { MiroFishConfig, MiroFishSeed, MiroFishSimulation, MiroFishReport, MiroFishInjection } from './mirofish-types.js';

const DEFAULT_CONFIG: MiroFishConfig = {
  url: process.env.MIROFISH_URL || 'http://localhost:5001',
  enabled: process.env.MIROFISH_ENABLED === 'true',
  timeoutMs: 30_000,
};

export function getMiroFishConfig(): MiroFishConfig {
  return { ...DEFAULT_CONFIG };
}

export function isMiroFishEnabled(): boolean {
  return DEFAULT_CONFIG.enabled;
}

async function fetchMiroFish<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getMiroFishConfig();
  const url = `${config.url}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`MiroFish API error ${res.status}: ${text}`);
    }

    return await res.json() as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`MiroFish API timeout after ${config.timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Start a new simulation with the given seed */
export async function startSimulation(seed: MiroFishSeed): Promise<MiroFishSimulation> {
  return fetchMiroFish<MiroFishSimulation>('/api/simulate', {
    method: 'POST',
    body: JSON.stringify(seed),
  });
}

/** Check status of a running simulation */
export async function getSimulationStatus(simId: string): Promise<MiroFishSimulation> {
  return fetchMiroFish<MiroFishSimulation>(`/api/status/${simId}`);
}

/** Retrieve the final prediction report */
export async function getSimulationReport(simId: string): Promise<MiroFishReport> {
  return fetchMiroFish<MiroFishReport>(`/api/report/${simId}`);
}

/** Inject a variable into a running simulation ("God's Eye View") */
export async function injectVariable(
  simId: string,
  injection: MiroFishInjection,
): Promise<MiroFishSimulation> {
  return fetchMiroFish<MiroFishSimulation>(`/api/inject/${simId}`, {
    method: 'POST',
    body: JSON.stringify(injection),
  });
}

/** Health check — returns true if MiroFish is reachable */
export async function healthCheck(): Promise<boolean> {
  try {
    const config = getMiroFishConfig();
    const res = await fetch(`${config.url}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
