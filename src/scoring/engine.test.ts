/**
 * Unit tests for deterministic scoring engine.
 */
import { describe, it, expect } from "vitest";
import { computeScores } from "./engine.js";
import type { TrustEventRow } from "../types.js";

function row(overrides: Partial<TrustEventRow>): TrustEventRow {
  return {
    id: "id",
    subject_agent_id: "a1",
    actor_agent_id: null,
    skill_id: null,
    source: "test",
    event_type: "task_completed",
    outcome: "success",
    severity: 80,
    value_usd_micros: null,
    occurred_at: new Date(),
    observed_at: new Date(),
    external_ref_type: null,
    external_ref_id: null,
    evidence: null,
    ...overrides,
  };
}

describe("computeScores", () => {
  it("returns default-like scores when no events", () => {
    const result = computeScores({
      subjectAgentId: "a1",
      skillId: null,
      window: "30d",
      events: [],
    });
    expect(result.reliability).toBe(0.5);
    expect(result.integrity).toBe(1);
    expect(result.timeliness).toBe(0); // no timeliness events → 0
    expect(result.composite).toBeCloseTo(0.45 * 1 + 0.35 * 0.5 + 0.2 * 0, 3);
    expect(result.volume).toBe(0);
  });

  it("reliability: success vs failure", () => {
    const events: TrustEventRow[] = [
      row({ event_type: "task_completed", outcome: "success", severity: 100 }),
      row({ event_type: "task_failed", outcome: "failure", severity: 100 }),
    ];
    const result = computeScores({
      subjectAgentId: "a1",
      skillId: null,
      window: "30d",
      events,
    });
    expect(result.reliability).toBe(0.5);
    expect(result.volume).toBe(2);
  });

  it("integrity: disputes reduce score", () => {
    const events: TrustEventRow[] = [
      row({ event_type: "task_completed", outcome: "success", severity: 50 }),
      row({ event_type: "task_disputed", outcome: "failure", severity: 100 }),
    ];
    const result = computeScores({
      subjectAgentId: "a1",
      skillId: null,
      window: "30d",
      events,
    });
    expect(result.integrity).toBeLessThan(1);
    expect(result.composite).toBeLessThan(1);
  });

  it("timeliness: wakeup_received vs reaction_late", () => {
    const events: TrustEventRow[] = [
      row({ event_type: "wakeup_received", outcome: "success", severity: 100 }),
      row({ event_type: "reaction_late", outcome: "failure", severity: 100 }),
    ];
    const result = computeScores({
      subjectAgentId: "a1",
      skillId: null,
      window: "30d",
      events,
    });
    expect(result.timeliness).toBe(0.5);
  });

  it("composite = 0.45*integrity + 0.35*reliability + 0.20*timeliness", () => {
    const events: TrustEventRow[] = [
      row({ event_type: "task_completed", outcome: "success", severity: 100 }),
    ];
    const result = computeScores({
      subjectAgentId: "a1",
      skillId: null,
      window: "30d",
      events,
    });
    const expected =
      0.45 * result.integrity + 0.35 * result.reliability + 0.2 * result.timeliness;
    expect(result.composite).toBeCloseTo(expected, 3);
  });
});
