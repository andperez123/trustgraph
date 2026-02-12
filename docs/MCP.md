# TrustGraph MCP Server

Agent-native interface to TrustGraph. Read tools require no keys; write tools require a write key only if the server has `TRUSTGRAPH_ENFORCE_WRITE_KEY=true`.

## Running the MCP server

```bash
# With DATABASE_URL set (required for all tools)
export DATABASE_URL="postgresql://..."
npm run dev:mcp
# Or after build:
node dist/mcp/server.js
```

For Cursor/IDE MCP config, point to this server (e.g. stdio command):

```json
{
  "mcpServers": {
    "trustgraph": {
      "command": "node",
      "args": ["/path/to/TrustGraph/dist/mcp/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

## Tools

| Tool | Description | Auth |
|------|-------------|------|
| `trust_get_agent_score` | Get trust scores for an agent (all skills). Params: `agentId`, optional `window` (7d, 30d, 180d, all). | None |
| `trust_get_skill_score` | Get trust scores for an agent on a skill. Params: `agentId`, `skillId`, optional `window`. | None |
| `trust_health` | Check service and DB connectivity. | None |
| `trust_emit_event` | Emit one trust event. Params: subjectAgentId, source, eventType, outcome, severity, occurredAt (ISO), plus optional actorAgentId, skillId, valueUsdMicros, externalRefType, externalRefId, evidence, writeKey. | Write key if enforced |
| `trust_emit_events_batch` | Emit multiple events. Params: `events` (array of same shape as above), optional `writeKey`. | Write key if enforced |

## Write key

- Set `TRUSTGRAPH_WRITE_KEY` to a secret value.
- Set `TRUSTGRAPH_ENFORCE_WRITE_KEY=true` to require it for write tools.
- When enforced, pass `writeKey` in the tool arguments or the server returns: *"This server requires a write key"*.

## Event taxonomy (v0)

Task/work: `task_completed`, `task_failed`, `task_disputed`, `task_reversed`, `task_timeout`  
Execution: `execution_proved`, `execution_invalid`  
WakeNet: `wakeup_received`, `wakeup_missed`, `reaction_late`  
Payments: `payment_settled`, `payment_reversed`

Outcome: `success`, `failure`, or `neutral`. Severity: 1–100.
