# MandateZ

**Every agent needs a mandate.**

MandateZ is the open, cross-vendor trust infrastructure for AI agents. Cryptographic identity, policy enforcement, human oversight, and tamper-proof audit logs — for any agent framework.

## Quickstart (30 seconds)

```bash
npm install @mandatez/sdk
```

```typescript
import { MandateZAgent } from '@mandatez/sdk';

const myAgent = MandateZAgent(yourAgentFunction, {
  agentId: 'ag_...',
  ownerId: 'your_owner_id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});

// Your agent is now governed. That's it.
```

One import. One wrap. Every call is policy-checked, optionally identity-screened, and logged as a signed `AgentEvent`. Same function signature in, same function signature out.

## The Problem

AI agents act autonomously. There is no standard way to prove what they did, enforce what they can do, or produce compliance audit trails. MandateZ solves all three.

## Install

```bash
npm install @mandatez/sdk
```

## Configuration

MandateZ supports two configuration modes. Pick one.

### Standard mode — Supabase credentials

Every client needs Supabase credentials so `track()` can sign events
straight into your event stream. Generate an agent identity once, then
keep the keypair somewhere safe.

```typescript
import { generateAgentIdentity, MandateZClient } from '@mandatez/sdk';

const identity = await generateAgentIdentity();
const client = new MandateZClient({
  agentId: identity.agent_id,
  ownerId: 'your_org_id',
  privateKey: identity.private_key,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});
```

### Enterprise add-on — dashboard `apiKey`

For the batch and risk-score endpoints (`trackBatch()`, `getRiskScore()`,
`computeRiskScore()`) the client also accepts an `apiUrl` + `apiKey` pair.
Generate the key at `/keys` in the MandateZ dashboard:

```typescript
const client = new MandateZClient({
  // Supabase creds are still required for track()
  agentId: 'ag_...',
  ownerId: 'your_org_id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,

  // Enable batch + risk endpoints
  apiUrl: 'https://dashboard.mandatez.com',
  apiKey: process.env.MANDATEZ_API_KEY!,   // "mz_live_..."
});
```

Why enterprise customers add the API key:
- **Revocable** — rotate a compromised key from the dashboard in one click.
- **Auditable** — every key has a name, creation time, and `last_used_at` timestamp.
- **Scoped** — keys are bound to an `owner_id`; they cannot reach another tenant's data.

## Usage

```typescript
const event = await client.track({
  action_type: 'read',
  resource: 'emails',
});
// → signed, validated, emitted to your event stream
```

## What You Get

- **Agent Identity** — Ed25519 keypair per agent, unique `ag_` prefixed IDs
- **Signed Events** — every action produces a cryptographically signed, tamper-proof event
- **Policy Engine** — allow/block/flag rules with wildcard resource matching
- **Human Oversight** — pause execution, alert via Slack/webhook, auto-block on timeout
- **Compliance Reports** — JSON + PDF audit trail export
- **Framework Integrations** — LangChain, n8n, with more coming

## Observability Exporters

Fan MandateZ events out to your existing observability or SIEM stack — Datadog, Splunk, any OpenTelemetry collector, or an arbitrary webhook. Exporters are fire-and-forget: they run in parallel after every `track()` and never block or throw on the hot path.

```typescript
import {
  MandateZClient,
  DatadogExporter,
  WebhookExporter,
} from '@mandatez/sdk';

const client = new MandateZClient({
  agentId: '...',
  ownerId: '...',
  privateKey: '...',
  supabaseUrl: '...',
  supabaseAnonKey: '...',
  exporters: [
    new DatadogExporter({
      apiKey: process.env.DD_API_KEY!,
      site: 'datadoghq.com',
    }),
    new WebhookExporter({
      url: 'https://your-siem.com/mandatez',
    }),
  ],
});

// Every tracked event now flows to Datadog and your webhook.
await client.track({ action_type: 'read', resource: 'emails' });
```

Built-in exporters:

| Exporter | Destination | Import |
|---|---|---|
| `DatadogExporter` | Datadog Logs v2 HTTP intake | `@mandatez/sdk` |
| `SplunkExporter` | Splunk HTTP Event Collector | `@mandatez/sdk` |
| `OpenTelemetryExporter` | Any OTLP/HTTP collector (Grafana Tempo, Honeycomb, New Relic, etc.) | `@mandatez/sdk` |
| `WebhookExporter` | Any HTTPS URL (generic fan-out) | `@mandatez/sdk` |

Custom exporters implement the `EventExporter` interface — `{ name: string; export(event: AgentEvent): Promise<void> }` — and drop into the same `exporters: [...]` array.

Full setup instructions and payload shapes: [Exporters docs](https://mandatez.mintlify.app/exporters).

## Integrations

### LangChain

```typescript
import { MandateZLangChainCallback } from '@mandatez/sdk';

const callback = new MandateZLangChainCallback(client);
const chain = new ChatOpenAI({ callbacks: [callback] });
```

### n8n

```typescript
import { MandateZN8nHook } from '@mandatez/sdk';

const hook = new MandateZN8nHook(client);
await hook.beforeExecution('wf_123', 'HTTP Request', inputData);
await hook.afterExecution('wf_123', 'HTTP Request', outputData, true);
```

## Architecture

Everything flows from one spine: the **Agent Event Stream**.

```
Agent Action → Policy Engine → Oversight Gate → Sign (Ed25519) → Emit to Stream
```

Every surface — SDK, dashboard, compliance engine, directory — reads the same stream. One data layer. No duplication.

## Documentation

- [Quickstart](https://mandatez.mintlify.app/quickstart)
- [SDK Reference](https://mandatez.mintlify.app/sdk/track)
- [Protocol Specification](./protocol/SPEC.md)

## Project Structure

```
packages/sdk/          → @mandatez/sdk (open source, free forever)
apps/dashboard/        → Next.js event monitoring dashboard
protocol/              → Open protocol specification
docs/                  → Documentation (Mintlify)
```

## License

MIT
