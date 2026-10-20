alter table if exists public.lead_evidence add column if not exists run_id uuid;

alter table if exists public.leads add column if not exists enriched_at timestamptz;
alter table if exists public.leads add column if not exists fit_label text;
alter table if exists public.leads add column if not exists fit_reason text;
alter table if exists public.leads add column if not exists missing_fields jsonb default '[]'::jsonb;
alter table if exists public.leads add column if not exists citations jsonb default '{}'::jsonb;
alter table if exists public.leads add column if not exists enrichment_error text;
