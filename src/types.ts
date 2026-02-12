/**
 * TrustGraph v0 types and event taxonomy.
 */

export const TRUST_EVENT_TYPES = [
  "task_completed",
  "task_failed",
  "task_disputed",
  "task_reversed",
  "task_timeout",
  "execution_proved",
  "execution_invalid",
  "wakeup_received",
  "wakeup_missed",
  "reaction_late",
  "payment_settled",
  "payment_reversed",
] as const;

export type TrustEventType = (typeof TRUST_EVENT_TYPES)[number];

export const OUTCOMES = ["success", "failure", "neutral"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface AgentRow {
  id: string;
  display_name: string | null;
  public_key: string | null;
  created_at: Date;
  last_seen_at: Date | null;
  metadata: Record<string, unknown> | null;
}

export interface TrustEventRow {
  id: string;
  subject_agent_id: string;
  actor_agent_id: string | null;
  skill_id: string | null;
  source: string;
  event_type: string;
  outcome: string;
  severity: number;
  value_usd_micros: number | null;
  occurred_at: Date;
  observed_at: Date;
  external_ref_type: string | null;
  external_ref_id: string | null;
  evidence: Record<string, unknown> | null;
}

export interface TrustScoreRow {
  subject_agent_id: string;
  skill_id: string | null;
  window: string;
  reliability: number;
  integrity: number;
  timeliness: number;
  composite: number;
  volume: number;
  value_usd_micros: number;
  updated_at: Date;
}

export type ScoreWindow = "7d" | "30d" | "180d" | "all";

export const SCORE_WINDOWS: ScoreWindow[] = ["7d", "30d", "180d", "all"];

export interface TrustScoresResponse {
  scores: {
    reliability: number;
    integrity: number;
    timeliness: number;
    composite: number;
    volume: number;
  };
  updatedAt: string;
}

export interface IngestEventInput {
  subjectAgentId: string;
  actorAgentId?: string | null;
  skillId?: string | null;
  source: string;
  eventType: string;
  outcome: string;
  severity: number;
  valueUsdMicros?: number | null;
  occurredAt: string; // ISO
  externalRefType?: string | null;
  externalRefId?: string | null;
  evidence?: Record<string, unknown> | null;
}

export interface IngestEventBatchInput {
  events: IngestEventInput[];
}

// --- Viral / leaderboard types ---

export type LeaderboardWindow = "7d" | "30d" | "180d" | "all";
export const LEADERBOARD_WINDOWS: LeaderboardWindow[] = ["7d", "30d", "180d", "all"];

export type LeaderboardScope = "all" | "verified";

export interface LeaderboardRow {
  rank: number;
  agentId: string;
  composite: number;
  rankChange: number | null; // positive = up, negative = down (vs previous period; null if N/A)
  badges: string[];
}

export interface AgentProfilePublic {
  agentId: string;
  displayName: string | null;
  operatorId: string | null;
  composite: number;
  scores: { reliability: number; integrity: number; timeliness: number };
  rank7d: number | null;
  rankAllTime: number | null;
  rankChange7d: number | null;
  badges: { slug: string; name: string }[];
  proofCount: number;
  lastVerified: string; // ISO
  shareUrl: string;
  window: string;
}

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string | null;
}

export interface OperatorDashboardAgent {
  agentId: string;
  displayName: string | null;
  composite: number;
  rank7d: number | null;
  rankAllTime: number | null;
}

export interface OperatorDashboard {
  operatorId: string;
  displayName: string | null;
  agents: OperatorDashboardAgent[];
  bestAgentId: string | null;
}
