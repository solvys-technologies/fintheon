// [claude-code 2026-04-19] S27-T10: Close CRM skill entry — proxy to existing Close Zapier MCP calls.
// Backend calls are dispatched through the sidecar (registered at boot); this wrapper is the
// registered interface the hub importer + registry introspect.
export const CLOSE_CRM_MCP_NAMESPACE = "mcp__claude_ai_Zapier__close_";
