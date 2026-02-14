/**
 * TrustGraph REST API server.
 * Default port 3040. Set PORT and DATABASE_URL.
 */
import "dotenv/config";
import express from "express";
import { createTrustRouter } from "./trust.js";
import { createPublicRouter } from "./public.js";
import { createWebhooksRouter } from "./webhooks.js";
import { config } from "../config.js";

const app = express();
app.use(express.json());

const healthPayload = { status: "ok", service: "trustgraph" };
app.get("/health", (_req, res) => res.json(healthPayload));
app.get("/trust/health", (_req, res) => res.json(healthPayload));

app.use(createPublicRouter());
app.use(createTrustRouter());
app.use(createWebhooksRouter());

const host = process.env.HOST ?? "0.0.0.0";
const server = app.listen(config.port, host, () => {
  console.log(`TrustGraph API listening on ${host}:${config.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
