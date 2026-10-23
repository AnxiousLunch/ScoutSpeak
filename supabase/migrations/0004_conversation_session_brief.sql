-- Additive migration: session brief and objective fields.
-- Run after 0003_enrichment.sql.

alter table if exists public.conversation_sessions
  add column if not exists objective text,
  add column if not exists objection_profile text,
  add column if not exists brief jsonb default '{}'::jsonb,
  add column if not exists running_summary text;

-- A session can have at most one reviewed outcome.
alter table if exists public.session_reviews
  add column if not exists excerpts jsonb default '[]'::jsonb;

create unique index if not exists session_reviews_session_id_unique
  on public.session_reviews(session_id);

-- Lock the purpose on the same write that starts a session as well as later writes.
create or replace function public.lock_session_purpose()
returns trigger
language plpgsql
security invoker
set search_path = public
as $
begin
  if (old.session_status is distinct from 'created'
      or new.session_status is distinct from 'created')
     and old.session_purpose is distinct from new.session_purpose then
    raise exception 'session_purpose cannot change after the session has started';
  end if;
  return new;
end;
$;

drop trigger if exists lock_session_purpose on public.conversation_sessions;
create trigger lock_session_purpose
  before update on public.conversation_sessions
  for each row
  execute function public.lock_session_purpose();
