#!/usr/bin/env node
/**
 * Run schema.sql against DATABASE_URL.
 * Usage: npm run db:migrate  (or tsx src/db/migrate.ts)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getPool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "schema.sql");

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const sql = readFileSync(schemaPath, "utf-8");
  const pool = getPool();
  await pool.query(sql);
  console.log("TrustGraph schema applied.");
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
