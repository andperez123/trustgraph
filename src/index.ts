/**
 * TrustGraph — trust & risk layer for WakeNet + Taskmint + AgentPay.
 * Start API: npm run dev (or npm run dev:api)
 * MCP server: npm run dev:mcp
 * Cron: npm run job:scores
 */
export { createTrustRouter } from "./api/trust.js";
export { ingestEvent, ingestEventBatch } from "./events/ingest.js";
export {
  computeScores,
  recomputeScoresForAgent,
  recomputeAllScores,
  recomputeStaleScores,
  getStaleAgentScoreKeys,
} from "./scoring/engine.js";
export { checkDispatchGate, DISPATCH_RELIABILITY_THRESHOLD } from "./gatekeeper/dispatch.js";
export type { DispatchGateResult } from "./gatekeeper/dispatch.js";
export { getPool, query, closePool } from "./db/client.js";
export * from "./types.js";
export { config } from "./config.js";
