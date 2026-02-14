#!/usr/bin/env node
/**
 * Recompute trust_scores without locking the DB as agent count grows.
 * - Lazy recompute: scores are updated on each ingest (new event). No full scan.
 * - Cron runs recomputeStaleScores(batchSize): only agents with new events since last score update.
 * Set SCORE_RECOMPUTE_BATCH_SIZE=0 for lazy-only (default). Set e.g. 200 to process up to 200 stale pairs per run.
 */
import "dotenv/config";
import { recomputeStaleScores } from "../scoring/engine.js";
import { closePool } from "../db/client.js";
import { config } from "../config.js";

async function main() {
  const batchSize = config.scoreRecomputeBatchSize;
  const result = await recomputeStaleScores(batchSize);
  console.log(result.message);
  if (result.processed > 0) {
    console.log(`Processed ${result.processed} stale agent/skill score(s).`);
  }
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
