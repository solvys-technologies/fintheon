// [claude-code 2026-04-04] Strands SDK barrel export
// Provider + factory
export {
  createChainModel,
  createDeepSeekDirectModel,
  createDeepSeekOcApiModel,
  createOllamaFallbackModel,
  checkDeepSeekDirectHealth,
  checkDeepSeekOcApiHealth,
} from "./provider.js";
export {
  createAgent,
  isStrandsAvailable,
  tool,
  z,
  type HarperProvider,
} from "./agent-factory.js";

// Harper tools + solvys skills
export { createHarperTools, FINTHEON_PATHS } from "./harper-tools.js";
export { getAllSolvysTools } from "./skills/index.js";

// Streaming
export { strandsToUIStream, uiStreamToSSEResponse } from "./stream-adapter.js";

// Agents
export { createHarperAgent, streamHarperChat } from "./agents/harper.js";
export { createOracleAgent } from "./agents/oracle.js";
export { createFeuchtAgent } from "./agents/feucht.js";
export { createConsulAgent } from "./agents/consul.js";
export { createHeraldAgent } from "./agents/herald.js";

// Pipeline
export {
  createPICPipeline,
  runPICPipeline,
  streamPICPipeline,
} from "./pipeline.js";

// One-shot generation helper (drop-in for generateText)
export { invokeAgent } from "./invoke-helper.js";
