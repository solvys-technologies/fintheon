import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("NarrativeFlowGraph");

const NarrativeFlowState = Annotation.Root({
  requestId: Annotation<string>(),
  userId: Annotation<string | undefined>(),
  conversationId: Annotation<string>(),
  workspaceId: Annotation<string | undefined>(),
  workspaceTitle: Annotation<string | undefined>(),
  hasArtifacts: Annotation<boolean | undefined>(),
  message: Annotation<string>(),
  acknowledgement: Annotation<string | undefined>(),
  pendingApproval: Annotation<Record<string, unknown> | undefined>(),
  approvalResume: Annotation<unknown | undefined>(),
});

export interface NarrativeFlowGraphInput {
  requestId: string;
  userId?: string;
  conversationId: string;
  message: string;
  surface?: string;
  workspace?: Record<string, unknown>;
}

export interface NarrativeFlowGraphResult {
  acknowledgement: string;
  threadId: string;
  enabled: boolean;
}

let checkpointerPromise: Promise<BaseCheckpointSaver> | null = null;
let graphPromise: ReturnType<typeof buildGraph> | null = null;

export function isNarrativeFlowGraphEnabled(input: {
  surface?: string;
}): boolean {
  return (
    input.surface === "narrativeflow" &&
    process.env.NARRATIVEFLOW_LANGGRAPH_ENABLED === "true"
  );
}

export function buildNarrativeFlowAcknowledgement(input: {
  surface?: string;
  workspace?: Record<string, unknown>;
}): string | null {
  if (input.surface !== "narrativeflow") return null;
  const title = stringValue(input.workspace?.title) ?? "this narrative";
  if (input.workspace?.hasArtifacts === false) {
    return `On it. I’ll open ${title}, acknowledge the brief here first, then fill the Research rail before anything gets persisted.\n\n`;
  }
  return `On it. I’ll read ${title}, show the rail work first, then stage any write for approval.\n\n`;
}

export async function prepareNarrativeFlowAgentTurn(
  input: NarrativeFlowGraphInput,
): Promise<NarrativeFlowGraphResult> {
  const fallbackAcknowledgement =
    buildNarrativeFlowAcknowledgement(input) ?? "On it.\n\n";
  if (!isNarrativeFlowGraphEnabled(input)) {
    return {
      acknowledgement: fallbackAcknowledgement,
      threadId: buildThreadId(input),
      enabled: false,
    };
  }

  const graph = await getGraph();
  const workspaceId = stringValue(input.workspace?.id);
  const result = await graph.invoke(
    {
      requestId: input.requestId,
      userId: input.userId,
      conversationId: input.conversationId,
      workspaceId,
      workspaceTitle: stringValue(input.workspace?.title),
      hasArtifacts:
        typeof input.workspace?.hasArtifacts === "boolean"
          ? input.workspace.hasArtifacts
          : undefined,
      message: input.message,
    },
    { configurable: { thread_id: buildThreadId(input) } },
  );

  return {
    acknowledgement: result.acknowledgement ?? fallbackAcknowledgement,
    threadId: buildThreadId(input),
    enabled: true,
  };
}

export async function resumeNarrativeFlowGraphApproval(
  input: NarrativeFlowGraphInput,
  resume: unknown,
) {
  const graph = await getGraph();
  return graph.invoke(new Command({ resume }), {
    configurable: { thread_id: buildThreadId(input) },
  });
}

async function getGraph() {
  if (!graphPromise) graphPromise = buildGraph();
  return graphPromise;
}

async function buildGraph() {
  const checkpointer = await getCheckpointer();
  return new StateGraph(NarrativeFlowState)
    .addNode("acknowledge", acknowledgeNode)
    .addNode("approval_gate", approvalGateNode)
    .addEdge(START, "acknowledge")
    .addEdge("acknowledge", "approval_gate")
    .addEdge("approval_gate", END)
    .compile({ checkpointer });
}

async function acknowledgeNode(state: typeof NarrativeFlowState.State) {
  return {
    acknowledgement:
      buildNarrativeFlowAcknowledgement({
        surface: "narrativeflow",
        workspace: {
          title: state.workspaceTitle,
          hasArtifacts: state.hasArtifacts,
        },
      }) ?? "On it.\n\n",
  };
}

function approvalGateNode(state: typeof NarrativeFlowState.State) {
  if (!state.pendingApproval) return {};
  const resume = interrupt({
    type: "tool-approval-request",
    requestId: state.requestId,
    payload: state.pendingApproval,
  });
  return { approvalResume: resume };
}

async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (checkpointerPromise) return checkpointerPromise;
  checkpointerPromise = createCheckpointer();
  return checkpointerPromise;
}

async function createCheckpointer(): Promise<BaseCheckpointSaver> {
  const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!databaseUrl) return new MemorySaver();
  try {
    const schema = sanitizeSchema(process.env.LANGGRAPH_POSTGRES_SCHEMA);
    const poolConfig: pg.PoolConfig = { connectionString: databaseUrl };
    if (databaseUrl.includes(".supabase.co")) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    const pool = new pg.Pool(poolConfig);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    const saver = new PostgresSaver(pool, undefined, { schema });
    await saver.setup();
    return saver;
  } catch (err) {
    log.warn("Postgres checkpointer unavailable; using memory fallback", {
      error: String(err),
    });
    return new MemorySaver();
  }
}

function sanitizeSchema(value: string | undefined): string {
  const schema = value?.trim() || "langgraph";
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : "langgraph";
}

function buildThreadId(input: NarrativeFlowGraphInput): string {
  const user = sanitizeThreadPart(input.userId ?? "anonymous");
  const conversation = sanitizeThreadPart(input.conversationId);
  const workspace = sanitizeThreadPart(
    stringValue(input.workspace?.id) ?? "none",
  );
  return `narrativeflow:${user}:${workspace}:${conversation}`;
}

function sanitizeThreadPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 96) || "none";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
