/**
 * Public (non-auth) viral surfaces: agent profile, leaderboard, Trust Card, operator dashboard.
 * GET /agent/:agentId
 * GET /leaderboard
 * GET /agent/:agentId/card.svg
 * GET /agent/:agentId/card.png (returns SVG for now; PNG can be added via sharp)
 * GET /operator/:id
 */

import { Router, type Request, type Response } from "express";
import {
  getAgentProfilePublic,
  getLeaderboard,
  getOperatorDashboard,
} from "../services/leaderboard.js";
import { generateTrustCardSvg } from "../services/card.js";
import { LEADERBOARD_WINDOWS } from "../types.js";
import type { LeaderboardWindow, LeaderboardScope } from "../types.js";

const DEFAULT_WINDOW: LeaderboardWindow = "30d";
const DEFAULT_SCOPE: LeaderboardScope = "all";
const MAX_LEADERBOARD_LIMIT = 500;

export function createPublicRouter(): Router {
  const router = Router();

  /** GET /agent/:agentId — public agent page (JSON). */
  router.get("/agent/:agentId", async (req: Request, res: Response) => {
    const agentId = decodeURIComponent(req.params.agentId);
    const window = (req.query.window as LeaderboardWindow) || DEFAULT_WINDOW;
    if (!LEADERBOARD_WINDOWS.includes(window)) {
      return res.status(400).json({
        error: "Invalid window",
        allowed: LEADERBOARD_WINDOWS,
      });
    }
    const profile = await getAgentProfilePublic(agentId, window);
    if (!profile) {
      return res.status(404).json({ error: "Agent not found", agentId });
    }
    res.json(profile);
  });

  /** GET /leaderboard — time, scope, skillId, limit. */
  router.get("/leaderboard", async (req: Request, res: Response) => {
    const time = (req.query.time as LeaderboardWindow) || DEFAULT_WINDOW;
    const scope = (req.query.scope as LeaderboardScope) || DEFAULT_SCOPE;
    const skillId = (req.query.skillId as string) || null;
    const limit = Math.min(
      parseInt(String(req.query.limit || "100"), 10) || 100,
      MAX_LEADERBOARD_LIMIT
    );

    if (!LEADERBOARD_WINDOWS.includes(time)) {
      return res.status(400).json({
        error: "Invalid time",
        allowed: LEADERBOARD_WINDOWS,
      });
    }
    if (scope !== "all" && scope !== "verified") {
      return res.status(400).json({
        error: "Invalid scope",
        allowed: ["all", "verified"],
      });
    }

    const rows = await getLeaderboard(time, scope, skillId, limit);
    res.json({ window: time, scope, skillId, rows });
  });

  /** GET /agent/:agentId/card.svg — shareable Trust Card (SVG). */
  router.get("/agent/:agentId/card.svg", async (req: Request, res: Response) => {
    const agentId = decodeURIComponent(req.params.agentId);
    const window = (req.query.window as LeaderboardWindow) || DEFAULT_WINDOW;
    const profile = await getAgentProfilePublic(agentId, window);
    if (!profile) {
      return res.status(404).json({ error: "Agent not found", agentId });
    }
    const svg = generateTrustCardSvg(profile);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(svg);
  });

  /** GET /agent/:agentId/card.png — Trust Card; currently returns SVG (PNG TBD). */
  router.get("/agent/:agentId/card.png", async (req: Request, res: Response) => {
    const agentId = decodeURIComponent(req.params.agentId);
    const window = (req.query.window as LeaderboardWindow) || DEFAULT_WINDOW;
    const profile = await getAgentProfilePublic(agentId, window);
    if (!profile) {
      return res.status(404).json({ error: "Agent not found", agentId });
    }
    const svg = generateTrustCardSvg(profile);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(svg);
  });

  /** GET /operator/:id — operator dashboard. */
  router.get("/operator/:id", async (req: Request, res: Response) => {
    const operatorId = decodeURIComponent(req.params.id);
    const window = (req.query.window as LeaderboardWindow) || DEFAULT_WINDOW;
    const dashboard = await getOperatorDashboard(operatorId, window);
    if (!dashboard) {
      return res.status(404).json({ error: "Operator not found", operatorId });
    }
    res.json(dashboard);
  });

  return router;
}
