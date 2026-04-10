// [claude-code 2026-04-01] S13-T3: Agentic sidebar — AI actions for the document editor

import { getDocument } from "../documents/doc-store.js";
import { isComputerUseAvailable } from "../skills/tradingview-trade-plan.js";
import { createLogger } from "../../lib/logger.js";
import { listSharedMemory } from "../peers/shared-memory.js";

const log = createLogger("AgenticSidebar");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarAction {
  type: "fetch-chart" | "fetch-data" | "summarize" | "analyze" | "insert-image";
  prompt: string;
  documentId: string;
  result?: {
    content?: string;
    imageBase64?: string;
    data?: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleSummarize(action: SidebarAction): Promise<SidebarAction> {
  const doc = await getDocument(action.documentId);
  if (!doc) {
    return { ...action, result: { content: "Document not found." } };
  }

  // Extract text from TipTap JSON
  const text = extractTextFromTipTap(doc.content);
  if (!text.trim()) {
    return {
      ...action,
      result: { content: "Document is empty — nothing to summarize." },
    };
  }

  // Use Claude CLI if available, otherwise basic extractive summary
  try {
    const { getSessionManager } =
      await import("../claude-sdk/session-manager.js");
    const mgr = getSessionManager();
    const summary = await mgr.sendPromptSync(
      `Summarize the following document concisely in 2-3 paragraphs. Focus on key findings, data points, and conclusions.\n\n---\n${text.slice(0, 8000)}`,
      {},
    );
    return { ...action, result: { content: summary } };
  } catch (err) {
    log.warn("Claude CLI unavailable for summarize, using excerpt", {
      error: String(err),
    });
    const excerpt = text.slice(0, 500) + (text.length > 500 ? "..." : "");
    return { ...action, result: { content: `**Excerpt:** ${excerpt}` } };
  }
}

async function handleAnalyze(action: SidebarAction): Promise<SidebarAction> {
  const doc = await getDocument(action.documentId);
  if (!doc) {
    return { ...action, result: { content: "Document not found." } };
  }

  const text = extractTextFromTipTap(doc.content);

  // Pull shared memory context for richer analysis
  let memoryContext = "";
  try {
    const regimeEntries = await listSharedMemory({ category: "regime" });
    if (regimeEntries.length > 0) {
      memoryContext =
        "\n\n**Shared Team Memory (Regime):**\n" +
        regimeEntries
          .slice(0, 5)
          .map((e) => `- ${e.key}: ${JSON.stringify(e.value).slice(0, 200)}`)
          .join("\n");
    }
  } catch {
    /* non-fatal */
  }

  try {
    const { getSessionManager } =
      await import("../claude-sdk/session-manager.js");
    const mgr = getSessionManager();
    const prompt = action.prompt
      ? `Analyze this document with the following focus: "${action.prompt}"\n\nDocument:\n${text.slice(0, 6000)}${memoryContext}`
      : `Provide a critical analysis of this trading/research document. Identify strengths, weaknesses, blind spots, and actionable insights.\n\nDocument:\n${text.slice(0, 6000)}${memoryContext}`;
    const analysis = await mgr.sendPromptSync(prompt, {});
    return { ...action, result: { content: analysis } };
  } catch (err) {
    return {
      ...action,
      result: {
        content: `Analysis unavailable — Claude CLI not ready: ${String(err)}`,
      },
    };
  }
}

async function handleFetchChart(action: SidebarAction): Promise<SidebarAction> {
  if (!isComputerUseAvailable()) {
    return {
      ...action,
      result: {
        content:
          "Computer Use not configured. Set ENABLE_COMPUTER_USE=true to enable chart fetching.",
      },
    };
  }

  try {
    const { getSessionManager } =
      await import("../claude-sdk/session-manager.js");
    const mgr = getSessionManager();
    const prompt = `Using Computer Use, open TradingView and take a screenshot of the chart for "${action.prompt}". Return the screenshot as base64.`;
    const result = await mgr.sendPromptSync(prompt, {});
    // Claude may return base64 in a code block or raw — try to extract
    const base64Match =
      result.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/) ||
      result.match(/([A-Za-z0-9+/=]{100,})/);
    if (base64Match) {
      return {
        ...action,
        result: {
          imageBase64: base64Match[1],
          content: `Chart for ${action.prompt}`,
        },
      };
    }
    return { ...action, result: { content: result } };
  } catch (err) {
    return {
      ...action,
      result: { content: `Failed to fetch chart: ${String(err)}` },
    };
  }
}

async function handleFetchData(action: SidebarAction): Promise<SidebarAction> {
  try {
    const { getSessionManager } =
      await import("../claude-sdk/session-manager.js");
    const mgr = getSessionManager();
    const result = await mgr.sendPromptSync(
      `Search the web and extract structured data for: "${action.prompt}". Return the key facts as a concise markdown summary.`,
      {},
    );
    return { ...action, result: { content: result } };
  } catch (err) {
    return {
      ...action,
      result: { content: `Data fetch unavailable: ${String(err)}` },
    };
  }
}

async function handleInsertImage(
  action: SidebarAction,
): Promise<SidebarAction> {
  if (!isComputerUseAvailable()) {
    return {
      ...action,
      result: {
        content:
          "Computer Use not configured. Set ENABLE_COMPUTER_USE=true to enable image capture.",
      },
    };
  }

  try {
    const { getSessionManager } =
      await import("../claude-sdk/session-manager.js");
    const mgr = getSessionManager();
    const prompt = `Using Computer Use, find a visual/chart/image matching "${action.prompt}" on the web and take a screenshot. Return the screenshot as base64.`;
    const result = await mgr.sendPromptSync(prompt, {});
    const base64Match =
      result.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/) ||
      result.match(/([A-Za-z0-9+/=]{100,})/);
    if (base64Match) {
      return {
        ...action,
        result: {
          imageBase64: base64Match[1],
          content: `Image: ${action.prompt}`,
        },
      };
    }
    return { ...action, result: { content: result } };
  } catch (err) {
    return {
      ...action,
      result: { content: `Image capture failed: ${String(err)}` },
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function executeSidebarAction(
  action: SidebarAction,
): Promise<SidebarAction> {
  log.info(`Executing sidebar action: ${action.type}`, {
    documentId: action.documentId,
  });

  switch (action.type) {
    case "summarize":
      return handleSummarize(action);
    case "analyze":
      return handleAnalyze(action);
    case "fetch-chart":
      return handleFetchChart(action);
    case "fetch-data":
      return handleFetchData(action);
    case "insert-image":
      return handleInsertImage(action);
    default:
      return {
        ...action,
        result: { content: `Unknown action type: ${(action as any).type}` },
      };
  }
}

export function listAvailableActions(): string[] {
  const actions = ["summarize", "analyze", "fetch-data"];
  if (isComputerUseAvailable()) {
    actions.push("fetch-chart", "insert-image");
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTextFromTipTap(content: Record<string, unknown>): string {
  if (!content || typeof content !== "object") return "";
  const parts: string[] = [];

  function walk(node: any) {
    if (!node) return;
    if (node.text) parts.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  }

  walk(content);
  return parts.join(" ");
}
