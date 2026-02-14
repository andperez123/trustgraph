/**
 * Webhook endpoints for external runtimes (e.g. Capnet Runtime).
 * POST /trust/webhooks/capnet — push events; optional TRUSTGRAPH_CAPNET_WEBHOOK_SECRET.
 */

import { Router, type Request, type Response } from "express";
import { ingestEventBatch } from "../events/ingest.js";
import { config } from "../config.js";
import type { IngestEventInput } from "../types.js";
import { z } from "zod";

const capnetEventSchema = z.object({
  subjectAgentId: z.string().min(1),
  actorAgentId: z.string().nullable().optional(),
  skillId: z.string().nullable().optional(),
  source: z.string().min(1).optional(),
  eventType: z.string().min(1),
  outcome: z.string().min(1),
  severity: z.number().int().min(1).max(100),
  valueUsdMicros: z.number().int().nonnegative().nullable().optional(),
  occurredAt: z.string().datetime(),
  externalRefType: z.string().nullable().optional(),
  externalRefId: z.string().nullable().optional(),
  evidence: z.record(z.unknown()).nullable().optional(),
});

const capnetWebhookBodySchema = z.object({
  events: z.array(capnetEventSchema).min(1).max(500),
});

function checkCapnetSecret(req: Request, res: Response): boolean {
  if (!config.capnetWebhookSecret) return true;
  const secret =
    req.headers["x-trustgraph-capnet-secret"] ??
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "").trim() || undefined
      : undefined) ??
    (req.body as Record<string, unknown>)?.secret;
  if (secret === config.capnetWebhookSecret) return true;
  res.status(401).json({
    error: "Unauthorized",
    message: "Invalid or missing Capnet webhook secret (x-trustgraph-capnet-secret or Bearer).",
  });
  return false;
}

/** Normalize Capnet payload to IngestEventInput (default source = capnet). */
function toIngestInput(raw: z.infer<typeof capnetEventSchema>): IngestEventInput {
  return {
    subjectAgentId: raw.subjectAgentId,
    actorAgentId: raw.actorAgentId ?? null,
    skillId: raw.skillId ?? null,
    source: raw.source ?? "capnet",
    eventType: raw.eventType,
    outcome: raw.outcome,
    severity: raw.severity,
    valueUsdMicros: raw.valueUsdMicros ?? null,
    occurredAt: raw.occurredAt,
    externalRefType: raw.externalRefType ?? null,
    externalRefId: raw.externalRefId ?? null,
    evidence: raw.evidence ?? null,
  };
}

export function createWebhooksRouter(): Router {
  const router = Router();

  /** POST /trust/webhooks/capnet — Capnet Runtime pushes events here. */
  router.post("/trust/webhooks/capnet", async (req: Request, res: Response) => {
    if (!checkCapnetSecret(req, res)) return;
    const parsed = capnetWebhookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    try {
      const events: IngestEventInput[] = parsed.data.events.map(toIngestInput);
      const result = await ingestEventBatch(events);
      res.status(201).json(result);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error("POST /trust/webhooks/capnet error:", err.message ?? err, e);
      res.status(500).json({
        error: "Internal server error",
        message: "Webhook ingest failed",
        code: err.code ?? undefined,
        detail: err.message ?? undefined,
      });
    }
  });

  return router;
}
