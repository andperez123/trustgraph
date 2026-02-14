/**
 * Trust read/write API handlers.
 * GET /trust/agents/:agentId?window=30d
 * GET /trust/agents/:agentId/skills/:skillId?window=30d
 * GET /trust/gate/dispatch?agentId=...&window=30d  — Gatekeeper for Runtime (reliability < 0.5 → refuse)
 * POST /trust/events (optional TRUSTGRAPH_WRITE_KEY)
 * POST /trust/events/batch
 */

import { Router, type Request, type Response } from "express";
import { query } from "../db/client.js";
import { ingestEvent, ingestEventBatch } from "../events/ingest.js";
import { checkDispatchGate } from "../gatekeeper/dispatch.js";
import { config } from "../config.js";
import type { TrustScoresResponse, ScoreWindow } from "../types.js";
import { SCORE_WINDOWS } from "../types.js";
import { z } from "zod";

const DEFAULT_WINDOW: ScoreWindow = "30d";

const eventBodySchema = z.object({
  subjectAgentId: z.string().min(1),
  actorAgentId: z.string().nullable().optional(),
  skillId: z.string().nullable().optional(),
  source: z.string().min(1),
  eventType: z.string().min(1),
  outcome: z.string().min(1),
  severity: z.number().int().min(1).max(100),
  valueUsdMicros: z.number().int().nonnegative().nullable().optional(),
  occurredAt: z.string().datetime(),
  externalRefType: z.string().nullable().optional(),
  externalRefId: z.string().nullable().optional(),
  evidence: z.record(z.unknown()).nullable().optional(),
});

const batchBodySchema = z.object({
  events: z.array(eventBodySchema),
});

function checkWriteKey(req: Request, res: Response): boolean {
  if (!config.enforceWriteKey) return true;
  const key = req.headers["x-trustgraph-write-key"] ?? req.query.writeKey;
  if (key === config.writeKey) return true;
  res.status(401).json({
    error: "This server requires a write key",
    message: "Provide x-trustgraph-write-key header or writeKey query param.",
  });
  return false;
}

export function createTrustRouter(): Router {
  const router = Router();

  /** GET /trust/agents/:agentId?window=30d */
  router.get("/trust/agents/:agentId", async (req: Request, res: Response) => {
    const agentId = req.params.agentId;
    const window = (req.query.window as string) || DEFAULT_WINDOW;
    if (!SCORE_WINDOWS.includes(window as ScoreWindow)) {
      return res.status(400).json({ error: "Invalid window", allowed: SCORE_WINDOWS });
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
    if (rows.length === 0) {
      return res.status(200).json({
        scores: {
          reliability: 0.5,
          integrity: 1,
          timeliness: 0.5,
          composite: 0.5,
          volume: 0,
        },
        updatedAt: new Date().toISOString(),
      } satisfies TrustScoresResponse);
    }
    const r = rows[0];
    const body: TrustScoresResponse = {
      scores: {
        reliability: r.reliability,
        integrity: r.integrity,
        timeliness: r.timeliness,
        composite: r.composite,
        volume: r.volume,
      },
      updatedAt: r.updated_at.toISOString(),
    };
    res.json(body);
  });

  /** GET /trust/agents/:agentId/skills/:skillId?window=30d */
  router.get(
    "/trust/agents/:agentId/skills/:skillId",
    async (req: Request, res: Response) => {
      const { agentId, skillId } = req.params;
      const window = (req.query.window as string) || DEFAULT_WINDOW;
      if (!SCORE_WINDOWS.includes(window as ScoreWindow)) {
        return res.status(400).json({ error: "Invalid window", allowed: SCORE_WINDOWS });
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
      if (rows.length === 0) {
        return res.status(200).json({
          scores: {
            reliability: 0.5,
            integrity: 1,
            timeliness: 0.5,
            composite: 0.5,
            volume: 0,
          },
          updatedAt: new Date().toISOString(),
        } satisfies TrustScoresResponse);
      }
      const r = rows[0];
      const body: TrustScoresResponse = {
        scores: {
          reliability: r.reliability,
          integrity: r.integrity,
          timeliness: r.timeliness,
          composite: r.composite,
          volume: r.volume,
        },
        updatedAt: r.updated_at.toISOString(),
      };
      res.json(body);
    }
  );

  /** GET /trust/gate/dispatch?agentId=...&window=30d — Runtime calls before dispatch; reliability < 0.5 → refuse */
  router.get("/trust/gate/dispatch", async (req: Request, res: Response) => {
    const agentId = req.query.agentId as string;
    const window = (req.query.window as string) || DEFAULT_WINDOW;
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "Missing or invalid agentId query parameter" });
    }
    if (!SCORE_WINDOWS.includes(window as ScoreWindow)) {
      return res.status(400).json({ error: "Invalid window", allowed: SCORE_WINDOWS });
    }
    const result = await checkDispatchGate(agentId, { window });
    return res.status(200).json(result);
  });

  /** POST /trust/events */
  router.post("/trust/events", async (req: Request, res: Response) => {
    if (!checkWriteKey(req, res)) return;
    const parsed = eventBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const { id } = await ingestEvent(parsed.data);
      res.status(201).json({ id });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "23505") {
        return res.status(409).json({ error: "Duplicate event (idempotency conflict)" });
      }
      console.error("POST /trust/events error:", err.message ?? err, e);
      res.status(500).json({
        error: "Internal server error",
        message: "Event ingest failed",
        code: err.code ?? undefined,
        detail: err.message ?? undefined,
      });
    }
  });

  /** POST /trust/events/batch */
  router.post("/trust/events/batch", async (req: Request, res: Response) => {
    if (!checkWriteKey(req, res)) return;
    const parsed = batchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const result = await ingestEventBatch(parsed.data.events);
      res.status(201).json(result);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error("POST /trust/events/batch error:", err.message ?? err, e);
      res.status(500).json({
        error: "Internal server error",
        message: "Batch ingest failed",
        code: err.code ?? undefined,
        detail: err.message ?? undefined,
      });
    }
  });

  return router;
}
