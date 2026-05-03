// [claude-code 2026-05-03] Cross-device round-robin coordination for RiskFlow X polling.
// Uses Supabase singleton row riskflow_polling_coordinator as a distributed lock.
// 90-min rotation per device. Fallback: advance through online peers until one claims;
// if none available, the fallback_device ("main") takes over.
//
// Each Mac mini runs its own riskflow-worker. Only the active device polls X.
// All others sleep until their rotation slot arrives or the active device goes stale.

import { getSupabaseClient } from "../../config/supabase.js";
import { hostname } from "node:os";

const COORDINATOR_ROW_ID = 1;
const ROTATION_INTERVAL_MINUTES =
  Number(process.env.POLLING_ROTATION_MINUTES) || 90;
const ROTATION_INTERVAL_MS = ROTATION_INTERVAL_MINUTES * 60_000;
const STALE_THRESHOLD_MS = 5 * 60_000; // 5 min without heartbeat = offline
const CHECK_INTERVAL_MS = 30_000; // how often sleepers re-check
const DEVICE_ID = process.env.POLLING_DEVICE_ID ?? hostname();

interface CoordinatorRow {
  id: number;
  active_device_id: string | null;
  polling_started_at: string | null;
  rotation_interval_minutes: number;
  last_success_at: string | null;
  fallback_device_id: string;
  updated_at: string;
}

async function readCoordinator(): Promise<CoordinatorRow | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("riskflow_polling_coordinator")
    .select("*")
    .eq("id", COORDINATOR_ROW_ID)
    .single();
  if (error || !data) return null;
  return data as CoordinatorRow;
}

async function updateCoordinator(
  fields: Partial<CoordinatorRow>,
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { error } = await sb
    .from("riskflow_polling_coordinator")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", COORDINATOR_ROW_ID);
  return !error;
}

/**
 * Fetch the ordered list of peers who have opted into X contribution.
 * Uses claude_peers where capabilities includes "x-contributor" and
 * heartbeat is fresh (within STALE_THRESHOLD_MS).
 */
async function getXContributorPeers(): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const { data, error } = await sb
    .from("claude_peers")
    .select("device_name, id")
    .gte("heartbeat_at", cutoff)
    .contains("capabilities", ["x-contributor"])
    .order("created_at");
  if (error || !data) return [];
  return data.map((p: { device_name: string; id: string }) => p.device_name);
}

async function isPeerOnline(peerId: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const { data } = await sb
    .from("claude_peers")
    .select("device_name")
    .eq("device_name", peerId)
    .gte("heartbeat_at", cutoff)
    .single();
  return !!data;
}

/**
 * Claim the active polling slot for this device.
 * Only succeeds if the coordinator row is unclaimed or the current owner
 * has exceeded their rotation interval.
 */
async function claimSlot(deviceId: string): Promise<boolean> {
  const row = await readCoordinator();
  if (!row) return false;

  const now = Date.now();
  const currentOwner = row.active_device_id;
  const startedAt = row.polling_started_at
    ? Date.parse(row.polling_started_at)
    : 0;
  const rotationExpired =
    currentOwner === deviceId
      ? false
      : now - startedAt > ROTATION_INTERVAL_MS;

  if (!currentOwner || rotationExpired) {
    return updateCoordinator({
      active_device_id: deviceId,
      polling_started_at: new Date().toISOString(),
    });
  }

  if (currentOwner === deviceId) return true;

  const peerOnline = await isPeerOnline(currentOwner);
  if (!peerOnline) {
    return updateCoordinator({
      active_device_id: deviceId,
      polling_started_at: new Date().toISOString(),
    });
  }

  return false;
}

/**
 * Advance the rotation to the next available X-contributor peer.
 * If no peers are online, fall back to the fallback_device_id (main).
 * Returns the new active device ID.
 */
async function advanceRotation(): Promise<string | null> {
  const row = await readCoordinator();
  if (!row) return null;

  const peers = await getXContributorPeers();
  const currentOwner = row.active_device_id;

  if (peers.length === 0) {
    const fallback = row.fallback_device_id || "main";
    await updateCoordinator({
      active_device_id: fallback,
      polling_started_at: new Date().toISOString(),
    });
    return fallback;
  }

  const currentIdx = currentOwner ? peers.indexOf(currentOwner) : -1;
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % peers.length : 0;

  for (let i = 0; i < peers.length; i++) {
    const candidate = peers[(nextIdx + i) % peers.length];
    if (candidate === currentOwner) continue;
    const online = await isPeerOnline(candidate);
    if (online) {
      await updateCoordinator({
        active_device_id: candidate,
        polling_started_at: new Date().toISOString(),
      });
      return candidate;
    }
  }

  const fallback = row.fallback_device_id || "main";
  await updateCoordinator({
    active_device_id: fallback,
    polling_started_at: new Date().toISOString(),
  });
  return fallback;
}

/**
 * Record a successful poll cycle for this device.
 */
async function recordSuccess(deviceId: string): Promise<void> {
  await updateCoordinator({ last_success_at: new Date().toISOString() });
}

/**
 * Check rotation: if this device's slot has expired, try to advance.
 * Returns true if this device should continue polling.
 */
async function checkAndRotate(deviceId: string): Promise<boolean> {
  const row = await readCoordinator();
  if (!row) return false;

  if (row.active_device_id !== deviceId) return false;

  const startedAt = row.polling_started_at
    ? Date.parse(row.polling_started_at)
    : 0;
  if (Date.now() - startedAt > ROTATION_INTERVAL_MS) {
    const next = await advanceRotation();
    return next === deviceId;
  }

  return true;
}

/**
 * Main coordination entrypoint called before each poll cycle.
 * Returns true if this worker should poll now, false if it should sleep.
 */
export async function shouldPollThisCycle(): Promise<boolean> {
  const row = await readCoordinator();
  if (!row) {
    logCoord("no_coordinator_row", "supabase unavailable — polling anyway");
    return true;
  }

  if (row.active_device_id === DEVICE_ID) {
    const shouldContinue = await checkAndRotate(DEVICE_ID);
    if (!shouldContinue) {
      logCoord("yielded", `rotation handed off to another device`);
      return false;
    }
    return true;
  }

  const claimed = await claimSlot(DEVICE_ID);
  if (claimed) {
    logCoord("claimed", `now active poller`);
    return true;
  }

  return false;
}

export async function recordCycleSuccess(): Promise<void> {
  await recordSuccess(DEVICE_ID);
}

export async function releaseSlot(): Promise<void> {
  const row = await readCoordinator();
  if (row && row.active_device_id === DEVICE_ID) {
    await updateCoordinator({ active_device_id: null });
    logCoord("released", "shutting down");
  }
}

export function getDeviceId(): string {
  return DEVICE_ID;
}

export function getCheckIntervalMs(): number {
  return CHECK_INTERVAL_MS;
}

export function getRotationIntervalMs(): number {
  return ROTATION_INTERVAL_MS;
}

function logCoord(stage: string, message: string) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "riskflow-worker",
      stage: `coord_${stage}`,
      device: DEVICE_ID,
      message,
    }),
  );
}
