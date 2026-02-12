-- TrustGraph v0 schema — PostgreSQL
-- Run via: psql $DATABASE_URL -f src/db/schema.sql
-- Or use db/migrate.ts

-- A) agents — canonical identity
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  public_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_public_key ON agents(public_key) WHERE public_key IS NOT NULL;

-- B) trust_events — append-only, never update/delete
CREATE TABLE IF NOT EXISTS trust_events (
  id UUID PRIMARY KEY,
  subject_agent_id TEXT NOT NULL REFERENCES agents(id),
  actor_agent_id TEXT,
  skill_id TEXT,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  severity INT NOT NULL CHECK (severity BETWEEN 1 AND 100),
  value_usd_micros BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL,
  observed_at TIMESTAMPTZ DEFAULT now(),
  external_ref_type TEXT,
  external_ref_id TEXT,
  evidence JSONB,
  CONSTRAINT uq_trust_events_external_ref UNIQUE (external_ref_type, external_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_events_subject_occurred
  ON trust_events(subject_agent_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_events_source_occurred
  ON trust_events(source, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_events_external_ref
  ON trust_events(external_ref_type, external_ref_id)
  WHERE external_ref_type IS NOT NULL AND external_ref_id IS NOT NULL;

-- C) trust_scores — cached, recomputed periodically
CREATE TABLE IF NOT EXISTS trust_scores (
  subject_agent_id TEXT NOT NULL REFERENCES agents(id),
  skill_id TEXT,
  window TEXT NOT NULL,
  reliability REAL NOT NULL,
  integrity REAL NOT NULL,
  timeliness REAL NOT NULL,
  composite REAL NOT NULL,
  volume INT NOT NULL,
  value_usd_micros BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (subject_agent_id, skill_id, window)
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_updated ON trust_scores(updated_at);
CREATE INDEX IF NOT EXISTS idx_trust_scores_composite ON trust_scores(window, skill_id, composite DESC);

-- D) operators — humans who run agents (for operator dashboard)
CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS operator_id TEXT REFERENCES operators(id);
CREATE INDEX IF NOT EXISTS idx_agents_operator ON agents(operator_id);

-- E) badge_definitions — status symbols (viral unit)
CREATE TABLE IF NOT EXISTS badge_definitions (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO badge_definitions (slug, name, description, sort_order) VALUES
  ('verified_executor', 'Verified Executor', 'Only verified-source events', 10),
  ('fast_responder', 'Fast Responder', 'Top 10% timeliness', 20),
  ('clean_history', 'Clean History', 'Zero negative integrity events', 30),
  ('top_1', 'Top 1%', 'Rank in top 1%', 40),
  ('top_5', 'Top 5%', 'Rank in top 5%', 50),
  ('top_10', 'Top 10%', 'Rank in top 10%', 60),
  ('skill_specialist', 'Skill Specialist', 'High score on specific skill', 70),
  ('consistent_performer', 'Consistent Performer', 'Score stability over time', 80)
ON CONFLICT (slug) DO NOTHING;

-- F) agent_badges — awarded per (agent, window); recomputed by job
CREATE TABLE IF NOT EXISTS agent_badges (
  subject_agent_id TEXT NOT NULL REFERENCES agents(id),
  badge_slug TEXT NOT NULL REFERENCES badge_definitions(slug),
  skill_id TEXT,
  window TEXT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (subject_agent_id, badge_slug, skill_id, window)
);

CREATE INDEX IF NOT EXISTS idx_agent_badges_agent ON agent_badges(subject_agent_id, window);

-- G) trusted_sources — anti-gaming: source credibility
CREATE TABLE IF NOT EXISTS trusted_sources (
  source TEXT PRIMARY KEY,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  credibility_weight REAL NOT NULL DEFAULT 1.0
);

-- H) ranking_config — min events/sources to appear on leaderboard
CREATE TABLE IF NOT EXISTS ranking_config (
  window TEXT PRIMARY KEY,
  min_events INT NOT NULL DEFAULT 5,
  min_unique_sources INT NOT NULL DEFAULT 2
);

INSERT INTO ranking_config (window, min_events, min_unique_sources) VALUES
  ('7d', 3, 1),
  ('30d', 5, 2),
  ('180d', 10, 2),
  ('all', 15, 2)
ON CONFLICT (window) DO NOTHING;
