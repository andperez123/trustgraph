/**
 * TrustGraph configuration.
 * All env vars are optional except DATABASE_URL when using DB.
 */

export const config = {
  port: parseInt(process.env.PORT ?? "3040", 10),
  databaseUrl: process.env.DATABASE_URL ?? "",
  writeKey: process.env.TRUSTGRAPH_WRITE_KEY ?? null,
  enforceWriteKey: process.env.TRUSTGRAPH_ENFORCE_WRITE_KEY === "true",
  scoreRecomputeIntervalMinutes: parseInt(
    process.env.SCORE_RECOMPUTE_INTERVAL_MINUTES ?? "10",
    10
  ),
  /** Public base URL for share links and Trust Card (e.g. https://trustgraph.xyz) */
  publicBaseUrl: process.env.TRUSTGRAPH_PUBLIC_BASE_URL ?? "http://localhost:3040",
  /** Capnet Runtime webhook: optional secret for POST /trust/webhooks/capnet (e.g. x-trustgraph-capnet-secret header) */
  capnetWebhookSecret: process.env.TRUSTGRAPH_CAPNET_WEBHOOK_SECRET ?? null,
  /** Recompute job: max agents to process per cron run (avoids long locks). 0 = only lazy recompute on ingest. */
  scoreRecomputeBatchSize: parseInt(process.env.SCORE_RECOMPUTE_BATCH_SIZE ?? "0", 10),
} as const;
