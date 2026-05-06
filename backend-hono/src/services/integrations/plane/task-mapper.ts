// [claude-code 2026-05-06] S60-T5: Maps Plane incidents to research task board entities

import { createLogger } from "../../../lib/logger.js";
import type { ResearchTaskInput } from "../../../services/research/task-board.js";

const log = createLogger("TaskMapper");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappedIncident {
  incidentId: string;
  correlationId: string;
  eventType: string;
  severity?: "low" | "medium" | "high" | "critical";
  component?: string;
  title?: string;
  narrative?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mapping rules — which incidents create research tasks
// ---------------------------------------------------------------------------

interface MappingRule {
  severityMin: string;
  componentMatch?: string;
  deskId?: string;
  assignedAgent?: string;
  priority: number; // Lower = higher priority
}

const MAPPING_RULES: MappingRule[] = [
  { severityMin: "critical", deskId: null, assignedAgent: "harper", priority: 0 },
  { severityMin: "high", deskId: null, assignedAgent: "oracle", priority: 1 },
  { severityMin: "medium", componentMatch: "riskflow", deskId: null, assignedAgent: "feucht", priority: 2 },
  { severityMin: "medium", componentMatch: "autopilot", deskId: null, assignedAgent: "consul", priority: 2 },
  { severityMin: "medium", componentMatch: "trading", deskId: null, assignedAgent: "harper", priority: 3 },
];

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function severityMeets(minSeverity: string, actual: string): boolean {
  const actualWeight = SEVERITY_WEIGHT[actual] ?? 0;
  const minWeight = SEVERITY_WEIGHT[minSeverity] ?? 0;
  return actualWeight >= minWeight;
}

function componentMatches(pattern: string | undefined, component: string | undefined): boolean {
  if (!pattern) return true;
  if (!component) return false;
  return component.toLowerCase().includes(pattern.toLowerCase());
}

// ---------------------------------------------------------------------------
// Map incident to research task input (or null if no rule matches)
// ---------------------------------------------------------------------------

export function mapIncidentToTask(incident: MappedIncident): ResearchTaskInput | null {
  const severity = incident.severity ?? "low";
  const component = incident.component ?? "";

  const matchingRules = MAPPING_RULES.filter(
    (rule) =>
      severityMeets(rule.severityMin, severity) &&
      componentMatches(rule.componentMatch, component),
  ).sort((a, b) => a.priority - b.priority);

  if (matchingRules.length === 0) {
    log.info("task mapper: no rule matched", {
      incidentId: incident.incidentId,
      severity,
      component,
    });
    return null;
  }

  const rule = matchingRules[0];

  const narrative = incident.narrative
    ?? incident.data
    ? JSON.stringify(incident.data)
    : `Auto-mapped from Plane incident ${incident.incidentId}. Event type: ${incident.eventType}, Severity: ${severity}`;

  const task: ResearchTaskInput = {
    title: incident.title ?? `Incident: ${incident.incidentId} (${severity})`,
    narrative,
    assignedAgent: rule.assignedAgent ?? null,
    deskId: rule.deskId ?? null,
    dueDate: null,
    createdBy: "plane-task-mapper",
  };

  log.info("task mapper: incident mapped to task", {
    incidentId: incident.incidentId,
    severity,
    component,
    matchedRule: rule.priority,
    assignedAgent: task.assignedAgent,
  });

  return task;
}
