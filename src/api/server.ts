/**
 * TrustGraph REST API server.
 * Default port 3040. Set PORT and DATABASE_URL.
 */
import express from "express";
import { createTrustRouter } from "./trust.js";
import { createPublicRouter } from "./public.js";
import { config } from "../config.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "trustgraph" });
});

app.use(createPublicRouter());
app.use(createTrustRouter());

const server = app.listen(config.port, () => {
  console.log(`TrustGraph API listening on port ${config.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
