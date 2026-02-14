/**
 * Gatekeeper: check an agent's score before the Runtime dispatches a job.
 * Rule: If reliability_score < 0.5, the Runtime should refuse to dispatch.
 */

import { getAgentScore } from "../services/trust-read.js";
import type { TrustScoresResponse } from "../types.js";

export const DISPATCH_RELIABILITY_THRESHOLD = 0.5;

export interface DispatchGateResult {
  allowed: boolean;
  reason: string;
  scores: TrustScoresResponse["scores"];
  updatedAt: string;
}

/**
 * Check whether the Runtime is allowed to dispatch a job to this agent.
 * Returns allowed: false when reliability < 0.5 so the Runtime should refuse to dispatch.
 * Dev 2 (Runtime) can call this before execution.
 */
export async function checkDispatchGate(
  agentId: string,
  options?: { window?: string }
): Promise<DispatchGateResult> {
  const window = options?.window ?? "30d";
  const res = await getAgentScore(agentId, window);
  const { reliability } = res.scores;

  if (reliability < DISPATCH_RELIABILITY_THRESHOLD) {
    return {
      allowed: false,
      reason: `Agent reliability ${reliability} is below dispatch threshold ${DISPATCH_RELIABILITY_THRESHOLD}. Refusing to dispatch.`,
      scores: res.scores,
      updatedAt: res.updatedAt,
    };
  }

  return {
    allowed: true,
    reason: "Agent meets minimum reliability for dispatch.",
    scores: res.scores,
    updatedAt: res.updatedAt,
  };
}
