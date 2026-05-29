import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  createColiseumForecast,
  type ColiseumForecast,
} from "../../lib/coliseum-api";
import {
  fetchNarrativeSession,
  saveNarrativeArtifact,
} from "../../lib/narrative-session-api";
import {
  isNarrativeSurfaceMode,
  type NarrativeSurfaceMode,
} from "./narrative-surface-options";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { NarrativeRailPreview } from "./narrative-rail-preview";
import type { SensemakingResponse } from "./sensemaking-types";

interface NarrativeAgentActionOptions {
  activeSession: NarrativeWorkspaceSession | null;
  setActiveSession: Dispatch<SetStateAction<NarrativeWorkspaceSession | null>>;
  setResponse: Dispatch<SetStateAction<SensemakingResponse | null>>;
  setSurfaceMode: Dispatch<SetStateAction<NarrativeSurfaceMode>>;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setIsResearchRailOpen: Dispatch<SetStateAction<boolean>>;
  setRailPreview: Dispatch<SetStateAction<NarrativeRailPreview | null>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  openSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string, color: string) => Promise<void>;
}

interface NarrativeAgentActionDetail {
  action?: string;
  surface?: unknown;
  sessionId?: unknown;
  targetId?: unknown;
  editType?: unknown;
  patch?: unknown;
  operationId?: unknown;
  dataKind?: unknown;
  title?: unknown;
  markdown?: unknown;
  append?: unknown;
}

export function useNarrativeAgentActions(options: NarrativeAgentActionOptions) {
  useEffect(() => {
    async function handleAction(event: Event) {
      const detail = (event as CustomEvent<NarrativeAgentActionDetail>).detail;
      if (!detail?.action) return;
      if (detail.action === "narrativeflow_open_surface") {
        await openSurface(options, detail);
        return;
      }
      if (detail.action === "narrativeflow_stage_edit") {
        options.setValidationMessage(
          "Harper staged a NarrativeFlow edit for approval.",
        );
        return;
      }
      if (detail.action === "narrativeflow_show_internal_data") {
        await showInternalData(options, detail);
        return;
      }
      if (detail.action === "narrativeflow_apply_approved_edit") {
        await applyApprovedEdit(options, detail);
      }
    }
    window.addEventListener("fintheon:narrative-agent-action", handleAction);
    return () => {
      window.removeEventListener(
        "fintheon:narrative-agent-action",
        handleAction,
      );
    };
  }, [options]);
}

async function openSurface(
  options: NarrativeAgentActionOptions,
  detail: NarrativeAgentActionDetail,
) {
  const surface = detail.surface;
  const sessionId = stringValue(detail.sessionId);
  if (!isNarrativeSurfaceMode(surface)) return;
  if (sessionId) await options.openSession(sessionId);
  options.setSurfaceMode(surface);
  options.setIsHistoryOpen(false);
  if (surface === "workspace") options.setIsResearchRailOpen(true);
}

async function showInternalData(
  options: NarrativeAgentActionOptions,
  detail: NarrativeAgentActionDetail,
) {
  const sessionId =
    stringValue(detail.sessionId) ?? stringValue(detail.targetId);
  if (sessionId) await options.openSession(sessionId);
  options.setSurfaceMode("workspace");
  options.setIsHistoryOpen(false);
  options.setIsResearchRailOpen(true);
  options.setRailPreview({
    tab: previewTabForKind(stringValue(detail.dataKind)),
    title: stringValue(detail.title) ?? "NarrativeFlow Preview",
    markdown:
      stringValue(detail.markdown) ??
      "Harper requested the Research rail, but no preview payload was provided.",
    append: Boolean(detail.append),
    updatedAt: Date.now(),
  });
}

async function applyApprovedEdit(
  options: NarrativeAgentActionOptions,
  detail: NarrativeAgentActionDetail,
) {
  const editType = stringValue(detail.editType);
  const patch = isRecord(detail.patch) ? detail.patch : {};
  const targetId =
    stringValue(detail.targetId) ?? options.activeSession?.id ?? null;
  if (editType === "forecast_draft") {
    await createForecastDraft(options, patch);
    return;
  }
  if (!targetId) {
    options.setValidationMessage(
      "Open a NarrativeFlow workspace before applying this edit.",
    );
    return;
  }
  if (editType === "workspace_title") {
    const title = stringValue(patch.title);
    if (!title) return;
    await options.renameSession(
      targetId,
      title,
      stringValue(patch.color) ?? options.activeSession?.color ?? "#c79f4a",
    );
    options.setValidationMessage(
      "Harper applied the approved workspace title edit.",
    );
    return;
  }
  if (editType === "workspace_docs" || editType === "workspace_summary") {
    await saveNarrativeArtifact(targetId, "docs", normalizeDocsPatch(patch));
    await reloadSession(
      options,
      targetId,
      "Harper applied the approved Docs edit.",
    );
    return;
  }
  if (editType === "workspace_flow") {
    await saveNarrativeArtifact(targetId, "flow", unwrapPayload(patch));
    await reloadSession(
      options,
      targetId,
      "Harper applied the approved Flow edit.",
    );
    return;
  }
  if (editType === "workspace_timeline") {
    await saveNarrativeArtifact(targetId, "timeline", unwrapPayload(patch));
    await reloadSession(
      options,
      targetId,
      "Harper applied the approved Timeline edit.",
    );
    return;
  }
  options.setValidationMessage(
    "Approved edit is staged in the rail; this surface is read-only in v1.",
  );
}

async function createForecastDraft(
  options: NarrativeAgentActionOptions,
  patch: Record<string, unknown>,
) {
  const forecast = await createColiseumForecast({
    title: stringValue(patch.title) ?? "NarrativeFlow forecast draft",
    thesis: stringValue(patch.thesis) ?? stringValue(patch.summary) ?? "",
    probability: numberValue(patch.probability),
    direction: stringValue(patch.direction),
    timeframe: stringValue(patch.timeframe) ?? "1-4 weeks",
    validationRule:
      stringValue(patch.validationRule) ??
      "Validate against incoming RiskFlow catalysts.",
    catalystIds: stringArray(patch.catalystIds),
    marketReferences: [],
  });
  options.setSurfaceMode("forecasts");
  options.setValidationMessage("Harper saved an approved Desk Forecast draft.");
  window.dispatchEvent(
    new CustomEvent<{ forecast: ColiseumForecast }>(
      "fintheon:narrative-forecast-created",
      { detail: { forecast } },
    ),
  );
}

async function reloadSession(
  options: NarrativeAgentActionOptions,
  sessionId: string,
  message: string,
) {
  const bundle = await fetchNarrativeSession(sessionId);
  options.setActiveSession(bundle.session);
  options.setResponse(bundle.response);
  options.setValidationMessage(message);
}

function normalizeDocsPatch(patch: Record<string, unknown>) {
  const payload = unwrapPayload(patch);
  return {
    ...payload,
    summary: stringValue(payload.summary) ?? stringValue(patch.summary) ?? "",
    forecast: isRecord(payload.forecast) ? payload.forecast : null,
    links: Array.isArray(payload.links) ? payload.links : [],
  };
}

function unwrapPayload(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return isRecord(patch.payload) ? patch.payload : patch;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function previewTabForKind(
  dataKind: string | null,
): NarrativeRailPreview["tab"] {
  const kind = dataKind?.toLowerCase() ?? "";
  if (kind.includes("timeline")) return "timeline";
  if (
    kind.includes("doc") ||
    kind.includes("forecast") ||
    kind.includes("coliseum") ||
    kind.includes("resolved")
  ) {
    return "docs";
  }
  return "flow";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
