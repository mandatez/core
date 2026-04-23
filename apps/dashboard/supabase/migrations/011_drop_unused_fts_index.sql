-- Drop the unused tsvector FTS index.
--
-- The /api/events/search route uses trigram ILIKE on search_text
-- (see idx_agent_events_search_trgm). The tsvector GIN index added
-- alongside it in 009 is dead weight: it is never queried, takes up
-- disk, and slows writes. Removing it.

drop index if exists idx_agent_events_search_fts;
