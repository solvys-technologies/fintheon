// [claude-code 2026-04-16] S20-T9: Service health registry — background services register last-run + error count

import { createLogger } from "../lib/logger.js";

const log = createLogger("HealthRegistry");

interface ServiceEntry {
  name: string;
  lastRunAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
  registeredAt: string;
}

const registry = new Map<string, ServiceEntry>();

export function register(serviceName: string): void {
  if (registry.has(serviceName)) return;
  registry.set(serviceName, {
    name: serviceName,
    lastRunAt: null,
    lastErrorAt: null,
    lastError: null,
    runCount: 0,
    errorCount: 0,
    registeredAt: new Date().toISOString(),
  });
}

export function recordRun(serviceName: string): void {
  const entry = registry.get(serviceName);
  if (!entry) {
    register(serviceName);
    return recordRun(serviceName);
  }
  entry.lastRunAt = new Date().toISOString();
  entry.runCount++;
}

export function recordError(serviceName: string, err: unknown): void {
  const entry = registry.get(serviceName);
  if (!entry) {
    register(serviceName);
    return recordError(serviceName, err);
  }
  entry.lastErrorAt = new Date().toISOString();
  entry.lastError = err instanceof Error ? err.message : String(err);
  entry.errorCount++;
}

export function getStatus(): {
  services: ServiceEntry[];
  totalRegistered: number;
  totalErrors: number;
} {
  const services = Array.from(registry.values());
  return {
    services,
    totalRegistered: services.length,
    totalErrors: services.reduce((sum, s) => sum + s.errorCount, 0),
  };
}

export function getServiceStatus(
  serviceName: string,
): ServiceEntry | undefined {
  return registry.get(serviceName);
}
