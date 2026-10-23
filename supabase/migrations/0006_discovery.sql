-- Additive migration: discovery source tracking for live lead discovery.
-- Run after 0005_end_reason.sql.

alter table if exists public.leads
  add column if not exists provider_id text,
  add column if not exists discovery_source text,
  add column if not exists source_attribution jsonb default '{}'::jsonb,
  add column if not exists discovery_query jsonb default '{}'::jsonb,
  add column if not exists dedup_key text;

do $$
begin
  create index idx_leads_dedup_key on public.leads(owner_id, campaign_id, dedup_key);
exception when duplicate_table then null;
        when undefined_table then null;
end $$;
