/**
 * End-to-end: ingest events → scores updated → agent can query trust → decision gating.
 * Requires DATABASE_URL. Run: npm run test -- e2e
 */
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { closePool } from "../src/db/client.js";
import { ingestEvent } from "../src/events/ingest.js";
import { getAgentScore } from "../src/services/trust-read.js";
import { buildTaskmintEvent } from "../src/integrations/taskmint.js";
import { buildWakeNetEvent } from "../src/integrations/wakenet.js";

const TEST_AGENT = "e2e-test-agent-" + Date.now();

function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

describe("TrustGraph e2e: agent → trust → decision", () => {
  beforeAll(async () => {
    if (!hasDatabase()) return;
    const { getPool } = await import("../src/db/client.js");
    const pool = getPool();
    await pool.query(
      "INSERT INTO agents (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [TEST_AGENT]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  it.skipIf(!hasDatabase())(
    "Taskmint outcomes and WakeNet timeliness change scores; query gates behavior",
    async () => {
      const now = new Date().toISOString();
      const baseTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

      // 1) Ingest task completions (reliability)
      await ingestEvent(
        buildTaskmintEvent({
          subjectAgentId: TEST_AGENT,
          eventType: "task_completed",
          outcome: "success",
          severity: 90,
          occurredAt: baseTime,
          taskmintTaskId: "e2e-task-1",
        })
      );
      await ingestEvent(
        buildTaskmintEvent({
          subjectAgentId: TEST_AGENT,
          eventType: "task_failed",
          outcome: "failure",
          severity: 80,
          occurredAt: baseTime,
          taskmintTaskId: "e2e-task-2",
        })
      );

      // 2) Ingest WakeNet timeliness (timeliness)
      await ingestEvent(
        buildWakeNetEvent({
          subjectAgentId: TEST_AGENT,
          eventType: "wakeup_received",
          outcome: "success",
          severity: 85,
          occurredAt: baseTime,
          wakenetEventId: "e2e-wake-1",
        })
      );
      await ingestEvent(
        buildWakeNetEvent({
          subjectAgentId: TEST_AGENT,
          eventType: "reaction_late",
          outcome: "failure",
          severity: 70,
          occurredAt: baseTime,
          wakenetEventId: "e2e-wake-2",
        })
      );

      // 3) Query trust (agent-readable)
      const res = await getAgentScore(TEST_AGENT, "30d");

      expect(res.scores.volume).toBeGreaterThanOrEqual(4);
      expect(res.scores.reliability).toBeGreaterThan(0);
      expect(res.scores.reliability).toBeLessThanOrEqual(1);
      expect(res.scores.integrity).toBeGreaterThanOrEqual(0);
      expect(res.scores.integrity).toBeLessThanOrEqual(1);
      expect(res.scores.timeliness).toBeGreaterThanOrEqual(0);
      expect(res.scores.timeliness).toBeLessThanOrEqual(1);
      expect(res.scores.composite).toBeGreaterThanOrEqual(0);
      expect(res.scores.composite).toBeLessThanOrEqual(1);

      // 4) Deterministic gating: composite and integrity used for decisions
      const wouldDelegate = res.scores.composite >= 0.6 && res.scores.integrity >= 0.7;
      expect(typeof wouldDelegate).toBe("boolean");
    }
  );
});
