-- Neutral attestations — independent witness rows the platform signs to
-- confirm what happened inside a (agent, window) tuple.
--
-- Inserts are service-role only (the platform private key never leaves
-- the server). Reads are intentionally public via the API surface — an
-- attestation link IS the distribution primitive. The RLS policy below
-- restricts direct supabase-js reads to the owner, and the public verify
-- endpoint goes through the service-role client.
--
-- This migration was missing in the original commit — see SCHEMA_AUDIT.md P0-1.

create table if not exists public.attestations (
  id text primary key,                                -- att_ + 32 hex
  agent_id text not null references public.agents(id) on delete restrict,
  owner_id text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  event_count integer not null check (event_count >= 0),
  events_hash text not null,                          -- sha256 hex of event signatures
  verdict text not null check (verdict in ('clean', 'flagged', 'violations_detected')),
  violations jsonb not null default '[]',
  platform_signature text not null,
  platform_public_key text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (window_end > window_start)
);

create index if not exists idx_attestations_owner_created
  on public.attestations(owner_id, created_at desc);

create index if not exists idx_attestations_agent_created
  on public.attestations(agent_id, created_at desc);

alter table public.attestations enable row level security;

-- Owners may read their own attestations directly. Public verify still
-- works because the verify endpoint uses the service role.
create policy "attestations_select_own" on public.attestations
  for select using (owner_id = auth.uid()::text);

-- INSERT/UPDATE/DELETE intentionally have no policies — only the service
-- role (which bypasses RLS) may write. This makes attestations append-only
-- from the perspective of any authenticated user, matching agent_events.
