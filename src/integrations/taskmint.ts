/**
 * Helpers for Taskmint to emit task outcome events into TrustGraph.
 * Taskmint calls POST /trust/events or trust_emit_event (MCP) with these shapes.
 */
import type { IngestEventInput } from "../types.js";

export type TaskmintEventType =
  | "task_completed"
  | "task_failed"
  | "task_disputed"
  | "task_reversed"
  | "task_timeout";

export interface TaskmintEmitParams {
  subjectAgentId: string;
  actorAgentId?: string | null;
  skillId?: string | null;
  eventType: TaskmintEventType;
  outcome: "success" | "failure" | "neutral";
  severity: number;
  occurredAt: string;
  taskmintTaskId: string;
  valueUsdMicros?: number | null;
  evidence?: Record<string, unknown> | null;
}

/**
 * Build a TrustGraph event payload for a Taskmint task outcome.
 * Use with POST /trust/events or trust_emit_event.
 */
export function buildTaskmintEvent(params: TaskmintEmitParams): IngestEventInput {
  return {
    subjectAgentId: params.subjectAgentId,
    actorAgentId: params.actorAgentId ?? null,
    skillId: params.skillId ?? null,
    source: "taskmint",
    eventType: params.eventType,
    outcome: params.outcome,
    severity: Math.max(1, Math.min(100, params.severity)),
    valueUsdMicros: params.valueUsdMicros ?? null,
    occurredAt: params.occurredAt,
    externalRefType: "taskmint_task",
    externalRefId: params.taskmintTaskId,
    evidence: params.evidence ?? null,
  };
}
