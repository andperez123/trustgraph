import { randomUUID } from "node:crypto";
import { query, getPool } from "../db/client.js";
import { recomputeScoresForAgent } from "../scoring/engine.js";
import type { IngestEventInput } from "../types.js";

/** Ensure agent exists (upsert by id). */
async function ensureAgent(agentId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO agents (id, last_seen_at) VALUES ($1, now())
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
    [agentId]
  );
}

/** Ingest a single event. Idempotent by (external_ref_type, external_ref_id). */
export async function ingestEvent(input: IngestEventInput): Promise<{ id: string }> {
  const id = randomUUID();
  const pool = getPool();
  await ensureAgent(input.subjectAgentId);
  if (input.actorAgentId) await ensureAgent(input.actorAgentId);

  await pool.query(
    `INSERT INTO trust_events (
      id, subject_agent_id, actor_agent_id, skill_id, source, event_type, outcome, severity,
      value_usd_micros, occurred_at, external_ref_type, external_ref_id, evidence
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.subjectAgentId,
      input.actorAgentId ?? null,
      input.skillId ?? null,
      input.source,
      input.eventType,
      input.outcome,
      Math.max(1, Math.min(100, input.severity)),
      input.valueUsdMicros ?? null,
      input.occurredAt,
      input.externalRefType ?? null,
      input.externalRefId ?? null,
      input.evidence ? JSON.stringify(input.evidence) : null,
    ]
  );

  await recomputeScoresForAgent(input.subjectAgentId, input.skillId ?? null);
  return { id };
}

/** Batch ingest. Each event idempotent by external_ref when both provided. Skips duplicates. */
export async function ingestEventBatch(inputs: IngestEventInput[]): Promise<{
  inserted: number;
  skipped: number;
  ids: string[];
}> {
  const pool = getPool();
  const ids: string[] = [];
  const recomputeKeys = new Set<string>();
  let inserted = 0,
    skipped = 0;

  for (const input of inputs) {
    try {
      await ensureAgent(input.subjectAgentId);
      if (input.actorAgentId) await ensureAgent(input.actorAgentId);

      const id = randomUUID();
      const hasRef =
        input.externalRefType != null &&
        input.externalRefId != null &&
        input.externalRefType !== "" &&
        input.externalRefId !== "";

      const result = hasRef
        ? await pool.query(
            `INSERT INTO trust_events (
              id, subject_agent_id, actor_agent_id, skill_id, source, event_type, outcome, severity,
              value_usd_micros, occurred_at, external_ref_type, external_ref_id, evidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (external_ref_type, external_ref_id) DO NOTHING`,
            [
              id,
              input.subjectAgentId,
              input.actorAgentId ?? null,
              input.skillId ?? null,
              input.source,
              input.eventType,
              input.outcome,
              Math.max(1, Math.min(100, input.severity)),
              input.valueUsdMicros ?? null,
              input.occurredAt,
              input.externalRefType ?? null,
              input.externalRefId ?? null,
              input.evidence ? JSON.stringify(input.evidence) : null,
            ]
          )
        : await pool.query(
            `INSERT INTO trust_events (
              id, subject_agent_id, actor_agent_id, skill_id, source, event_type, outcome, severity,
              value_usd_micros, occurred_at, evidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              id,
              input.subjectAgentId,
              input.actorAgentId ?? null,
              input.skillId ?? null,
              input.source,
              input.eventType,
              input.outcome,
              Math.max(1, Math.min(100, input.severity)),
              input.valueUsdMicros ?? null,
              input.occurredAt,
              input.evidence ? JSON.stringify(input.evidence) : null,
            ]
          );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
        ids.push(id);
        recomputeKeys.add(`${input.subjectAgentId}:${input.skillId ?? ""}`);
      } else {
        skipped++;
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  for (const key of recomputeKeys) {
    const [subjectAgentId, skillId] = key.split(":");
    await recomputeScoresForAgent(subjectAgentId, skillId || null);
  }

  return { inserted, skipped, ids };
}
