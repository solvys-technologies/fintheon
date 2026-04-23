/**
 * Harper Vision Frontend API Client
 * Talks to /api/harper-vision endpoints
 */

import { API_BASE_URL } from "../components/chat/constants";

async function authHeaders(): Promise<Record<string, string>> {
  const token = localStorage.getItem("supabase_access_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getVisionStatus() {
  const res = await fetch(`${API_BASE_URL}/api/harper-vision/status`, {
    headers: await authHeaders(),
  });
  return res.json();
}

export async function getRecentFrames(options?: { sessionId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  if (options?.limit) params.set("limit", String(options.limit));
  const res = await fetch(`${API_BASE_URL}/api/harper-vision/frames?${params}`, {
    headers: await authHeaders(),
  });
  return res.json();
}

export async function getScene(options?: { sessionId?: string; lookback?: number }) {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  if (options?.lookback) params.set("lookback", String(options.lookback));
  const res = await fetch(`${API_BASE_URL}/api/harper-vision/scene?${params}`, {
    headers: await authHeaders(),
  });
  return res.json();
}

export async function detectTriggers(options?: { sessionId?: string; lookbackSeconds?: number }) {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  if (options?.lookbackSeconds) params.set("lookbackSeconds", String(options.lookbackSeconds));
  const res = await fetch(`${API_BASE_URL}/api/harper-vision/triggers?${params}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return res.json();
}
