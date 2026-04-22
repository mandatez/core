-- MandateZ API Keys — enterprise-friendly credentials
--
-- Replaces the raw Supabase URL + anon-key pair developers currently paste
-- into their agent config with a single-string, revocable, scoped key.
-- Plaintext is never stored; only a SHA-256 hash and a short prefix for UX.

create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  owner_id text not null,
  key_hash text not null unique,    -- SHA-256 of full plaintext key
  key_prefix text not null,          -- first 12 chars ("mz_live_xxxx") for identification
  name text not null,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

-- Indexes for lookup hot paths
create index if not exists idx_api_keys_owner on public.api_keys(owner_id);
create index if not exists idx_api_keys_hash on public.api_keys(key_hash) where revoked_at is null;

alter table public.api_keys enable row level security;

create policy "owner_isolation" on public.api_keys
  for all using (owner_id = auth.uid()::text);
