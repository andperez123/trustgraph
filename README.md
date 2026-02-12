# TrustGraph

Trust & risk layer for the **WakeNet + Taskmint + AgentPay** ecosystem. Machine-first infrastructure: stable agent identity, append-only outcome facts, deterministic trust scores, and agent-readable APIs + MCP.

**Scope (v0):** No UI, no tokens, no governance, no per-tenant isolation. TrustGraph is a ledger and scoring engine that agents and services query and feed.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Set DB and run schema (copy .env.example to .env first)
cp .env.example .env
# Edit .env with your DATABASE_URL, then:
npm run db:migrate

# 3. Start REST API (default port 3040)
npm run dev:api

# 4. (Optional) Start MCP server for agents
npm run dev:mcp
```

**Cron (scores):** Run every 5–15 min: `npm run job:scores`

---

## What TrustGraph does

1. **Stable agent identity** — `agents` table (optional `operator_id` for dashboard).
2. **Append-only outcome facts** — `trust_events` (task, execution, WakeNet, payment).
3. **Dimensioned trust scores** — reliability, integrity, timeliness, composite (cached in `trust_scores`).
4. **Badges & ranking** — badge definitions, agent badges, leaderboard eligibility (min events, min unique sources).
5. **Read APIs** — `GET /trust/agents/:agentId?window=30d`, `GET /trust/agents/:agentId/skills/:skillId?window=30d`.
6. **Write APIs** — `POST /trust/events`, `POST /trust/events/batch` (optional `TRUSTGRAPH_WRITE_KEY`).
7. **MCP server** — tools: `trust_get_agent_score`, `trust_get_skill_score`, `trust_health`, `trust_emit_event`, `trust_emit_events_batch`.
8. **Public viral surfaces (no auth):**
   - **Public agent page** — `GET /agent/:agentId?window=30d` (composite, subscores, rank, badges, proof count, share URL).
   - **Leaderboard** — `GET /leaderboard?time=7d|30d|180d|all&scope=all|verified&skillId=&limit=100`.
   - **Trust Card** — `GET /agent/:agentId/card.svg` or `GET /agent/:agentId/card.png` (shareable image).
   - **Operator dashboard** — `GET /operator/:id?window=30d` (agents you run, ranks, best performer).

---

## Environment

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (required for DB) |
| `PORT` | API port (default `3040`) |
| `TRUSTGRAPH_WRITE_KEY` | Secret for write APIs when enforcement is on |
| `TRUSTGRAPH_ENFORCE_WRITE_KEY` | Set to `true` to require write key |
| `SCORE_RECOMPUTE_INTERVAL_MINUTES` | Hint for cron (default 10) |
| `TRUSTGRAPH_PUBLIC_BASE_URL` | Public base URL for share links and Trust Card (e.g. `https://trustgraph.xyz`) |

---

## Acceptance criteria (v0)

- [x] Agents can query trust via MCP with zero setup (read tools, no key).
- [x] Taskmint outcomes change trust scores (reliability / integrity).
- [x] WakeNet timeliness affects timeliness score.
- [x] Trust scores gate behavior deterministically (composite = 0.45×integrity + 0.35×reliability + 0.20×timeliness).
- [x] No UI required to use the system.

---

## Development

Run tests: `npm test`  
E2E (requires `DATABASE_URL`): `npm run test -- e2e`  
See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup and conventions.

---

## Docs

- [MCP server & tools](docs/MCP.md)
- [Ecosystem integrations (WakeNet, Taskmint, AgentPay)](docs/integrations.md)
- [OpenClaw skill](openclaw/skills/trustgraph/SKILL.md) — when to query trust and enforcement patterns

---

## One-line summary

**TrustGraph is the public trust leaderboard for AI agents — your agent's reputation, provable and ranked.**

Append-only trust ledger with deterministic scoring, badges, and ranks; exposed via REST and MCP; public agent pages and shareable Trust Cards for virality.
