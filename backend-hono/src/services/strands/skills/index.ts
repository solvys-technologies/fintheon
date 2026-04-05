// [claude-code 2026-04-04] Solvys skills barrel — all 9 skills as Strands tools
import { solvysShipTool } from './ship.js'
import { solvysAuditTool } from './audit.js'
import { solvysBriefTool } from './brief.js'
import { solvysDeployTool } from './deploy.js'
import { solvysResearchTool } from './research.js'
import { solvysInformTool } from './inform.js'
import { solvysOrchestrateTool } from './orchestrate.js'
import { solvysMonitorTool } from './monitor.js'
import { solvysBetaTool } from './beta.js'

export {
  solvysShipTool,
  solvysAuditTool,
  solvysBriefTool,
  solvysDeployTool,
  solvysResearchTool,
  solvysInformTool,
  solvysOrchestrateTool,
  solvysMonitorTool,
  solvysBetaTool,
}

/** All solvys skill tools as an array — pass to Harper's tools list */
export function getAllSolvysTools() {
  return [
    solvysShipTool,
    solvysAuditTool,
    solvysBriefTool,
    solvysDeployTool,
    solvysResearchTool,
    solvysInformTool,
    solvysOrchestrateTool,
    solvysMonitorTool,
    solvysBetaTool,
  ]
}
