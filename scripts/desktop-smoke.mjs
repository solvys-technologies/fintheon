#!/usr/bin/env node

const CDP_URL = process.env.FINTHEON_CDP_URL || "http://127.0.0.1:9222";
const API_BASE = process.env.FINTHEON_API_BASE || "http://127.0.0.1:8080";
const BUTTON_SELECTOR = '[data-name="add-to-calendar-button"]';

async function main() {
  const targets = await readTargets();
  const appTarget = targets.find((target) => target.title === "Fintheon");
  const calendarTarget = targets.find((target) =>
    String(target.url || "").includes("tradingview.com/economic-calendar"),
  );

  if (!appTarget) fail("Fintheon desktop target is not open on Electron CDP");
  if (!calendarTarget) {
    fail("TradingView economic-calendar webview is not open on Electron CDP");
  }

  let button = await findButton(calendarTarget.webSocketDebuggerUrl);
  if (!button?.present) {
    await expandCalendarItem(calendarTarget.webSocketDebuggerUrl);
    await sleep(1000);
    button = await findButton(calendarTarget.webSocketDebuggerUrl);
  }

  if (!button?.present) {
    fail("TradingView Add to calendar button is not detectable in the webview");
  }

  const queueBefore = await readQueueStatus();
  let queueAfter = null;
  if (process.env.FINTHEON_DESKTOP_SMOKE_CLICK === "1") {
    await evaluate(calendarTarget.webSocketDebuggerUrl, `
      (() => {
        const el = document.querySelector(${JSON.stringify(BUTTON_SELECTOR)});
        if (!el) return false;
        el.click();
        return true;
      })()
    `);
    await sleep(1800);
    queueAfter = await readQueueStatus();
    if (!queueAfter || queueAfter.count < queueBefore.count) {
      fail("Desk Calendar queue did not survive the Add to calendar click");
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        app: { title: appTarget.title, url: appTarget.url },
        calendar: { title: calendarTarget.title, url: calendarTarget.url },
        button,
        queueBefore,
        queueAfter,
      },
      null,
      2,
    ),
  );
}

async function findButton(webSocketDebuggerUrl) {
  return evaluate(webSocketDebuggerUrl, `
    (() => {
      const el = document.querySelector(${JSON.stringify(BUTTON_SELECTOR)});
      if (!el) return { present: false };
      const rect = el.getBoundingClientRect();
      return {
        present: true,
        text: el.textContent.trim(),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    })()
  `);
}

async function expandCalendarItem(webSocketDebuggerUrl) {
  const rect = await evaluate(webSocketDebuggerUrl, `
    (() => {
      const items = [...document.querySelectorAll('[data-name="economic-calendar-item"]')];
      const item = items.find((node) => node.querySelector("time[datetime]")) || items[0];
      if (!item) return null;
      item.scrollIntoView({ block: "center" });
      const title = item.querySelector('[class*="title"]') || item;
      const box = title.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    })()
  `);
  if (!rect) return false;
  await dispatchMouseClick(webSocketDebuggerUrl, rect);
  return true;
}

async function readTargets() {
  const res = await fetch(`${CDP_URL}/json/list`);
  if (!res.ok) fail(`Electron CDP is not reachable: ${res.status}`);
  return res.json();
}

async function readQueueStatus() {
  const res = await fetch(`${API_BASE}/api/desk/calendar/status`).catch(
    () => null,
  );
  if (!res?.ok) return { count: -1, reachable: false };
  return res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(webSocketDebuggerUrl, expression) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const body = JSON.parse(event.data);
    const entry = pending.get(body.id);
    if (!entry) return;
    pending.delete(body.id);
    if (body.error) entry.reject(new Error(body.error.message));
    else entry.resolve(body.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const id = nextId++;
  const resultPromise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  ws.send(
    JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true, awaitPromise: true },
    }),
  );
  const result = await resultPromise;
  ws.close();

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function dispatchMouseClick(webSocketDebuggerUrl, rect) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const body = JSON.parse(event.data);
    const entry = pending.get(body.id);
    if (!entry) return;
    pending.delete(body.id);
    if (body.error) entry.reject(new Error(body.error.message));
    else entry.resolve(body.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = (method, params) => {
    const id = nextId++;
    const result = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    ws.send(JSON.stringify({ id, method, params }));
    return result;
  };

  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rect.x,
    y: rect.y,
    button: "none",
  });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  ws.close();
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
