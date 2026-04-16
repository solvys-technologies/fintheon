// [claude-code 2026-04-04] Solvys Research skill — deep research using human testimony
import { tool } from "@strands-agents/sdk";
import { z } from "zod";

export const solvysResearchTool = tool({
  name: "solvys_research",
  description:
    "Conduct deep research on a topic using web search, Twitter/X, docs, and browser. Synthesizes human testimony and experiments into actionable findings.",
  inputSchema: z.object({
    query: z.string().describe("The research question or topic"),
    sources: z
      .array(z.enum(["web", "twitter", "docs"]))
      .optional()
      .describe("Which sources to search (defaults to all)"),
    maxResults: z
      .number()
      .optional()
      .describe("Max results per source (default 5)"),
  }),
  callback: async (input: {
    query: string;
    sources?: string[];
    maxResults?: number;
  }) => {
    // This tool generates a research prompt — actual execution uses Harper's web_fetch
    // and MCP tools. The skill structures the research workflow.
    const sources = input.sources ?? ["web", "twitter", "docs"];
    const maxResults = input.maxResults ?? 5;

    return [
      `=== Research Brief: ${input.query} ===`,
      "",
      `Sources to query: ${sources.join(", ")}`,
      `Max results per source: ${maxResults}`,
      "",
      "Research protocol:",
      "1. Search each source for the query",
      "2. Extract human testimony (quotes, experiences, opinions)",
      "3. Cross-reference findings across sources",
      "4. Synthesize into actionable insights",
      "5. Flag any contradictions or uncertainties",
      "",
      `Query: "${input.query}"`,
    ].join("\n");
  },
});
