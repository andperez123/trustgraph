/**
 * Unit tests for dispatch gate (reliability < 0.5 → refuse).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDispatchGate, DISPATCH_RELIABILITY_THRESHOLD } from "./dispatch.js";

vi.mock("../services/trust-read.js", () => ({
  getAgentScore: vi.fn(),
}));

const { getAgentScore } = await import("../services/trust-read.js");

describe("checkDispatchGate", () => {
  beforeEach(() => {
    vi.mocked(getAgentScore).mockReset();
  });

  it("allows dispatch when reliability >= 0.5", async () => {
    vi.mocked(getAgentScore).mockResolvedValue({
      scores: {
        reliability: 0.5,
        integrity: 1,
        timeliness: 0.8,
        composite: 0.9,
        volume: 10,
      },
      updatedAt: new Date().toISOString(),
    });
    const result = await checkDispatchGate("agent-1");
    expect(result.allowed).toBe(true);
    expect(result.scores.reliability).toBe(0.5);
  });

  it("refuses dispatch when reliability < 0.5", async () => {
    vi.mocked(getAgentScore).mockResolvedValue({
      scores: {
        reliability: 0.42,
        integrity: 0.9,
        timeliness: 0.7,
        composite: 0.6,
        volume: 5,
      },
      updatedAt: new Date().toISOString(),
    });
    const result = await checkDispatchGate("agent-2");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(DISPATCH_RELIABILITY_THRESHOLD.toString());
    expect(result.scores.reliability).toBe(0.42);
  });

  it("threshold constant is 0.5", () => {
    expect(DISPATCH_RELIABILITY_THRESHOLD).toBe(0.5);
  });
});
