/**
 * Helpers for WakeNet to emit timeliness events into TrustGraph.
 * WakeNet calls POST /trust/events or trust_emit_event (MCP) with these shapes.
 */
import type { IngestEventInput } from "../types.js";

export type WakeNetEventType = "wakeup_received" | "reaction_late" | "wakeup_missed";

export interface WakeNetEmitParams {
  subjectAgentId: string;
  eventType: WakeNetEventType;
  outcome: "success" | "failure";
  severity: number;
  occurredAt: string;
  wakenetEventId: string;
}

/**
 * Build a TrustGraph event payload for a WakeNet timeliness event.
 * Use with POST /trust/events or trust_emit_event.
 */
export function buildWakeNetEvent(params: WakeNetEmitParams): IngestEventInput {
  return {
    subjectAgentId: params.subjectAgentId,
    source: "wakenet",
    eventType: params.eventType,
    outcome: params.outcome,
    severity: Math.max(1, Math.min(100, params.severity)),
    occurredAt: params.occurredAt,
    externalRefType: "wakenet_event",
    externalRefId: params.wakenetEventId,
  };
}
