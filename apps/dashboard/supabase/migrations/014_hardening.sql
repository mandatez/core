-- Data-layer hardening. Addresses SCHEMA_AUDIT.md P1-1, P1-2, P1-3, P1-4,
-- P1-5, P1-7. Migration is idempotent — every statement guards against
-- prior application.

-- ============================================================
-- P1-2  Lock down proxy_private_key to the service role.
-- ============================================================
-- Default GRANTs on Supabase tables let `authenticated` and `anon` read
-- every column an RLS SELECT policy admits. The trust column added in
-- 010 must NEVER be readable through a user JWT — only the service-role
-- client, which bypasses RLS entirely, may touch it.
revoke select (proxy_private_key) on public.agents from authenticated;
revoke select (proxy_private_key) on public.agents from anon;

-- ============================================================
-- P1-1  Immutability of audit primitives.
-- ============================================================
-- agent_events, agent_risk_scores, and attestations are append-only by
-- design. Today this is enforced only by the *absence* of UPDATE/DELETE
-- policies — a future migration that adds a permissive FOR ALL policy
-- would silently open them. Explicitly revoke at the privilege layer so
-- it survives policy churn.
revoke update, delete on public.agent_events from authenticated;
revoke update, delete on public.agent_events from anon;
revoke update, delete on public.agent_risk_scores from authenticated;
revoke update, delete on public.agent_risk_scores from anon;
revoke update, delete on public.attestations from authenticated;
revoke update, delete on public.attestations from anon;

-- ============================================================
-- P1-3  Composite index for (agent_id, timestamp) scans.
-- ============================================================
-- Attestation builder and risk-score builder both query
-- WHERE agent_id = ? AND timestamp BETWEEN ? AND ?. Single-column
-- idx_agent_events_agent_id served us in dev volume, but Postgres can
-- use only one of the two single-column indexes for this predicate and
-- falls back to a heap scan + filter as event volume grows.
create index if not exists idx_agent_events_agent_timestamp
  on public.agent_events (agent_id, timestamp desc);

-- ============================================================
-- P1-7  Make the agent_events → agents FK action explicit.
-- ============================================================
-- 001 declared `agent_id text references agents(id)` with no ON DELETE
-- clause, leaving Postgres's default NO ACTION. That's correct (events
-- must outlive agent deletion attempts), but undocumented. Drop and
-- recreate with RESTRICT so the intent is visible in psql \d output
-- and any future migration touching the FK has to think about it.
do $$
declare
  fk_name text;
begin
  select c.conname into fk_name
  from pg_constraint c
  where c.conrelid = 'public.agent_events'::regclass
    and c.contype = 'f'
    and c.confrelid = 'public.agents'::regclass;

  if fk_name is not null then
    execute format('alter table public.agent_events drop constraint %I', fk_name);
  end if;

  alter table public.agent_events
    add constraint agent_events_agent_id_fkey
    foreign key (agent_id) references public.agents(id) on delete restrict;
end
$$;

-- ============================================================
-- P1-4 / P1-5  Standardise older policies on auth.uid()::text and add
-- idempotency. Drop-then-create so re-runs are safe.
-- ============================================================
-- The 001 policies on agents/agent_events/policies use
-- auth.jwt() ->> 'sub'; everything created later uses auth.uid()::text.
-- They are equivalent today, but the inconsistency invites a third
-- variant. Normalise on auth.uid()::text everywhere.

-- agents
drop policy if exists "agents_select_own" on public.agents;
drop policy if exists "agents_insert_own" on public.agents;
drop policy if exists "agents_update_own" on public.agents;
drop policy if exists "agents_delete_own" on public.agents;

create policy "agents_select_own" on public.agents
  for select using (owner_id = auth.uid()::text);
create policy "agents_insert_own" on public.agents
  for insert with check (owner_id = auth.uid()::text);
create policy "agents_update_own" on public.agents
  for update using (owner_id = auth.uid()::text);
create policy "agents_delete_own" on public.agents
  for delete using (owner_id = auth.uid()::text);

-- agent_events: SELECT + INSERT only. UPDATE/DELETE intentionally absent
-- (and now also revoked at the privilege layer above).
drop policy if exists "events_select_own" on public.agent_events;
drop policy if exists "events_insert_own" on public.agent_events;

create policy "events_select_own" on public.agent_events
  for select using (owner_id = auth.uid()::text);
create policy "events_insert_own" on public.agent_events
  for insert with check (owner_id = auth.uid()::text);

-- policies
drop policy if exists "policies_select_own" on public.policies;
drop policy if exists "policies_insert_own" on public.policies;
drop policy if exists "policies_update_own" on public.policies;
drop policy if exists "policies_delete_own" on public.policies;

create policy "policies_select_own" on public.policies
  for select using (owner_id = auth.uid()::text);
create policy "policies_insert_own" on public.policies
  for insert with check (owner_id = auth.uid()::text);
create policy "policies_update_own" on public.policies
  for update using (owner_id = auth.uid()::text);
create policy "policies_delete_own" on public.policies
  for delete using (owner_id = auth.uid()::text);

-- agent_risk_scores: SELECT + INSERT only, matches agent_events.
drop policy if exists "risk_scores_select_own" on public.agent_risk_scores;
drop policy if exists "risk_scores_insert_own" on public.agent_risk_scores;

create policy "risk_scores_select_own" on public.agent_risk_scores
  for select using (owner_id = auth.uid()::text);
create policy "risk_scores_insert_own" on public.agent_risk_scores
  for insert with check (owner_id = auth.uid()::text);

-- attestations: SELECT only via user JWT. INSERTs are service-role.
drop policy if exists "attestations_select_own" on public.attestations;
create policy "attestations_select_own" on public.attestations
  for select using (owner_id = auth.uid()::text);
