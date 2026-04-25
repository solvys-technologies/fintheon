// [claude-code 2026-04-25] S35-Unified: cross-device state-sync push.
//
// When a user reads / clears / dismisses a notification on one device, OR changes their
// notification preferences, the server fans a tiny "__sync" web-push event to every
// other subscription registered to that user. The service worker silently consumes
// it (no notification banner is shown) and posts a BroadcastChannel message to any
// open Fintheon tabs / mobile webviews so they refetch the bell + DND state.
//
// Why a real push event and not just a long-polled diff? Push reaches background
// PWAs and Electron windows that aren't focused — the bell badge stays accurate
// even when the user hasn't opened that tab in hours.
//
// The payload uses category="__sync" specifically so the SW knows to suppress UI
// rendering. Old service workers that don't recognize the marker will still try to
// render — that's why title/body are empty + silent=true.
import { sendToUserDirect, type PushPayload } from "../web-push-sender.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("NotifSync");

export type SyncKind =
  | "preferences"
  | "notification.read"
  | "notification.cleared"
  | "notifications.cleared_all"
  | "notifications.read_all";

export interface SyncEvent {
  kind: SyncKind;
  /** Notification id when the kind targets one row. Omitted for *_all kinds. */
  id?: string;
  /** ISO timestamp the change happened. Drives optimistic-UI reconciliation on receivers. */
  updatedAt: string;
  /** Endpoint of the originating device — receivers use this to skip self-echo. */
  originEndpoint?: string;
}

const SYNC_CATEGORY = "__sync" as const;

export async function broadcastSyncToUser(
  userId: string,
  event: Omit<SyncEvent, "updatedAt"> & { updatedAt?: string },
): Promise<number> {
  const payload: PushPayload & { sync?: SyncEvent } = {
    title: "",
    body: "",
    category: SYNC_CATEGORY,
  };
  // Attach the structured sync event under a reserved key the SW reads explicitly.
  payload.sync = {
    kind: event.kind,
    id: event.id,
    originEndpoint: event.originEndpoint,
    updatedAt: event.updatedAt ?? new Date().toISOString(),
  };

  try {
    return await sendToUserDirect(userId, payload);
  } catch (err) {
    log.warn("sync broadcast failed", {
      userId,
      kind: event.kind,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
