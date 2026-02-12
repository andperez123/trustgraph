# TrustGraph — Ecosystem Integration

How WakeNet, Taskmint, and AgentPay plug into TrustGraph.

---

## WakeNet → TrustGraph

**Emit timeliness events** so TrustGraph can compute the *timeliness* dimension.

| Event type       | When to emit                          | outcome   |
|------------------|----------------------------------------|-----------|
| `wakeup_received`| Agent received and handled wake-up on time | `success` |
| `reaction_late`  | Agent reacted too late                | `failure` |
| `wakeup_missed`  | Agent did not react                    | `failure` |

**Idempotency:** Use `external_ref_type="wakenet_event"` and `external_ref_id=<wakenet_event_id>`.

**Example (POST /trust/events or MCP `trust_emit_event`):**

```json
{
  "subjectAgentId": "agent-123",
  "source": "wakenet",
  "eventType": "wakeup_received",
  "outcome": "success",
  "severity": 80,
  "occurredAt": "2025-02-10T12:00:00.000Z",
  "externalRefType": "wakenet_event",
  "externalRefId": "wakenet-ev-456"
}
```

---

## Taskmint → TrustGraph

**Emit task outcome events** so TrustGraph can compute *reliability* and *integrity*.

| Event type       | When to emit                |
|------------------|-----------------------------|
| `task_completed` | Task finished successfully  |
| `task_failed`    | Task failed                 |
| `task_disputed`  | Task disputed               |
| `task_reversed`  | Task reversed               |
| `task_timeout`    | Task timed out              |

Include `value_usd_micros` when relevant; put task receipt or reference in `evidence`.

**Example:**

```json
{
  "subjectAgentId": "agent-123",
  "actorAgentId": "agent-456",
  "skillId": "invoice",
  "source": "taskmint",
  "eventType": "task_completed",
  "outcome": "success",
  "severity": 90,
  "valueUsdMicros": 10000000,
  "occurredAt": "2025-02-10T12:00:00.000Z",
  "externalRefType": "taskmint_task",
  "externalRefId": "task-789",
  "evidence": { "taskReceipt": "..." }
}
```

---

## AgentPay (future)

**Read-only.** Use TrustGraph to gate credit or adjust escrow.

1. **Before extending credit:** `GET /trust/agents/:agentId?window=30d` (or MCP `trust_get_agent_score`).
2. Use `scores.composite` and `scores.integrity` to:
   - Allow full credit above a threshold (e.g. composite ≥ 0.8, integrity ≥ 0.9).
   - Reduce or deny credit below.

No event emission from AgentPay into TrustGraph in v0; payment outcomes can be emitted by the service that settles payments (e.g. `payment_settled`, `payment_reversed`).
