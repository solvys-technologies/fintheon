// [claude-code 2026-04-20] S21: Frontend Omi API client.
// Wraps the authed /api/omi/* endpoints used by HeaderVoiceControl,
// PsychAssist widgets, and the Performance-tab chat button.
import { getAccessToken } from "./supabase";

const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined &&
  import.meta.env.VITE_API_URL !== null
    ? (import.meta.env.VITE_API_URL as string)
    : "http://localhost:8080";

export type OmiTrigger =
  | "psych_assist"
  | "voice_assistant"
  | "performance_chat";

export interface OmiSession {
  id: string;
  userId: string;
  trigger: OmiTrigger;
  primaryAgent: "coach" | "oracle" | "harper";
  status: "active" | "ended" | "error";
  startedAt: string;
  endedAt?: string;
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export async function startOmiSession(
  trigger: OmiTrigger,
): Promise<OmiSession | null> {
  const res = await authedFetch("/api/omi/session/start", {
    method: "POST",
    body: JSON.stringify({ trigger }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { session: OmiSession };
  return body.session;
}

export async function stopOmiSession(): Promise<void> {
  await authedFetch("/api/omi/session/stop", { method: "POST" });
}

export async function getActiveOmiSession(): Promise<OmiSession | null> {
  const res = await authedFetch("/api/omi/session/active");
  if (!res.ok) return null;
  const body = (await res.json()) as { session: OmiSession | null };
  return body.session ?? null;
}

export async function notifyOmi(
  message: string,
  title?: string,
  speak = true,
): Promise<boolean> {
  const res = await authedFetch("/api/omi/notify", {
    method: "POST",
    body: JSON.stringify({ title, message, speak }),
  });
  return res.ok;
}
