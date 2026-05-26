import {
  buildResponse,
  buildSessionList,
  makeSession,
  mockDesk,
  mockHeadlines,
  sessionDetails,
} from "./mock-data";
import {
  createNarrativeFlowMockEventSource,
  handleMockAgentRequest,
} from "./mock-agent";

let isInstalled = false;
let desk = { ...mockDesk };
let forecasts: any[] = [];

export function installNarrativeFlowMockApi() {
  if (isInstalled) return;
  isInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = normalizeRequest(input, init);
    const mocked = handleMockRequest(request);
    if (mocked) return mocked;
    return originalFetch(input, init);
  };
  window.EventSource = createNarrativeFlowMockEventSource();
}

function handleMockRequest(request: {
  path: string;
  method: string;
  body: any;
}) {
  const agentMock = handleMockAgentRequest(request);
  if (agentMock) return agentMock;
  if (request.path === "/api/themes") {
    return json({ themes: [], count: 0 });
  }
  if (request.path.startsWith("/api/harper-ops/feed")) {
    return json({ entries: [], total: 0 });
  }
  if (request.path === "/api/harper-ops/status") {
    return json({
      loop: {
        alive: true,
        state: "watching",
        lastHeartbeat: new Date().toISOString(),
        lastTaskCompleted: null,
        queueDepth: 0,
        consecutiveFailures: 0,
        heartbeatCount: 12,
        totalTasksCompleted: 3,
      },
      ops: {
        alive: true,
        lastHeartbeat: new Date().toISOString(),
        lastActivity: null,
        pendingApprovals: 0,
        totalEntries: 0,
      },
    });
  }
  if (request.path.startsWith("/api/market-data/iv-score")) {
    return json({
      score: 8.1,
      eventCount: 9,
      rationale: [
        "Grid reserve pressure and AI load growth lifted infrastructure sensitivity.",
      ],
      prediction: {
        confidence: 0.72,
        scenarios: [{ label: "Power bottlenecks lead" }],
      },
    });
  }
  if (request.path.startsWith("/api/riskflow/feed")) {
    return json({ items: mockHeadlines });
  }
  if (request.path === "/api/narrative/desk-map") {
    if (request.method === "PATCH")
      desk = {
        ...desk,
        ...request.body,
        mapImageUpdatedAt: new Date().toISOString(),
      };
    return json({ desk });
  }
  if (request.path === "/api/narrative/sensemaking") {
    return json(
      buildResponse(
        request.body?.attachedHeadlineIds ?? [
          "rf-grid",
          "rf-ai-load",
          "rf-transformers",
        ],
      ),
    );
  }
  if (request.path === "/api/narrative/sessions" && request.method === "GET") {
    return json({ sessions: buildSessionList() });
  }
  if (request.path === "/api/narrative/sessions" && request.method === "POST") {
    const id = `session-${Date.now()}`;
    const detail = makeSession({
      id,
      title: String(request.body?.title ?? "New NarrativeFlow workspace"),
      color: String(request.body?.color ?? "#c79f4a"),
      catalystIds: request.body?.catalystIds ?? [
        "rf-grid",
        "rf-ai-load",
        "rf-transformers",
      ],
    });
    sessionDetails[id] = detail;
    return json({ session: detail }, 201);
  }
  if (request.path === "/api/coliseum/forecasts" && request.method === "GET") {
    return json({ forecasts });
  }
  if (request.path === "/api/coliseum/forecasts" && request.method === "POST") {
    const forecast = {
      id: `forecast-${Date.now()}`,
      deskId: request.body?.deskId ?? "default",
      title: request.body?.title ?? "NarrativeFlow forecast draft",
      thesis: request.body?.thesis ?? "",
      probability: request.body?.probability ?? null,
      direction: request.body?.direction ?? null,
      timeframe: request.body?.timeframe ?? "1-4 weeks",
      validationRule: request.body?.validationRule ?? "",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      catalysts: (request.body?.catalystIds ?? []).map(
        (riskflowItemId: string) => ({ riskflowItemId }),
      ),
      marketReferences: request.body?.marketReferences ?? [],
    };
    forecasts = [forecast, ...forecasts];
    return json({ forecast }, 201);
  }
  const forecastPublishMatch = request.path.match(
    /^\/api\/coliseum\/forecasts\/([^/]+)\/publish$/,
  );
  if (forecastPublishMatch && request.method === "POST") {
    forecasts = forecasts.map((forecast) =>
      forecast.id === decodeURIComponent(forecastPublishMatch[1])
        ? {
            ...forecast,
            status: "published",
            updatedAt: new Date().toISOString(),
          }
        : forecast,
    );
    return json({
      forecast: forecasts.find(
        (forecast) =>
          forecast.id === decodeURIComponent(forecastPublishMatch[1]),
      ),
    });
  }
  const sessionMatch = request.path.match(
    /^\/api\/narrative\/sessions\/([^/]+)(?:\/(.*))?$/,
  );
  if (!sessionMatch) return null;
  return handleSessionRequest(
    decodeURIComponent(sessionMatch[1]),
    sessionMatch[2] ?? "",
    request,
  );
}

function handleSessionRequest(
  id: string,
  rest: string,
  request: { method: string; body: any },
) {
  const detail = sessionDetails[id];
  if (!detail) return json({ error: "Narrative session not found" }, 404);
  if (!rest && request.method === "GET") return json({ session: detail });
  if (!rest && request.method === "DELETE") {
    delete sessionDetails[id];
    return json({ ok: true });
  }
  if (!rest && request.method === "PATCH") {
    Object.assign(detail, request.body, {
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return json({ session: detail });
  }
  if (rest === "messages" && request.method === "POST") {
    detail.messages = [
      ...(detail.messages ?? []),
      {
        id: `${id}-m${Date.now()}`,
        role: request.body?.role ?? "user",
        content: request.body?.content ?? "",
        created_at: new Date().toISOString(),
      },
    ];
    return json({ ok: true }, 201);
  }
  const artifactMatch = rest.match(/^artifacts\/([^/]+)$/);
  if (artifactMatch && request.method === "PUT") {
    detail.artifacts = {
      ...(detail.artifacts ?? {}),
      [artifactMatch[1]]: { payload: request.body?.payload ?? {} },
    };
    detail.generatedAt = new Date().toISOString();
    return json({ ok: true });
  }
  return json({ error: "Unhandled NarrativeFlow sandbox route" }, 404);
}

function normalizeRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    window.location.href,
  );
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const rawBody = init?.body;
  return {
    path: url.pathname,
    method,
    body: typeof rawBody === "string" ? safeJson(rawBody) : null,
  };
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
