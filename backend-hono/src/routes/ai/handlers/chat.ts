// [claude-code 2026-04-11] S14-T8: CAO memory flush — auto-flush every 10 msgs, verbal flush detection
// [claude-code 2026-04-05] Strands Phase 8: Full cutover — all inference paths replaced by Strands agents
/**
 * AI Chat Handler
 * Handle chat messages and AI responses via Strands agent network
 * Routes through P.I.C. agent network — single inference path via VProxy
 *
 * All chat goes through Strands agents → VProxy → Claude models.
 * Agent detection routes to: Harper, Oracle, Feucht, Consul, Herald.
 */

import type { Context } from "hono";
import {
  createHarperAgent,
  createOracleAgent,
  createFeuchtAgent,
  createConsulAgent,
  createHeraldAgent,
  strandsToUIStream,
  uiStreamToSSEResponse,
  isStrandsAvailable,
} from "../../../services/strands/index.js";
import * as conversationStore from "../../../services/ai/conversation-store.js";
import type { ChatRequest } from "../../../types/ai-chat.js";
import type { HermesAgentRole } from "../../../services/hermes-service.js";
import {
  detectAgent,
  type ContentPart,
} from "../../../services/hermes-handler.js";
import {
  getAgentSystemPrompt,
  extractSkillTag,
  buildFeedContext,
} from "../../../services/ai/agent-instructions/index.js";
import {
  extractSkillFromMessage,
  isSkillEnabled,
  getSkillDisabledReason,
} from "../../../config/feature-flags.js";
import { createRequestCognition } from "../../../services/cognition-emitter.js";
import {
  takeScreenshot,
  isPlaywrightReady,
} from "../../../services/screenshot-service.js";
import {
  trackMessage,
  shouldAutoFlush,
  autoFlushMemory,
  detectVerbalFlush,
  verbalFlushMemory,
} from "../../../services/cao-memory-flush.js";

// File attachment content part types
type FileContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { name: string; mimeType: string; data: string } };

function toAgentLabel(agent: HermesAgentRole | string): string {
  switch (agent) {
    case "harper-cao":
      return "Harper / CAO";
    case "pma-merged":
      return "Oracle (All-Seer)";
    case "futures-desk":
      return "Feucht (Futures & Risk)";
    case "fundamentals-desk":
      return "Consul (Fundamentals)";
    case "herald":
      return "Herald (News & Sentiment)";
    default:
      return "PIC Analyst";
  }
}

/** Create the appropriate Strands agent for the detected role */
async function createAgentForRole(
  role: HermesAgentRole | string,
  requestId: string,
) {
  switch (role) {
    case "harper-cao":
      return await createHarperAgent(requestId);
    case "pma-merged":
      return await createOracleAgent();
    case "futures-desk":
      return await createFeuchtAgent();
    case "fundamentals-desk":
      return await createConsulAgent();
    case "herald":
      return await createHeraldAgent();
    default:
      // Default to Oracle for unmatched roles
      return await createOracleAgent();
  }
}

/**
 * POST /api/ai/chat
 * Strands Agent Processing - Routes through P.I.C. agent network via VProxy
 */
export async function handleChat(c: Context) {
  const startTime = Date.now();
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const userId = c.get("userId") as string | undefined;

  // Create scoped cognition emitter — frontend subscribes via /api/ai/cognition/stream?requestId=
  const cognition = createRequestCognition(requestId, startTime);

  console.log(`[Hermes][${requestId}] Request started (strands mode)`);

  // Expose requestId so frontend can open cognition SSE stream
  c.header("X-Request-Id", requestId);

  if (!userId) {
    console.warn(`[Hermes][${requestId}] Unauthorized - no userId`);
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req
      .json<ChatRequest & { messages?: { role: string; content: string }[] }>()
      .catch((err) => {
        console.error(
          `[Hermes][${requestId}] Failed to parse request body:`,
          err,
        );
        return null;
      });

    // Support both 'message' (string) and 'messages' (array from Vercel AI SDK)
    // Content can be string or multimodal array [{type:'text',text:''},{type:'image_url',image_url:{url:''}}]
    let message = body?.message?.trim() ?? "";
    let multimodalContent: ContentPart[] | undefined;
    if (!message && body?.messages?.length) {
      const lastUserMsg = [...body.messages]
        .reverse()
        .find((m) => m.role === "user");
      const rawContent = lastUserMsg?.content;
      if (typeof rawContent === "string") {
        message = rawContent.trim();
      } else if (Array.isArray(rawContent)) {
        // Multimodal content array — supports text, images, and file attachments
        const textParts: string[] = [];
        const fileParts: string[] = [];
        const imageParts: ContentPart[] = [];

        for (const part of rawContent as FileContentPart[]) {
          if (part.type === "text") {
            textParts.push(part.text);
          } else if (part.type === "image_url") {
            imageParts.push(part as ContentPart);
          } else if (part.type === "file" && part.file) {
            const { name, mimeType, data } = part.file;
            if (mimeType.startsWith("image/")) {
              // Images → base64 vision input
              imageParts.push({
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${data}` },
              });
            } else if (
              mimeType.startsWith("text/") ||
              mimeType === "application/json" ||
              mimeType === "application/javascript" ||
              mimeType === "application/typescript" ||
              mimeType === "application/xml"
            ) {
              // Text/code → inline context
              const decoded = Buffer.from(data, "base64").toString("utf-8");
              fileParts.push(
                `--- File: ${name} ---\n${decoded}\n--- End: ${name} ---`,
              );
            } else if (mimeType === "application/pdf") {
              // PDFs → extract text (base64 decode, best-effort UTF-8)
              const decoded = Buffer.from(data, "base64").toString("utf-8");
              const cleaned = decoded
                .replace(/[^\x20-\x7E\n\r\t]/g, " ")
                .replace(/\s{3,}/g, "\n");
              fileParts.push(
                `--- PDF: ${name} ---\n${cleaned.slice(0, 50_000)}\n--- End: ${name} ---`,
              );
            }
          }
        }

        message = textParts.join("").trim();
        if (fileParts.length > 0) {
          message = `${fileParts.join("\n\n")}\n\n${message}`;
        }
        if (imageParts.length > 0) {
          multimodalContent = [
            ...imageParts,
            { type: "text" as const, text: message },
          ];
        }
      }
    }

    if (!message) {
      console.warn(`[Hermes][${requestId}] Empty message`);
      return c.json({ error: "Message is required" }, 400);
    }

    // Enforce skill permissions
    const detectedSkill = extractSkillFromMessage(message);
    if (detectedSkill && !isSkillEnabled(detectedSkill)) {
      const reason =
        getSkillDisabledReason(detectedSkill) ||
        "This skill is currently disabled.";
      console.warn(
        `[Hermes][${requestId}] Blocked disabled skill: ${detectedSkill}`,
      );
      cognition.step("skill-check", `Skill blocked: ${detectedSkill}`, reason);
      cognition.done();
      return c.json({ error: "Skill unavailable", reason }, 403);
    }
    if (detectedSkill) {
      cognition.step("skill-check", `Skill active: ${detectedSkill}`);
    }

    // Auto-screenshot for QUICKFINTHEON when no image parts present
    if (
      detectedSkill === "QUICKFINTHEON" &&
      !multimodalContent?.some((p) => p.type === "image_url")
    ) {
      try {
        if (await isPlaywrightReady()) {
          cognition.step(
            "tool-dispatch",
            "Playwright screenshot",
            "Auto-capturing dashboard for QuickFintheon",
          );
          const shot = await takeScreenshot();
          const imgPart: ContentPart = {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${shot.base64}` },
          };
          if (multimodalContent) {
            multimodalContent.push(imgPart);
          } else {
            multimodalContent = [
              { type: "text" as const, text: message },
              imgPart,
            ];
          }
          console.log(
            `[Hermes][${requestId}] QuickFintheon auto-screenshot captured`,
          );
        }
      } catch (err) {
        console.warn(
          `[Hermes][${requestId}] QuickFintheon auto-screenshot failed, proceeding without:`,
          err,
        );
      }
    }

    console.log(
      `[Hermes][${requestId}] Message: "${message.substring(0, 50)}..." (${message.length} chars)`,
    );

    const { conversationId, thinkHarder } = body ?? ({} as any);

    // Get or create conversation
    let conversation = conversationId
      ? await conversationStore.getConversation(conversationId, userId)
      : null;

    if (conversationId && !conversation) {
      console.log(
        `[Hermes][${requestId}] Conversation ${conversationId} not found, creating new`,
      );
      conversation = null;
    }

    if (!conversation) {
      const title = conversationStore.generateTitle(message);
      conversation = await conversationStore.createConversation(userId, {
        title,
      });
      console.log(
        `[Hermes][${requestId}] Created conversation: ${conversation.id}`,
      );
    } else {
      console.log(
        `[Hermes][${requestId}] Using existing conversation: ${conversation.id}`,
      );
    }

    // Store user message
    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: "user",
      content: message,
    });
    trackMessage(conversation.id);
    console.log(`[Hermes][${requestId}] User message saved`);

    // Verbal flush: detect "remember this" / "save this" etc.
    const isVerbalFlush = detectVerbalFlush(message);
    if (isVerbalFlush && userId) {
      verbalFlushMemory(conversation.id, userId, message).catch((err) =>
        console.warn(`[CAOMemory][${requestId}] Verbal flush failed:`, err),
      );
      cognition.step(
        "tool-dispatch",
        "Saved to memory",
        "Verbal flush triggered",
      );
    }

    // Get conversation history
    const history = await conversationStore.getRecentContext(conversation.id);
    console.log(`[Hermes][${requestId}] History: ${history.length} messages`);
    cognition.step(
      "context-build",
      `Context assembled`,
      `${history.length} messages in history`,
    );

    // Detect which P.I.C. agent should handle this
    const agentInfo = detectAgent(message);
    console.log(
      `[Hermes][${requestId}] Routed to agent: ${agentInfo.agent} (intent: ${agentInfo.intent}, confidence: ${agentInfo.confidence})`,
    );
    cognition.step(
      "agent-route",
      `Routed → ${toAgentLabel(agentInfo.agent)}`,
      `intent: ${agentInfo.intent}, confidence: ${Math.round(agentInfo.confidence * 100)}%`,
    );

    // Create the appropriate Strands agent
    const agent = await createAgentForRole(agentInfo.agent, requestId);

    // Build the full prompt with history context
    let prompt = message;
    if (history.length > 0) {
      const historyBlock = history
        .slice(-10)
        .map((m) => `[${m.role}]: ${m.content}`)
        .join("\n");
      prompt = `[Conversation history]\n${historyBlock}\n\n[Current message]\n${message}`;
    }

    // Append file/image context if multimodal
    if (multimodalContent?.length) {
      const imageCount = multimodalContent.filter(
        (p) => p.type === "image_url",
      ).length;
      if (imageCount > 0) {
        prompt += `\n\n[${imageCount} image(s) attached — analyze visually]`;
      }
    }

    // Verbal flush: tell agent to confirm the save in its response
    if (isVerbalFlush) {
      prompt += `\n\n[SYSTEM: The user asked you to remember something. It has been saved to memory. Briefly acknowledge this at the start of your response with "Saved to memory." then continue normally.]`;
    }

    // Inject live RiskFlow headlines so agents can reference real-time data
    const feedContext = await buildFeedContext();
    if (feedContext) {
      prompt = `${feedContext}\n\n${prompt}`;
    }

    // [S23-T3] Aquarium awareness: Hermes CAOs (Oracle, Feucht, Consul, Herald) should also
    // interpret AgentDesk output when the user is on the Aquarium surface.
    const mcpActive = Array.isArray((body as any)?.mcpServers)
      ? ((body as any).mcpServers as string[])
      : [];
    const hermesSurface = (body as any)?.surface as string | undefined;
    if (hermesSurface === "aquarium" || mcpActive.includes("aquarium")) {
      try {
        const { buildAquariumContext } =
          await import("../../../services/harper-handler.js");
        const aquariumContext = await buildAquariumContext();
        if (aquariumContext) {
          prompt = `${aquariumContext}\n\n${prompt}`;
          console.log(
            `[Hermes][${requestId}] Aquarium context injected (surface=${hermesSurface ?? "none"})`,
          );
        }
      } catch (err) {
        console.warn(
          `[Hermes][${requestId}] Failed to build Aquarium context:`,
          err,
        );
      }
    }

    cognition.step(
      "gateway-call",
      `Streaming from ${toAgentLabel(agentInfo.agent)}`,
      "Strands agent via VProxy",
    );

    const agentModel =
      agentInfo.agent === "harper-cao"
        ? "harper"
        : `strands-${agentInfo.agent}`;

    const stream = strandsToUIStream(agent, prompt, {
      messageId: `assistant-${Date.now()}`,
      onFinish: async (text) => {
        // Store assistant message
        if (text) {
          await conversationStore.addMessage(conversation.id, {
            conversationId: conversation.id,
            role: "assistant",
            content: text,
            model: agentModel,
          });
          trackMessage(conversation.id);
        }

        // Auto-flush: every 10 messages, extract insights to shared memory
        if (shouldAutoFlush(conversation.id) && userId) {
          autoFlushMemory(conversation.id, userId).catch((err) =>
            console.warn(`[CAOMemory][${requestId}] Auto-flush failed:`, err),
          );
        }

        const duration = Date.now() - startTime;
        console.log(
          `[Hermes][${requestId}] Complete (${duration}ms, ${text.length} chars)`,
        );
        cognition.step(
          "response-ready",
          "Response complete",
          `${text.length} chars in ${duration}ms`,
        );
        cognition.done();
      },
    });

    // S38-T1: wrap stream to emit complete event before DONE
    const completeEnc = new TextEncoder();
    const doneEnc = completeEnc.encode("data: [DONE]\n\n");
    let textBuf = "";
    let doneSent = false;
    const wrappedStrm = new ReadableStream<Uint8Array>({
      start(ctrl) {
        const reader = stream.getReader();
        function pump() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                if (!doneSent) {
                  doneSent = true;
                  const lat = Date.now() - startTime;
                  ctrl.enqueue(
                    completeEnc.encode(
                      "data: " +
                        JSON.stringify({
                          type: "complete",
                          latency_ms: lat,
                          source_count: 1,
                          model:
                            agentInfo.agent === "harper-cao"
                              ? "opus"
                              : agentModel,
                          provider: "anthropic",
                          prompt_tokens: Math.ceil(prompt.length / 4),
                          completion_tokens: Math.ceil(textBuf.length / 4),
                        }) +
                        "\n\n",
                    ),
                  );
                }
                ctrl.enqueue(doneEnc);
                ctrl.close();
                return;
              }
              textBuf += new TextDecoder().decode(value);
              ctrl.enqueue(value);
              pump();
            })
            .catch((e) => ctrl.error(e));
        }
        pump();
      },
    });

    return uiStreamToSSEResponse(wrappedStrm, {
      "X-Conversation-Id": conversation.id,
      "X-Request-Id": requestId,
      "X-Hermes-Agent": agentModel,
      "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers":
        "X-Conversation-Id, X-Request-Id, X-Hermes-Agent",
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[Hermes][${requestId}] Fatal error after ${duration}ms:`,
      error,
    );
    cognition.step(
      "error",
      "Fatal error",
      error instanceof Error ? error.message : String(error),
    );
    cognition.done();

    // Clean error messages — no raw fallback info
    let errorMessage = "Connected but error — try again in a moment.";
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        errorMessage = "Request timed out. Please try again.";
      } else if (
        error.message.includes("API key") ||
        error.message.includes("authentication")
      ) {
        errorMessage = "Connected but error — check model configuration.";
      } else if (error.message.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please wait a moment.";
      }
    }

    return c.json(
      {
        error: errorMessage,
        requestId,
        duration: `${duration}ms`,
      },
      500,
    );
  }
}

/**
 * POST /api/ai/chat/stream (legacy SSE endpoint)
 */
export async function handleChatStream(c: Context) {
  // Redirect to main handler - it's now streaming
  return handleChat(c);
}
