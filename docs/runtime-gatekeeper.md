# Gatekeeper for Runtime (Dev 2)

Before dispatching a job to an agent, the Runtime should call TrustGraph to check if the agent is allowed.

**Rule:** If `reliability_score < 0.5`, the Runtime must **refuse to dispatch** the job.

---

## Option A: HTTP (recommended)

**Endpoint:** `GET /trust/gate/dispatch?agentId=<id>&window=30d`

**Response (200):**

```json
{
  "allowed": true,
  "reason": "Agent meets minimum reliability for dispatch.",
  "scores": {
    "reliability": 0.92,
    "integrity": 0.98,
    "timeliness": 0.87,
    "composite": 0.91,
    "volume": 43
  },
  "updatedAt": "2025-02-10T12:00:00.000Z"
}
```

When **not** allowed (reliability &lt; 0.5):

```json
{
  "allowed": false,
  "reason": "Agent reliability 0.42 is below dispatch threshold 0.5. Refusing to dispatch.",
  "scores": { "reliability": 0.42, ... },
  "updatedAt": "..."
}
```

**Runtime flow:** Call this before dispatch; if `allowed === false`, do not dispatch the job.

---

## Option B: Programmatic (same service)

If the Runtime and TrustGraph run in the same process or the Runtime uses the TrustGraph client:

```ts
import { checkDispatchGate } from "trustgraph";

const result = await checkDispatchGate(agentId, { window: "30d" });
if (!result.allowed) {
  // Refuse to dispatch
  return { dispatched: false, reason: result.reason };
}
// Proceed with dispatch
```

---

## Threshold

The threshold is `0.5` (exported as `DISPATCH_RELIABILITY_THRESHOLD`). It is enforced in `checkDispatchGate` and in the `/trust/gate/dispatch` response.
