-- MandateZ Schema + Row Level Security
-- Run this in your Supabase SQL editor or via supabase db push

-- ============================================
-- Tables
-- ============================================

create table if not exists agents (
  id text primary key,
  owner_id text not null,
  name text not null,
  public_key text not null,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create table if not exists agent_events (
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

create table if not exists policies (
  id text primary key,
  owner_id text not null,
  name text not null,
  rules jsonb not null,
  created_at timestamptz default now()
);

-- ============================================
-- Indexes for dashboard queries
-- ============================================

create index if not exists idx_agent_events_owner_id on agent_events(owner_id);
create index if not exists idx_agent_events_agent_id on agent_events(agent_id);
create index if not exists idx_agent_events_timestamp on agent_events(timestamp desc);
create index if not exists idx_agent_events_action_type on agent_events(action_type);
create index if not exists idx_agent_events_outcome on agent_events(outcome);
create index if not exists idx_agents_owner_id on agents(owner_id);
create index if not exists idx_policies_owner_id on policies(owner_id);

-- ============================================
-- Row Level Security
-- Each owner sees only their own data
-- ============================================

alter table agents enable row level security;
alter table agent_events enable row level security;
alter table policies enable row level security;

-- Agents: owners can read/write their own agents
create policy "agents_select_own" on agents
  for select using (owner_id = auth.jwt() ->> 'sub');

create policy "agents_insert_own" on agents
  for insert with check (owner_id = auth.jwt() ->> 'sub');

create policy "agents_update_own" on agents
  for update using (owner_id = auth.jwt() ->> 'sub');

create policy "agents_delete_own" on agents
  for delete using (owner_id = auth.jwt() ->> 'sub');

-- Agent Events: owners can read their own events, service role can insert
create policy "events_select_own" on agent_events
  for select using (owner_id = auth.jwt() ->> 'sub');

create policy "events_insert_own" on agent_events
  for insert with check (owner_id = auth.jwt() ->> 'sub');

-- Policies: owners can CRUD their own policies
create policy "policies_select_own" on policies
  for select using (owner_id = auth.jwt() ->> 'sub');

create policy "policies_insert_own" on policies
  for insert with check (owner_id = auth.jwt() ->> 'sub');

create policy "policies_update_own" on policies
  for update using (owner_id = auth.jwt() ->> 'sub');

create policy "policies_delete_own" on policies
  for delete using (owner_id = auth.jwt() ->> 'sub');

-- ============================================
-- Enable realtime for live event feed
-- ============================================

alter publication supabase_realtime add table agent_events;
