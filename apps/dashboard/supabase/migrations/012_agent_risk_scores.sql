-- Severity-weighted risk scoring on the agent event stream.
-- Each row is a snapshot computed over a rolling lookback window.

create table if not exists agent_risk_scores (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id) on delete cascade,
  owner_id text not null,
  overall_score integer not null check (overall_score between 0 and 100),
  grade text not null check (grade in ('A+','A','B','C','D','F')),
  severity_breakdown jsonb not null default '{}',
  domain_classification jsonb not null default '{}',
  incident_patterns jsonb not null default '{}',
  blocked_ratio numeric not null default 0,
  flagged_ratio numeric not null default 0,
  event_count integer not null default 0,
  window_days integer not null default 30,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_risk_scores_agent_id
  on agent_risk_scores(agent_id);
create index if not exists idx_agent_risk_scores_owner_id
  on agent_risk_scores(owner_id);
create index if not exists idx_agent_risk_scores_computed_at
  on agent_risk_scores(computed_at desc);
create index if not exists idx_agent_risk_scores_agent_recent
  on agent_risk_scores(agent_id, computed_at desc);

alter table agent_risk_scores enable row level security;

create policy "risk_scores_select_own" on agent_risk_scores
  for select using (owner_id = auth.jwt() ->> 'sub');

create policy "risk_scores_insert_own" on agent_risk_scores
  for insert with check (owner_id = auth.jwt() ->> 'sub');
