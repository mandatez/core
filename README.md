# MandateZ

**Every agent needs a mandate.**

MandateZ is the neutral trust infrastructure layer for AI agents. Cryptographic identity, policy enforcement, human oversight gates, and tamper-proof audit trails — for every agent, across every framework.

## Why MandateZ

AI agents are autonomous. They read files, call APIs, send emails, make payments. Nobody can prove what they did, whether they were authorized, or produce a compliance trail on demand.

MandateZ fixes all four. It works with LangChain, n8n, AutoGen, CrewAI, and every other framework — simultaneously.

## Install

```bash
npm install @mandatez/sdk
```

## Quickstart

```typescript
import { generateAgentIdentity, MandateZClient } from '@mandatez/sdk';

const identity = await generateAgentIdentity();
const client = new MandateZClient({
  agentId:         identity.agent_id,
  ownerId:         'your_org_id',
  privateKey:      identity.private_key,
  supabaseUrl:     process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});

const event = await client.track({
  action_type: 'read',
  resource: 'emails',
});
// → signed, validated, emitted to your event stream
```

## What you get

- **Ed25519 cryptographic identity** per agent — unique `ag_` prefixed IDs with keypair signing
- **Policy engine** — allow/block/flag rules with wildcard resource matching
- **Human oversight gate** — pause execution, alert via Slack/webhook, auto-block on timeout
- **Tamper-proof audit trail** — every action signed and emitted to Supabase
- **Compliance report export** — HIPAA, EU AI Act, SOC2 (coming)

## Integrations

### n8n

```bash
npm install n8n-nodes-mandatez
```

Drop the MandateZ node into any workflow. Every execution gets a signed audit event.

### LangChain

```typescript
import { MandateZLangChainCallback } from '@mandatez/sdk';

const callback = new MandateZLangChainCallback(client);
const chain = new ChatOpenAI({ callbacks: [callback] });
```

### More coming

AutoGen, CrewAI, Voiceflow, Dify, Make.

## Architecture

Everything flows from one spine: the **Agent Event Stream**.

```
Agent Action → Policy Engine → Oversight Gate → Sign (Ed25519) → Emit to Stream
```

Every surface — SDK, dashboard, compliance engine, directory — reads the same stream. One data layer. No duplication.

## Links

- **Docs:** [mandatez.mintlify.app](https://mandatez.mintlify.app)
- **Dashboard:** [core-consumer.vercel.app](https://core-consumer.vercel.app)
- **npm:** [@mandatez/sdk](https://www.npmjs.com/package/@mandatez/sdk)
- **n8n node:** [n8n-nodes-mandatez](https://www.npmjs.com/package/n8n-nodes-mandatez)
- **Protocol spec:** [/protocol/SPEC.md](./protocol/SPEC.md)

## License

MIT
