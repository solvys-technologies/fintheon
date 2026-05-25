// [claude-code 2026-04-15] T7: Push subscription management utilities

const API_BASE = import.meta.env.VITE_API_URL || "";
const BUILD_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

let runtimeVapidPublicKey: string | null = null;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

async function getVapidPublicKey(token: string): Promise<string | null> {
  if (BUILD_VAPID_PUBLIC_KEY) return BUILD_VAPID_PUBLIC_KEY;
  if (runtimeVapidPublicKey) return runtimeVapidPublicKey;

  const res = await fetch(`${API_BASE}/api/notifications/web-push/public-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { publicKey?: string };
  runtimeVapidPublicKey = data.publicKey || null;
  return runtimeVapidPublicKey;
}

export async function subscribeToPush(
  token: string,
  categories: Record<string, boolean>,
  severityThreshold?: string,
): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const vapidPublicKey = await getVapidPublicKey(token);
    if (!vapidPublicKey) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        .buffer as ArrayBuffer,
    });
  }

  const res = await fetch(`${API_BASE}/api/notifications/web-push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      categories,
      severityThreshold,
    }),
  });
  return res.ok;
}

export async function unsubscribeFromPush(token: string): Promise<boolean> {
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return false;

  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const res = await fetch(
    `${API_BASE}/api/notifications/web-push/unsubscribe`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    },
  );
  return res.ok;
}

export async function updateCategories(
  token: string,
  categories: Record<string, boolean>,
  severityThreshold?: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/notifications/web-push/preferences`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ categories, severityThreshold }),
    },
  );
  return res.ok;
}
