/**
 * Trust read service — used by API and MCP.
 */
import { query } from "../db/client.js";
import type { TrustScoresResponse, ScoreWindow } from "../types.js";
import { SCORE_WINDOWS } from "../types.js";

const DEFAULT_WINDOW: ScoreWindow = "30d";

const defaultScores: TrustScoresResponse = {
  scores: {
    reliability: 0.5,
    integrity: 1,
    timeliness: 0.5,
    composite: 0.5,
    volume: 0,
  },
  updatedAt: new Date().toISOString(),
};

export async function getAgentScore(
  agentId: string,
  window: string = DEFAULT_WINDOW
): Promise<TrustScoresResponse> {
  if (!SCORE_WINDOWS.includes(window as ScoreWindow)) {
    return defaultScores;
  }
  const { rows } = await query<{
    reliability: number;
    integrity: number;
    timeliness: number;
    composite: number;
    volume: number;
    updated_at: Date;
  }>(
    `SELECT reliability, integrity, timeliness, composite, volume, updated_at
     FROM trust_scores
     WHERE subject_agent_id = $1 AND skill_id IS NULL AND "window" = $2`,
    [agentId, window]
  );
  if (rows.length === 0) return defaultScores;
  const r = rows[0];
  return {
    scores: {
      reliability: r.reliability,
      integrity: r.integrity,
      timeliness: r.timeliness,
      composite: r.composite,
      volume: r.volume,
    },
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function getSkillScore(
  agentId: string,
  skillId: string,
  window: string = DEFAULT_WINDOW
): Promise<TrustScoresResponse> {
  if (!SCORE_WINDOWS.includes(window as ScoreWindow)) {
    return defaultScores;
  }
  const { rows } = await query<{
    reliability: number;
    integrity: number;
    timeliness: number;
    composite: number;
    volume: number;
    updated_at: Date;
  }>(
    `SELECT reliability, integrity, timeliness, composite, volume, updated_at
     FROM trust_scores
     WHERE subject_agent_id = $1 AND skill_id = $2 AND "window" = $3`,
    [agentId, skillId, window]
  );
  if (rows.length === 0) return defaultScores;
  const r = rows[0];
  return {
    scores: {
      reliability: r.reliability,
      integrity: r.integrity,
      timeliness: r.timeliness,
      composite: r.composite,
      volume: r.volume,
    },
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function health(): Promise<{ ok: boolean; error?: string }> {
  try {
    const pool = (await import("../db/client.js")).getPool();
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
