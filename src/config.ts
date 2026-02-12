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
} as const;
