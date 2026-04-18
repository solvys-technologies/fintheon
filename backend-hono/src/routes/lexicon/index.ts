// [claude-code 2026-04-19] S24-T1: lexicon route aggregator — /keywords + /proposals.
import { Hono } from "hono";
import { createLexiconKeywordsRoutes } from "./keywords.js";
import { createLexiconProposalRoutes } from "./proposals.js";

export function createLexiconRoutes(): Hono {
  const app = new Hono();
  app.route("/keywords", createLexiconKeywordsRoutes());
  app.route("/proposals", createLexiconProposalRoutes());
  return app;
}
