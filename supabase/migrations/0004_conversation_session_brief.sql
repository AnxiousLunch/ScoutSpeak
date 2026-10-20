-- Additive migration: session brief and objective fields.
-- Run after 0003_enrichment.sql.

alter table if exists public.conversation_sessions
  add column if not exists objective text,
  add column if not exists objection_profile text,
  add column if not exists brief jsonb default '{}'::jsonb;

-- A session can have at most one reviewed outcome.
alter table if exists public.session_reviews
  add constraint if not exists session_reviews_session_id_unique
  unique (session_id);

-- Ensure the session_purpose lock trigger stays in place.
-- (It was created in 0001_schema.sql and is not modified here.)
