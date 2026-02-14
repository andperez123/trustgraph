/**
 * Leaderboard, public agent profile, and badge computation.
 * Anti-gaming: min_events and min_unique_sources from ranking_config.
 */

import { query } from "../db/client.js";
import { config } from "../config.js";
import type {
  LeaderboardWindow,
  LeaderboardScope,
  LeaderboardRow,
  AgentProfilePublic,
  OperatorDashboard,
  OperatorDashboardAgent,
} from "../types.js";
import { LEADERBOARD_WINDOWS } from "../types.js";

const DEFAULT_WINDOW: LeaderboardWindow = "30d";
const DEFAULT_LIMIT = 100;

function windowInterval(window: LeaderboardWindow): string {
  switch (window) {
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "180d":
      return "180 days";
    case "all":
      return "10000 years";
    default:
      return "30 days";
  }
}

async function getRankingConfig(
  window: string
): Promise<{ min_events: number; min_unique_sources: number }> {
  const { rows } = await query<{ min_events: number; min_unique_sources: number }>(
    'SELECT min_events, min_unique_sources FROM ranking_config WHERE "window" = $1',
    [window]
  );
  if (rows.length === 0) return { min_events: 5, min_unique_sources: 2 };
  return rows[0];
}

/** Get rank (1-based) and total eligible for an agent. */
export async function getRank(
  agentId: string,
  window: LeaderboardWindow,
  skillId: string | null = null
): Promise<{ rank: number; total: number } | null> {
  const cfg = await getRankingConfig(window);
  const interval = windowInterval(window);
  const sinceClause =
    window === "all"
      ? "true"
      : `te.occurred_at >= now() - interval '${interval}'`;

  const skillCondition = skillId ? "AND ts.skill_id = $4" : "AND ts.skill_id IS NULL";
  const params: (string | number)[] = [window, cfg.min_events, cfg.min_unique_sources];
  if (skillId) params.push(skillId);
  params.push(agentId);

  const { rows } = await query<{ rn: string; total: string }>(
    `
    WITH event_sources AS (
      SELECT subject_agent_id, COUNT(DISTINCT source) AS unique_sources
      FROM trust_events te
      WHERE ${sinceClause}
      GROUP BY subject_agent_id
    ),
    eligible AS (
      SELECT ts.subject_agent_id, ts.composite, ts.volume,
             COALESCE(es.unique_sources, 0) AS unique_sources
      FROM trust_scores ts
      LEFT JOIN event_sources es ON es.subject_agent_id = ts.subject_agent_id
      WHERE ts."window" = $1 AND ts.volume >= $2 ${skillCondition}
    ),
    filtered AS (
      SELECT * FROM eligible WHERE unique_sources >= $3
    ),
    ranked AS (
      SELECT subject_agent_id, composite,
             ROW_NUMBER() OVER (ORDER BY composite DESC) AS rn,
             (SELECT COUNT(*) FROM filtered) AS total
      FROM filtered
    )
    SELECT rn::text, total::text FROM ranked WHERE subject_agent_id = $${params.length}
    `,
    params
  );

  if (rows.length === 0) return null;
  return {
    rank: parseInt(rows[0].rn, 10),
    total: parseInt(rows[0].total, 10),
  };
}

/** Get leaderboard rows with optional verified-only and skill filter. */
export async function getLeaderboard(
  window: LeaderboardWindow = DEFAULT_WINDOW,
  scope: LeaderboardScope = "all",
  skillId: string | null = null,
  limit: number = DEFAULT_LIMIT
): Promise<LeaderboardRow[]> {
  const cfg = await getRankingConfig(window);
  const interval = windowInterval(window);
  const sinceClause =
    window === "all"
      ? "true"
      : `te.occurred_at >= now() - interval '${interval}'`;

  const skillCondition = skillId ? "AND ts.skill_id = $4" : "AND ts.skill_id IS NULL";
  const params: (string | number)[] = [window, cfg.min_events, cfg.min_unique_sources];
  if (skillId) params.push(skillId);
  params.push(limit);

  let verifiedJoin = "";
  if (scope === "verified") {
    verifiedJoin = `
      AND EXISTS (
        SELECT 1 FROM trust_events te2
        JOIN trusted_sources tr ON tr.source = te2.source AND tr.is_verified = true
        WHERE te2.subject_agent_id = ts.subject_agent_id
        AND (${window === "all" ? "true" : `te2.occurred_at >= now() - interval '${interval}'`})
      )
    `;
  }

  const limitParam = skillId ? 5 : 4;
  const { rows } = await query<{
    rn: string;
    subject_agent_id: string;
    composite: number;
    badge_slugs: string[] | null;
  }>(
    `
    WITH event_sources AS (
      SELECT subject_agent_id, COUNT(DISTINCT source) AS unique_sources
      FROM trust_events te
      WHERE ${sinceClause}
      GROUP BY subject_agent_id
    ),
    eligible AS (
      SELECT ts.subject_agent_id, ts.composite, ts.volume,
             COALESCE(es.unique_sources, 0) AS unique_sources
      FROM trust_scores ts
      LEFT JOIN event_sources es ON es.subject_agent_id = ts.subject_agent_id
      WHERE ts."window" = $1 AND ts.volume >= $2 ${skillCondition} ${verifiedJoin}
    ),
    filtered AS (
      SELECT * FROM eligible WHERE unique_sources >= $3
    ),
    ranked AS (
      SELECT subject_agent_id, composite,
             ROW_NUMBER() OVER (ORDER BY composite DESC) AS rn
      FROM filtered
    ),
    with_badges AS (
      SELECT r.*, (
        SELECT array_agg(ab.badge_slug) FROM agent_badges ab
        WHERE ab.subject_agent_id = r.subject_agent_id AND ab."window" = $1
          AND (ab.skill_id IS NOT DISTINCT FROM ${skillId ? "$4" : "NULL"})
      ) AS badge_slugs
      FROM ranked r
      LIMIT $${limitParam}
    )
    SELECT rn::text AS rn, subject_agent_id, composite, badge_slugs FROM with_badges
    `,
    params
  );

  return rows.map((r) => ({
    rank: parseInt(r.rn, 10),
    agentId: r.subject_agent_id,
    composite: r.composite,
    rankChange: null,
    badges: r.badge_slugs ?? [],
  }));
}

/** Compute badges for an agent in a window (on-read; can be cached in agent_badges by job later). */
export async function computeBadgesForAgent(
  agentId: string,
  window: LeaderboardWindow
): Promise<{ slug: string; name: string }[]> {
  const badgeList: { slug: string; name: string }[] = [];

  const { rows: defs } = await query<{ slug: string; name: string }>(
    "SELECT slug, name FROM badge_definitions ORDER BY sort_order"
  );

  const { rows: scoreRows } = await query<{
    reliability: number;
    integrity: number;
    timeliness: number;
    composite: number;
    volume: number;
  }>(
    'SELECT reliability, integrity, timeliness, composite, volume FROM trust_scores WHERE subject_agent_id = $1 AND skill_id IS NULL AND "window" = $2',
    [agentId, window]
  );
  if (scoreRows.length === 0) return [];

  const score = scoreRows[0];
  const interval = windowInterval(window);
  const sinceClause =
    window === "all"
      ? ""
      : `AND occurred_at >= now() - interval '${interval}'`;

  // Clean History: zero integrity-negative events
  const { rows: integrityRows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM trust_events
     WHERE subject_agent_id = $1 ${sinceClause}
       AND event_type IN ('task_disputed','task_reversed','execution_invalid','payment_reversed')`,
    [agentId]
  );
  const noIntegrityBad = parseInt(integrityRows[0]?.n ?? "0", 10) === 0;
  if (noIntegrityBad && score.integrity >= 0.99) {
    const b = defs.find((d) => d.slug === "clean_history");
    if (b) badgeList.push(b);
  }

  // Top 1% / 5% / 10% from rank
  const rankInfo = await getRank(agentId, window, null);
  if (rankInfo && rankInfo.total > 0) {
    const pct = rankInfo.rank / rankInfo.total;
    if (pct <= 0.01) {
      const b = defs.find((d) => d.slug === "top_1");
      if (b) badgeList.push(b);
    } else if (pct <= 0.05) {
      const b = defs.find((d) => d.slug === "top_5");
      if (b) badgeList.push(b);
    } else if (pct <= 0.1) {
      const b = defs.find((d) => d.slug === "top_10");
      if (b) badgeList.push(b);
    }
  }

  // Fast Responder: top 10% timeliness (simplified: timeliness >= 0.9)
  if (score.timeliness >= 0.9 && score.volume >= 3) {
    const b = defs.find((d) => d.slug === "fast_responder");
    if (b) badgeList.push(b);
  }

  // Verified Executor: all events from verified sources (if we have trusted_sources populated)
  const { rows: verifiedRows } = await query<{ all_verified: boolean }>(
    `SELECT NOT EXISTS (
       SELECT 1 FROM trust_events te
       WHERE te.subject_agent_id = $1 ${sinceClause}
         AND NOT EXISTS (SELECT 1 FROM trusted_sources tr WHERE tr.source = te.source AND tr.is_verified = true)
     ) AS all_verified`,
    [agentId]
  );
  if (verifiedRows[0]?.all_verified && score.volume >= 1) {
    const b = defs.find((d) => d.slug === "verified_executor");
    if (b) badgeList.push(b);
  }

  return badgeList;
}

/** Public agent profile for /agent/:agentId (non-auth). */
export async function getAgentProfilePublic(
  agentId: string,
  window: LeaderboardWindow = "30d"
): Promise<AgentProfilePublic | null> {
  const baseUrl = config.publicBaseUrl.replace(/\/$/, "");
  const shareUrl = `${baseUrl}/agent/${encodeURIComponent(agentId)}`;

  const { rows: agentRows } = await query<{
    display_name: string | null;
    operator_id: string | null;
  }>("SELECT display_name, operator_id FROM agents WHERE id = $1", [agentId]);
  if (agentRows.length === 0) return null;

  const { rows: scoreRows } = await query<{
    reliability: number;
    integrity: number;
    timeliness: number;
    composite: number;
    volume: number;
    updated_at: Date;
  }>(
    'SELECT reliability, integrity, timeliness, composite, volume, updated_at FROM trust_scores WHERE subject_agent_id = $1 AND skill_id IS NULL AND "window" = $2',
    [agentId, window]
  );

  const scores = scoreRows[0];
  const defaultScores = {
    reliability: 0.5,
    integrity: 1,
    timeliness: 0.5,
    composite: 0.5,
    volume: 0,
    updated_at: new Date(),
  };
  const s = scores ?? defaultScores;

  const [rank7d, rankAll, badges] = await Promise.all([
    getRank(agentId, "7d", null),
    getRank(agentId, "all", null),
    computeBadgesForAgent(agentId, window),
  ]);

  return {
    agentId,
    displayName: agentRows[0].display_name,
    operatorId: agentRows[0].operator_id,
    composite: s.composite,
    scores: { reliability: s.reliability, integrity: s.integrity, timeliness: s.timeliness },
    rank7d: rank7d?.rank ?? null,
    rankAllTime: rankAll?.rank ?? null,
    rankChange7d: null,
    badges,
    proofCount: s.volume,
    lastVerified: s.updated_at.toISOString(),
    shareUrl,
    window,
  };
}

/** Operator dashboard: agents you run, their ranks, best performer. */
export async function getOperatorDashboard(
  operatorId: string,
  window: LeaderboardWindow = "30d"
): Promise<OperatorDashboard | null> {
  const { rows: opRows } = await query<{ display_name: string | null }>(
    "SELECT display_name FROM operators WHERE id = $1",
    [operatorId]
  );
  if (opRows.length === 0) return null;

  const { rows: agentRows } = await query<{ id: string; display_name: string | null }>(
    "SELECT id, display_name FROM agents WHERE operator_id = $1",
    [operatorId]
  );
  if (agentRows.length === 0) {
    return {
      operatorId,
      displayName: opRows[0].display_name,
      agents: [],
      bestAgentId: null,
    };
  }

  const agents: OperatorDashboardAgent[] = [];
  let bestAgentId: string | null = null;
  let bestComposite = -1;

  for (const a of agentRows) {
    const profile = await getAgentProfilePublic(a.id, window);
    if (!profile) continue;
    const rank7d = await getRank(a.id, "7d", null);
    const rankAll = await getRank(a.id, "all", null);
    agents.push({
      agentId: a.id,
      displayName: a.display_name,
      composite: profile.composite,
      rank7d: rank7d?.rank ?? null,
      rankAllTime: rankAll?.rank ?? null,
    });
    if (profile.composite > bestComposite) {
      bestComposite = profile.composite;
      bestAgentId = a.id;
    }
  }

  return {
    operatorId,
    displayName: opRows[0].display_name,
    agents,
    bestAgentId,
  };
}
