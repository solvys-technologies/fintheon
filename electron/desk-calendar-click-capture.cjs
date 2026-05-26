const PREFIX = "__FINTHEON_DESK_CALENDAR_CLICK__";

function installDeskCalendarClickCapture({ win, getApiBase }) {
  win.webContents.on("did-attach-webview", (_event, webContents) => {
    const arm = () => {
      if (webContents.isDestroyed()) return;
      if (!webContents.getURL().includes("tradingview.com/economic-calendar")) {
        return;
      }
      webContents.executeJavaScript(CAPTURE_SCRIPT, true).catch((err) => {
        console.warn("[DeskCal] click capture injection failed:", err?.message);
      });
    };

    webContents.on("did-finish-load", arm);
    webContents.on("did-navigate", arm);
    webContents.on("console-message", (_event, _level, message) => {
      if (!message.startsWith(PREFIX)) return;
      handleCapturedClick({
        win,
        apiBase: getApiBase(),
        payload: message.slice(PREFIX.length),
      });
    });
    arm();
  });
}

function resolveEventTitle(event) {
  if (event.eventTitle && !isCountryLabel(event.eventTitle)) {
    return event.eventTitle;
  }
  if (event.eventName && !isCountryLabel(event.eventName)) {
    return event.eventName;
  }
  const lines = String(event.description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => !isCountryLabel(line)) ||
    event.eventName ||
    "TradingView event"
  );
}

function isCountryLabel(value) {
  return /^(us|usa|nz|au|jp|gb|uk|eu|ca|cn|ch)$/i.test(
    String(value || "").trim(),
  );
}

async function handleCapturedClick({ win, apiBase, payload }) {
  const send = (channel, body) => {
    if (!win.isDestroyed()) win.webContents.send(channel, body ?? {});
  };
  try {
    const event = JSON.parse(payload);
    const ics = buildIcs(event);
    send("desk-calendar:saving");
    const res = await fetch(`${apiBase}/api/desk/calendar/ingest-ics`, {
      method: "POST",
      headers: { "Content-Type": "text/calendar" },
      body: ics,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.json().catch(() => ({}));
    const first = Array.isArray(body.events) ? body.events[0] : null;
    send("desk-calendar:saved", {
      ingested: Number(body.ingested ?? 0),
      title: first?.title ?? event.eventName ?? null,
      starts_at: first?.starts_at ?? event.startsAt ?? null,
      queueCount: Number(body.queueCount ?? 0),
    });
  } catch (err) {
    send("desk-calendar:failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

function buildIcs(event) {
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new Error("TradingView event did not expose a usable start time");
  }
  const end = new Date(start.getTime() + 90 * 60_000);
  const summary = resolveEventTitle(event);
  const description = [
    `Country: ${event.country || "US"}`,
    `Symbol: ${event.symbol || ""}`,
    event.forecast ? `Forecast: ${event.forecast}` : "",
    event.previous ? `Previous: ${event.previous}` : "",
    event.description || "",
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fintheon//TradingView Capture//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid || stableUid(event)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${event.pageUrl || "https://www.tradingview.com/economic-calendar/"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function stableUid(event) {
  const symbol = String(event.symbol || "event").replace(/[^a-z0-9-]/gi, "-");
  const stamp = String(event.startsAt || Date.now()).replace(/[^a-z0-9]/gi, "");
  return `fintheon-tv-click-${symbol}-${stamp}@fintheon`;
}

function formatIcsDate(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

const CAPTURE_SCRIPT = `(() => {
  if (window.__fintheonDeskCalendarClickCapture) return;
  window.__fintheonDeskCalendarClickCapture = true;
  const prefix = "${PREFIX}";
  const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const linesOf = (node) => String(node?.innerText || "")
    .split("\\n")
    .map(clean)
    .filter(Boolean);
  const firstValueAfter = (lines, label) => {
    const i = lines.findIndex((line) => line.toLowerCase() === label);
    if (i === -1) return "";
    return lines[i + 1] || "";
  };
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.('[data-name="add-to-calendar-button"]');
    if (!button) return;
    const item = button.closest('[data-name="economic-calendar-item"]');
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    const lines = linesOf(item);
    const stop = lines.findIndex((line) => line === "Launch chart");
    const useful = stop === -1 ? lines : lines.slice(0, stop);
    const time = item.querySelector("time[datetime]");
    const startsAt = time?.getAttribute("datetime") || new Date().toISOString();
    const eventTitle = clean(item.querySelector('[class*="titleText"]')?.textContent)
      || useful.find((line) => !/^(us|usa|nz|au|jp|gb|uk|eu|ca|cn|ch)$/i.test(line))
      || item.getAttribute("data-symbol")
      || "TradingView event";
    const payload = {
      eventName: eventTitle,
      eventTitle,
      startsAt,
      country: item.getAttribute("data-country") || "",
      symbol: item.getAttribute("data-symbol") || "",
      forecast: firstValueAfter(lines, "Forecast"),
      previous: firstValueAfter(lines, "Prior"),
      description: lines.join("\\n").slice(0, 1800),
      pageUrl: location.href,
    };
    console.info(prefix + JSON.stringify(payload));
  }, true);
})();`;

module.exports = { installDeskCalendarClickCapture };
