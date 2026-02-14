# TrustGraph + Clawdbot (OpenClaw)

**This integration is currently best suited for builders comfortable editing OpenClaw config files.** It is not yet frictionless; expect manual MCP and skill setup.

---

## Quick setup

### A. Start TrustGraph

```bash
cd /path/to/TrustGraph
cp .env.example .env
# Edit .env: set DATABASE_URL to your PostgreSQL

npm install
npm run db:migrate
npm run build
npm run dev:mcp   # Keep running (stdio)
```

### B. Add TrustGraph MCP to Clawdbot

In `~/.openclaw/openclaw.json` (or your MCP config location), add:

```json
{
  "mcpServers": {
    "trustgraph": {
      "command": "node",
      "args": ["/path/to/TrustGraph/dist/mcp/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/trustgraph"
      }
    }
  }
}
```

Replace `/path/to/TrustGraph` with your actual path.

### C. Add the TrustGraph skill

Either symlink or add an extra dir in `openclaw.json`:

```json
"skills": {
  "load": {
    "extraDirs": ["/path/to/TrustGraph/openclaw/skills"]
  }
}
```

### D. Test in chat

Ask the agent:

- "Check agent:X's trust score."
- "Before delegating to agent:Y, what's their TrustGraph rank?"

### E. Health check

```bash
# From TrustGraph repo
echo '{}' | node dist/mcp/server.js
# Or call trust_health via any MCP client
```

---

## F. One-shot smoke test (verified)

**Prompt:**

> Check TrustGraph health and then check the trust score for agent:demo

**Expected:**

1. Agent calls `trust_health`
2. Agent calls `trust_get_agent_score`
3. Response includes:
   - `composite` score
   - Subscores (`reliability`, `integrity`, `timeliness`)
   - `updatedAt` timestamp

**Pass criteria:** If you see a JSON response with `scores.composite` and `updatedAt`, TrustGraph is wired correctly. If you get an error or no tool calls, the failure is config (MCP not loaded, wrong path, or skill not loaded).

---

## Empty database behavior

**If the database is empty, TrustGraph will return default scores** (composite 0.5, integrity 1, etc.). Ingest at least one event (Taskmint, WakeNet, or manual) to see non-zero results.

**Demo payload** (manual ingest via `POST /trust/events` or MCP `trust_emit_event`):

```json
{
  "subjectAgentId": "agent:demo",
  "source": "manual",
  "eventType": "task_completed",
  "outcome": "success",
  "severity": 90,
  "occurredAt": "2025-02-11T12:00:00.000Z"
}
```

---

## Promotion guidance

**Safe to promote to:** Agent builders, MCP-native tool authors, Clawdbot/OpenClaw power users, CapNet builders channel.

**Do NOT yet promote as:** "One-click enable," "Drop-in trust layer," or "Production-ready reputation system."
