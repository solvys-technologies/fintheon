import type { QueuedNotification } from "../contexts/DNDContext";
import type { ServerNotification } from "../contexts/NotificationsContext";

const ERROR_TEXT_RE =
  /\b(error|failed|failure|internal server|backend down|critical)\b/i;

export function categoryToQueuedType(
  category: string,
): QueuedNotification["type"] {
  switch (category) {
    case "riskflow":
      return "news";
    case "dailyBrief":
    case "lexiconProposals":
      return "system";
    case "regimeActivations":
    case "regimeProposals":
    case "walkBackReverts":
      return "iv";
    case "toolApprovals":
    case "maintenance_request":
      return "trade";
    case "chat_relay":
      return "system";
    default:
      return "system";
  }
}

export function isErrorServerNotification(
  notification: ServerNotification,
): boolean {
  if (notification.severity === "critical") return true;
  return ERROR_TEXT_RE.test(`${notification.title} ${notification.body}`);
}

export function isErrorQueuedNotification(
  notification: QueuedNotification,
): boolean {
  if (notification.severity === "error") return true;
  return ERROR_TEXT_RE.test(`${notification.title} ${notification.message}`);
}

export function getNotificationDotTone(
  serverNotifications: ServerNotification[],
  queue: QueuedNotification[],
): "error" | "primary" | "none" {
  const hasError =
    serverNotifications.some(isErrorServerNotification) ||
    queue.some(isErrorQueuedNotification);
  if (hasError) return "error";

  const hasUnreadServer = serverNotifications.some((item) => !item.read);
  if (hasUnreadServer || queue.length > 0) return "primary";
  return "none";
}
