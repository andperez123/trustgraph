#!/usr/bin/env node
/**
 * Recompute all trust_scores from trust_events.
 * Run every 5–15 min via cron: npm run job:scores
 */
import { recomputeAllScores } from "../scoring/engine.js";
import { closePool } from "../db/client.js";

async function main() {
  const result = await recomputeAllScores();
  console.log(`Recomputed scores for ${result.agents} agent/skill combinations.`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
