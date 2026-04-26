// [claude-code 2026-04-26] S45.5/F1: FinancialDatasets MCP tertiary source.
// On disk at ~/Desktop/Codebases/financial-datasets-mcp/ (Python / uv).
// Wired into .mcp.json. README confirms the exposed tools are statement-level
// (income/balance/cash-flow) + price-level + company news — there is NOT a
// dedicated earnings_calendar tool in this MCP. So this slot stays a stub for
// the *calendar* path; the higher-value FD-MCP integration is for ACTUAL EPS
// post-print enrichment via get_income_statements (replaces the deleted FMP
// historical/earning_calendar call). That wiring is tracked as a follow-up.

import { createLogger } from "../../../lib/logger.js";
import type { TVCalendarRow } from "./tradingview-calendar.js";

const log = createLogger("FinancialDatasetsMCP");

export async function fetchFinancialDatasetsEarnings(): Promise<
  TVCalendarRow[]
> {
  log.info(
    "FinancialDatasets MCP earnings call stubbed — wire stdio JSON-RPC client in a follow-up",
  );
  return [];
}
