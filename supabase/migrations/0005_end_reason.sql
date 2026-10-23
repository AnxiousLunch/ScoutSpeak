-- Run after 0004_conversation_session_brief.sql.
alter table if exists public.conversation_sessions
  add column if not exists end_reason text;
