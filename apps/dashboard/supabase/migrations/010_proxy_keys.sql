-- MandateZ Proxy Mode — Escrowed Signing Keys
-- Adds a proxy-managed Ed25519 private key per agent so the network
-- proxy can sign events on the agent's behalf without the agent
-- ever holding the key itself.
--
-- The column is service-role only — RLS policies never expose it
-- to end users, and the API never returns it in responses.

alter table agents
  add column if not exists proxy_private_key text;

-- Defense-in-depth: explicitly deny proxy_private_key reads at the
-- application layer by convention. Service role bypasses RLS and is
-- the only identity that ever touches this column.

-- Track which agents opted into proxy mode and when they were
-- provisioned. Useful for the dashboard's Proxy Setup status view.
alter table agents
  add column if not exists proxy_mode_enabled boolean default false;

alter table agents
  add column if not exists proxy_mode_enabled_at timestamptz;

create index if not exists idx_agents_proxy_mode on agents(owner_id, proxy_mode_enabled);
