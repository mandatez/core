# MandateZ — Claude Code Intelligence File

> Read this file at the start of every session before writing a single line of code.
> This is the single source of truth for what we are building, why, and how.

---

## What Is MandateZ

MandateZ is the neutral, cross-vendor trust infrastructure layer for AI agents.

Every AI agent needs a mandate — a cryptographically signed authorization that defines
its identity, what it is permitted to do, and a tamper-proof log of everything it has done.

No single platform (OpenAI, Anthropic, AWS, Nvidia) can be this layer without a conflict
of interest. MandateZ is neutral by design. It works across all vendors simultaneously.

**Tagline:** Every agent needs a mandate.

---

## The Core Problem We Solve

AI agents are autonomous. They can read, write, export, and call APIs without
human oversight. Companies deploying agents have no standardized way to:

- Prove which agent did what
- Enforce what agents are and are not allowed to do
- Produce compliance audit trails on demand
- Trust agents from other companies

MandateZ solves all four.

---

## Architecture — The One Rule

**Everything flows from one spine: the Agent Event Stream.**

Every surface (SDK, compliance engine, directory, white-label, consumer) is just
a different interface reading the same event stream. Never duplicate the data layer.
Never build a separate logging system for a new surface. Always extend the spine.

---

## The Agent Event Schema (Canonical)

This is the core data structure. Every agent action produces one of these.
Do not modify this schema without explicit instruction.

```typescript
interface AgentEvent {
  event_id: string;          // uuid v4
  agent_id: string;          // ag_ prefix + nanoid
  owner_id: string;          // company or individual id
  timestamp: string;         // ISO 8601
  action_type: 'read' | 'write' | 'export' | 'delete' | 'call' | 'payment';
  resource: string;          // what was accessed e.g. "emails", "database", "api/stripe"
  outcome: 'allowed' | 'blocked' | 'flagged' | 'pending_approval';
  policy_id: string | null;  // which policy rule was applied
  metadata: Record<string, unknown>; // framework-specific context
  signature: string;         // Ed25519 signature of the event payload
  public_key: string;        // agent's public key for verification
}
```

---

## The Six Surfaces

### Surface 1 — Open Protocol Spec
- Location: `/protocol/`
- What: Markdown specification defining the MandateZ standard
- Governance: Neutral, no owner, open contribution
- Output: `SPEC.md`, JSON schema files, example event payloads
- Status: Build in Week 4 after SDK is proven

### Surface 2 — Developer SDK (`@mandatez/sdk`)
- Location: `/packages/sdk/`
- What: TypeScript/Node package that wraps any agent framework
- Integrations: n8n, LangChain, AutoGen, CrewAI, OpenClaw
- Core features:
  - Agent identity generation (Ed25519 keypair)
  - Event signing and emission
  - Human oversight gate (approval before flagged actions execute)
  - Policy enforcement (block/allow/flag rules)
- Open source: YES — free forever
- Build order: THIS IS FIRST

### Surface 3 — Compliance Engine
- Location: `/packages/compliance/`
- What: Report generator sitting on top of the event stream
- Packs: HIPAA, EU AI Act, SOC2 AI addendum
- Output: PDF + JSON compliance reports, one-click audit export
- Pricing: $299–999/mo per pack
- Status: Build in Week 3

### Surface 4 — Agent Directory
- Location: `/apps/directory/`
- What: Public registry of MandateZ-verified agents
- Features: Trust badges, cross-company discovery, agent-to-agent verification
- Pricing: Free to list, paid verification
- Status: Build in Month 2

### Surface 5 — White-Label SDK
- Location: `/packages/sdk/` (same code)
- What: Same SDK packaged for embedding into other platforms
- Targets: n8n, Voiceflow, Dify, Make
- They sell it as their enterprise security layer
- Zero additional build cost — just documentation and packaging

### Surface 6 — Consumer Dashboard
- Location: `/apps/consumer/`
- What: Personal UI on same event stream
- Target: Individuals giving AI assistants access to email, calendar, bank
- Pricing: Freemium / $9.99/mo
- Status: Build in Month 3

---

## Tech Stack (Non-Negotiable)

```
Language:        TypeScript everywhere
Runtime:         Node.js
SDK packaging:   npm (@mandatez/sdk)
Backend:         Next.js (App Router)
Database:        Supabase (PostgreSQL + Row Level Security)
Auth:            Supabase Auth
Cryptography:    libsodium-wrappers (Ed25519 signatures)
Monorepo:        pnpm workspaces
Docs:            Mintlify
First demo:      n8n integration
Hosting:         Vercel (frontend) + Supabase (backend)
```

---

## Folder Structure

```
mandatez/
├── CLAUDE.md                  ← You are here
├── README.md
├── package.json               ← pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                 ← Turborepo config
│
├── packages/
│   ├── sdk/                   ← @mandatez/sdk (Surface 2)
│   │   ├── src/
│   │   │   ├── identity/      ← Agent ID + Ed25519 keypair generation
│   │   │   ├── events/        ← Event schema + signing
│   │   │   ├── policy/        ← Permission enforcement engine
│   │   │   ├── oversight/     ← Human approval gate
│   │   │   └── integrations/
│   │   │       ├── n8n/       ← n8n wrapper (BUILD FIRST)
│   │   │       ├── langchain/ ← LangChain wrapper
│   │   │       └── autogen/   ← AutoGen wrapper
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── compliance/            ← Compliance engine (Surface 3)
│       ├── src/
│       │   ├── hipaa/
│       │   ├── eu-ai-act/
│       │   └── soc2/
│       └── package.json
│
├── apps/
│   ├── dashboard/             ← Hosted log dashboard (Next.js)
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   │
│   ├── directory/             ← Agent directory (Surface 4)
│   │   └── package.json
│   │
│   └── consumer/              ← Consumer dashboard (Surface 6)
│       └── package.json
│
├── protocol/                  ← Open spec (Surface 1)
│   ├── SPEC.md
│   ├── schemas/
│   └── examples/
│
└── docs/                      ← Mintlify docs
    ├── introduction.mdx
    ├── quickstart.mdx
    └── sdk/
```

---

## Build Order (Session by Session)

### Session 1 (NOW) — Core Spine
- [ ] pnpm workspace + Turborepo setup
- [ ] `packages/sdk` scaffolded
- [ ] Agent identity module (Ed25519 keypair generation)
- [ ] Agent event schema (TypeScript interfaces + Zod validation)
- [ ] Event signing with libsodium
- [ ] Event emission to Supabase
- [ ] Basic n8n wrapper that intercepts workflow executions
- [ ] Test: one n8n workflow logs a signed event end-to-end

### Session 2 — Policy + Oversight
- [ ] Policy engine (allow/block/flag rules)
- [ ] Human oversight gate
- [ ] Slack + webhook alert channels
- [ ] Timeout action (auto-block on no response)

### Session 3 — Dashboard
- [ ] Next.js dashboard app
- [ ] Supabase RLS setup (each owner sees only their events)
- [ ] Live event feed
- [ ] Basic compliance report export (PDF)

### Session 4 — Protocol Spec + Launch
- [ ] Write SPEC.md from the working implementation
- [ ] LangChain integration
- [ ] Public docs on Mintlify
- [ ] All surfaces live simultaneously

---

## Supabase Schema

```sql
-- Agents table
create table agents (
  id text primary key,           -- ag_ + nanoid
  owner_id text not null,
  name text not null,
  public_key text not null,      -- Ed25519 public key
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

-- Events table  
create table agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id text references agents(id),
  owner_id text not null,
  timestamp timestamptz not null,
  action_type text not null,
  resource text not null,
  outcome text not null,
  policy_id text,
  metadata jsonb default '{}',
  signature text not null,
  public_key text not null,
  created_at timestamptz default now()
);

-- Policies table
create table policies (
  id text primary key,
  owner_id text not null,
  name text not null,
  rules jsonb not null,          -- array of rule objects
  created_at timestamptz default now()
);

-- Row Level Security
alter table agents enable row level security;
alter table agent_events enable row level security;
alter table policies enable row level security;
```

---

## Human Oversight Config

When an agent attempts a flagged action type, execution pauses and an alert fires.

```typescript
const oversight = {
  require_human_approval: ['export', 'delete', 'payment'],
  alert_channel: 'slack' | 'email' | 'webhook',
  timeout_seconds: 300,
  timeout_action: 'block'
}
```

If no human responds within `timeout_seconds`, the action is auto-blocked and logged.

---

## Monetization (For Context — Not a Build Task)

| Surface | Model | Price |
|---------|-------|-------|
| SDK core | Free forever | $0 |
| Hosted dashboard | Freemium | $99/mo team |
| Compliance packs | Paid only | $299–999/mo |
| Enterprise | Annual contract | TBD |
| White-label | License fee | TBD |
| Consumer | Freemium | $9.99/mo |

**Validation gate:** One paying customer at $299/mo before building Surface 3 fully.

---

## The Moat

MandateZ works with Claude agents, GPT agents, Gemini agents, n8n, LangChain,
and AutoGen simultaneously. Nvidia, OpenAI, and AWS structurally cannot offer
cross-vendor neutrality without undermining their own platform businesses.

The open protocol + developer adoption path creates community gravity before
any hyperscaler can standardize a competing spec.

---

## What Claude Code Should Never Do

- Never build a separate data layer for a new surface — always extend the spine
- Never hardcode API keys or secrets — always use environment variables
- Never skip Zod validation on event schemas
- Never build UI before the SDK core is working end-to-end
- Never add a dependency without checking if libsodium or Supabase already covers it
- Never rename `AgentEvent` — it is the canonical type across the entire codebase

---

## Environment Variables Needed

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# MandateZ
MANDATEZ_API_URL=

# Alerts
SLACK_WEBHOOK_URL=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Current Status

- [x] Name locked: MandateZ
- [x] Domain: mandatez.com (purchasing this week)
- [x] GitHub org: github.com/mandatez
- [x] npm org: npmjs.com/org/mandatez
- [ ] Repo initialized
- [ ] pnpm workspace setup
- [ ] Session 1 complete

---

*Last updated: March 2026*
*Reviewer: The King*
*Builder: Claude Code*
