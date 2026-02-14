/**
 * Deterministic trust scoring engine.
 * Windows: 7d, 30d, 180d, all.
 * Composite = 0.45*integrity + 0.35*reliability + 0.20*timeliness
 */

import { query } from "../db/client.js";
import type { TrustEventRow } from "../types.js";
import { SCORE_WINDOWS, type ScoreWindow } from "../types.js";

const EPS = 1e-9;

/** Map event_type + outcome to success/failure/late/missed for weighting */
function eventWeight(
  row: TrustEventRow
): { success: number; failure: number; integrityBad: number; onTime: number; late: number; missed: number } {
  const o = row.outcome.toLowerCase();
  const t = row.event_type;
  const s = row.severity / 100;
  let success = 0,
    failure = 0,
    integrityBad = 0,
    onTime = 0,
    late = 0,
    missed = 0;

  // Task / work
  if (t === "task_completed" && o === "success") {
    success = s;
  } else if (t === "task_failed" || t === "task_timeout") {
    failure = s;
  } else if (t === "task_disputed" || t === "task_reversed") {
    integrityBad = s;
  }
  // Execution
  if (t === "execution_proved" && o === "success") {
    success += s * 0.5;
  } else if (t === "execution_invalid") {
    integrityBad += s;
  }
  // WakeNet
  if (t === "wakeup_received" && o === "success") {
    onTime = s;
  } else if (t === "reaction_late") {
    late = s;
  } else if (t === "wakeup_missed") {
    missed = s;
  }
  // Payments
  if (t === "payment_settled" && o === "success") {
    success += s * 0.5;
  } else if (t === "payment_reversed") {
    integrityBad += s;
  }

  return { success, failure, integrityBad, onTime, late, missed };
}

function toTimestamp(now: Date, window: ScoreWindow): Date | null {
  const d = new Date(now);
  switch (window) {
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "180d":
      d.setDate(d.getDate() - 180);
      return d;
    case "all":
      return null;
    default:
      return null;
  }
}

export interface ScoreInput {
  subjectAgentId: string;
  skillId: string | null;
  window: ScoreWindow;
  events: TrustEventRow[];
}

export function computeScores(input: ScoreInput): {
  reliability: number;
  integrity: number;
  timeliness: number;
  composite: number;
  volume: number;
  valueUsdMicros: number;
} {
  const { subjectAgentId: _sub, skillId: _sk, window: _w, events } = input;
  let weightedSuccess = 0,
    weightedFailure = 0,
    badIntegrityWeight = 0,
    totalIntegrityWeight = 0,
    onTime = 0,
    late = 0,
    missed = 0,
    valueUsdMicros = 0;

  for (const row of events) {
    const w = eventWeight(row);
    weightedSuccess += w.success;
    weightedFailure += w.failure;
    badIntegrityWeight += w.integrityBad;
    totalIntegrityWeight += w.success + w.failure + w.integrityBad + w.onTime + w.late + w.missed;
    onTime += w.onTime;
    late += w.late;
    missed += w.missed;
    valueUsdMicros += row.value_usd_micros ?? 0;
  }

  const totalWeight = weightedSuccess + weightedFailure + badIntegrityWeight;
  const reliability =
    totalWeight > 0
      ? weightedSuccess / (weightedSuccess + weightedFailure + EPS)
      : 0.5;
  const integrity =
    totalIntegrityWeight > 0
      ? Math.max(0, 1 - badIntegrityWeight / (totalIntegrityWeight + EPS))
      : 1;
  const timeDenom = onTime + late + missed + EPS;
  const timeliness = onTime / timeDenom;

  const composite = 0.45 * integrity + 0.35 * reliability + 0.2 * timeliness;

  return {
    reliability: Math.round(reliability * 1000) / 1000,
    integrity: Math.round(integrity * 1000) / 1000,
    timeliness: Math.round(timeliness * 1000) / 1000,
    composite: Math.round(composite * 1000) / 1000,
    volume: events.length,
    valueUsdMicros,
  };
}

export async function recomputeScoresForAgent(
  subjectAgentId: string,
  skillId: string | null
): Promise<void> {
  const now = new Date();
  const pool = (await import("../db/client.js")).getPool();

  for (const window of SCORE_WINDOWS) {
    const since = toTimestamp(now, window);
    let sql = `
      SELECT id, subject_agent_id, actor_agent_id, skill_id, source, event_type, outcome, severity,
             value_usd_micros, occurred_at, observed_at, external_ref_type, external_ref_id, evidence
      FROM trust_events
      WHERE subject_agent_id = $1
    `;
    const params: (string | Date | null)[] = [subjectAgentId];
    if (skillId !== undefined && skillId !== null) {
      sql += " AND (skill_id IS NULL OR skill_id = $2)";
      params.push(skillId);
    }
    if (since) {
      sql += ` AND occurred_at >= $${params.length + 1}`;
      params.push(since);
    }
    sql += " ORDER BY occurred_at ASC";

    const { rows } = await query<TrustEventRow>(sql, params);
    const result = computeScores({
      subjectAgentId,
      skillId,
      window,
      events: rows,
    });

    await pool.query(
      `INSERT INTO trust_scores (subject_agent_id, skill_id, "window", reliability, integrity, timeliness, composite, volume, value_usd_micros, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (subject_agent_id, skill_id, "window")
       DO UPDATE SET reliability = $4, integrity = $5, timeliness = $6, composite = $7, volume = $8, value_usd_micros = $9, updated_at = now()`,
      [
        subjectAgentId,
        skillId ?? "", // PK requires non-null; use "" for agent-level (all skills)
        window,
        result.reliability,
        result.integrity,
        result.timeliness,
        result.composite,
        result.volume,
        result.valueUsdMicros,
      ]
    );
  }
}

export async function recomputeAllScores(): Promise<{ agents: number }> {
  const { rows } = await query<{ subject_agent_id: string; skill_id: string | null }>(
    `SELECT DISTINCT subject_agent_id, skill_id FROM trust_events`
  );
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.subject_agent_id}:${r.skill_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await recomputeScoresForAgent(r.subject_agent_id, r.skill_id);
  }
  return { agents: seen.size };
}

/** Keys (subject_agent_id, skill_id) that need recompute: no score row or latest event is newer than score.updated_at. */
export async function getStaleAgentScoreKeys(
  limit: number
): Promise<{ subject_agent_id: string; skill_id: string | null }[]> {
  const { rows } = await query<{ subject_agent_id: string; skill_id: string | null }>(
    `WITH latest_events AS (
       SELECT subject_agent_id, skill_id, MAX(occurred_at) AS latest_occurred
       FROM trust_events
       GROUP BY subject_agent_id, skill_id
     ),
     score_updated AS (
       SELECT subject_agent_id, skill_id, updated_at
       FROM trust_scores
       WHERE "window" = '30d'
     )
     SELECT e.subject_agent_id, e.skill_id
     FROM latest_events e
     LEFT JOIN score_updated s ON e.subject_agent_id = s.subject_agent_id
       AND COALESCE(e.skill_id, '') = COALESCE(s.skill_id, '')
     WHERE s.updated_at IS NULL OR e.latest_occurred > s.updated_at
     ORDER BY e.latest_occurred DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Recompute only stale agent/skill pairs (events newer than score or no score).
 * Processes up to batchSize pairs; each pair is one short transaction. Avoids full-table lock.
 * Use batchSize 0 to do nothing (lazy-only mode).
 */
export async function recomputeStaleScores(batchSize: number): Promise<{
  processed: number;
  message: string;
}> {
  if (batchSize <= 0) {
    return { processed: 0, message: "Lazy-only: no batch recompute (scores updated on ingest)." };
  }
  const stale = await getStaleAgentScoreKeys(batchSize);
  for (const r of stale) {
    await recomputeScoresForAgent(r.subject_agent_id, r.skill_id);
  }
  return {
    processed: stale.length,
    message:
      stale.length === 0
        ? "No stale scores to recompute."
        : `Recomputed ${stale.length} agent/skill score(s).`,
  };
}
