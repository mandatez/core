# MandateZ — n8n Community Node

Cryptographic audit trail and policy enforcement for n8n AI agent workflows.

Every workflow execution gets a tamper-proof, Ed25519-signed event log — proving which agent did what, when, and whether it was allowed.

## What This Node Does

**Mode 1 — Audit:** Drop the MandateZ node into any workflow to log a cryptographically signed `AgentEvent` to your Supabase backend. Every execution produces a verifiable audit record with a unique `event_id`, Ed25519 `signature`, and ISO 8601 `timestamp`.

**Mode 2 — Policy Check:** Before a workflow step executes, check the action against policy rules. The node evaluates the action type and resource against your rules and returns `allowed`, `blocked`, or `flagged` — so you can branch your workflow accordingly.

## Setup

### 1. Get Your Owner ID

Sign up or log in at [core-consumer.vercel.app/account](https://core-consumer.vercel.app/account). Your **Owner ID** is displayed on the account page — copy it.

### 2. Generate an Agent Identity

Use the `@mandatez/sdk` to generate an agent keypair:

```typescript
import { generateAgentIdentity } from '@mandatez/sdk';

const identity = await generateAgentIdentity();
console.log(identity);
// { agent_id: "ag_...", public_key: "...", private_key: "..." }
```

Save the `agent_id` and `private_key` — you'll need them in the node configuration.

### 3. Configure Credentials in n8n

1. Go to **Settings → Credentials → Add Credential**
2. Search for **MandateZ API**
3. Fill in:
   - **Supabase URL** — your Supabase project URL
   - **Supabase Anon Key** — your Supabase public/anon key
   - **MandateZ Owner ID** — from step 1

### 4. Add the Node to Your Workflow

Drag the **MandateZ** node into your workflow and configure:

- **Agent ID** — from step 2
- **Agent Private Key** — from step 2
- **Action Type** — read, write, export, delete, call, or payment
- **Resource** — what's being accessed (e.g., `emails`, `api/stripe`)
- **Metadata** — optional JSON context

## Examples

### Audit Mode

Place the MandateZ node after any action node to log it:

```
[Trigger] → [HTTP Request] → [MandateZ (Audit)] → [Next Step]
```

<!-- Screenshot: audit-mode.png -->

**Output:**
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "outcome": "allowed",
  "signature": "base64-ed25519-signature...",
  "timestamp": "2026-03-25T12:00:00.000Z",
  "action_type": "call",
  "resource": "api/stripe"
}
```

### Policy Check Mode

Place the MandateZ node before an action to enforce rules:

```
[Trigger] → [MandateZ (Policy Check)] → [IF outcome=allowed] → [Action]
                                        → [IF outcome=blocked] → [Error Handler]
```

<!-- Screenshot: policy-check-mode.png -->

**Policy Rules example:**
```json
[
  {
    "id": "block-exports",
    "action_types": ["export"],
    "resource_pattern": "*",
    "effect": "block"
  },
  {
    "id": "allow-reads",
    "action_types": ["read"],
    "resource_pattern": "*",
    "effect": "allow"
  }
]
```

## Resources

- [MandateZ Documentation](https://mandatez.mintlify.app)
- [SDK on npm](https://www.npmjs.com/package/@mandatez/sdk)
- [GitHub](https://github.com/mandatez/core)
