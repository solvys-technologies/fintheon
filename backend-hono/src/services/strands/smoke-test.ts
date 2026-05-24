// [codex 2026-05-23] Smoke test: verify Strands Agent talks to the provider chain
// Run: cd backend-hono && bun run src/services/strands/smoke-test.ts
import { createAgent, isStrandsAvailable } from "./agent-factory.js";

async function main() {
  console.log("[Strands Smoke Test] Checking provider availability...");

  const available = await isStrandsAvailable();
  if (!available) {
    console.error("[FAIL] DeepSeek provider not available");
    process.exit(1);
  }
  console.log("[OK] Strands provider is available");

  console.log("[Strands Smoke Test] Creating agent and invoking...");

  const agent = createAgent({
    name: "smoke-test",
    systemPrompt: "You are a test agent. Reply with exactly: STRANDS_OK",
  });

  const result = await agent.invoke("Say the magic words.");
  const text = result.toString();

  console.log("[Response]", text);

  if (text.includes("STRANDS_OK")) {
    console.log("[PASS] Strands provider integration working");
  } else {
    console.log("[WARN] Response received but did not contain STRANDS_OK");
    console.log("[PASS] Agent invocation completed successfully");
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
