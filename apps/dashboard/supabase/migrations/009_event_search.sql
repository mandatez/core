-- MandateZ Event Search — full-text search over resource + metadata
--
-- Adds a generated text column `search_text` that concatenates the
-- searchable fields of an agent_event, plus a GIN tsvector index so
-- auditors can query millions of events by free text in milliseconds.
--
-- The column is stored (not virtual) because GIN indexes require an
-- immutable expression. `jsonb::text` IS immutable, so the generated
-- column is safe to define with GENERATED ALWAYS ... STORED.

alter table agent_events
  add column if not exists search_text text
  generated always as (
    coalesce(resource, '') || ' ' ||
    coalesce(agent_id, '') || ' ' ||
    coalesce(policy_id, '') || ' ' ||
    coalesce(action_type, '') || ' ' ||
    coalesce(outcome, '') || ' ' ||
    coalesce(metadata::text, '')
  ) stored;

-- GIN index on tsvector for fast full-text search. 'simple' config
-- keeps stemming off so exact-substring matches work for agent IDs
-- and resource paths (which are identifiers, not natural language).
create index if not exists idx_agent_events_search_fts
  on agent_events
  using gin (to_tsvector('simple', search_text));

-- Trigram index on the raw text column, so ILIKE substring queries
-- also use an index when textSearch can't tokenize the query (e.g.
-- a partial agent_id like "ag_xK9" or a URL fragment).
create extension if not exists pg_trgm;

create index if not exists idx_agent_events_search_trgm
  on agent_events
  using gin (search_text gin_trgm_ops);

-- Composite index to keep common filter+order queries fast when
-- combined with full-text matches (owner_id + timestamp descending
-- is the default shape of every search result).
create index if not exists idx_agent_events_owner_timestamp_policy
  on agent_events (owner_id, timestamp desc, policy_id);
