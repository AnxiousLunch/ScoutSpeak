-- ScoutSpeak core schema: 8 user-owned tables.
-- Run AFTER the existing counter migration; the counter table is intentionally untouched.

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_name text,
  services text,
  value_proposition text,
  target_industry text,
  target_geography text,
  constraints text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_profiles add constraint business_profiles_owner_version_unique
  unique (owner_id, version);

create index if not exists idx_business_profiles_owner_id
  on public.business_profiles(owner_id);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  name text not null,
  objective text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns add constraint campaigns_status_check
  check (status is null or status in ('draft','active','paused','archived'));

create index if not exists idx_campaigns_owner_id on public.campaigns(owner_id);
create index if not exists idx_campaigns_business_profile_id on public.campaigns(business_profile_id);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_name text not null,
  website_url text,
  company_summary text,
  observed_signal text,
  inferred_need text,
  personalization_hook text,
  fit_score int,
  score_breakdown jsonb default '{}'::jsonb,
  research_status text not null default 'unverified',
  lead_status text,
  provider_id text,
  discovery_source text,
  source_attribution jsonb default '{}'::jsonb,
  discovery_query jsonb default '{}'::jsonb,
  dedup_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add constraint leads_research_status_check
  check (research_status in ('verified','partial','unverified'));

create index if not exists idx_leads_owner_id on public.leads(owner_id);
create index if not exists idx_leads_campaign_id on public.leads(campaign_id);
create index if not exists idx_leads_dedup_key on public.leads(owner_id, campaign_id, dedup_key);

-- ---------------------------------------------------------------------------
-- lead_evidence
-- ---------------------------------------------------------------------------
create table if not exists public.lead_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_url text,
  canonical_url text,
  page_title text,
  excerpt text,
  observed_at timestamptz,
  access_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_evidence_owner_id on public.lead_evidence(owner_id);
create index if not exists idx_lead_evidence_lead_id on public.lead_evidence(lead_id);

-- ---------------------------------------------------------------------------
-- conversation_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_purpose text not null,
  session_status text not null default 'created',
  input_method text,
  strategy_key text,
  strategy_version int default 1,
  business_profile_version int,
  model text,
  prompt_version text,
  participant_consent_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversation_sessions add constraint conversation_sessions_purpose_check
  check (session_purpose in ('rehearsal','prospect_conversation'));

alter table public.conversation_sessions add constraint conversation_sessions_status_check
  check (session_status in ('created','waiting_for_participant','active','completed','failed','cancelled'));

alter table public.conversation_sessions add constraint conversation_sessions_input_method_check
  check (input_method is null or input_method in ('voice_browser','voice_hosted','typed'));

create index if not exists idx_conversation_sessions_owner_id on public.conversation_sessions(owner_id);
create index if not exists idx_conversation_sessions_lead_id on public.conversation_sessions(lead_id);
create index if not exists idx_conversation_sessions_campaign_id on public.conversation_sessions(campaign_id);

-- ---------------------------------------------------------------------------
-- conversation_messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sequence_number int not null,
  speaker_role text not null,
  message_text text,
  created_at timestamptz not null default now()
);

alter table public.conversation_messages add constraint conversation_messages_speaker_role_check
  check (speaker_role in ('agent','human','system_event'));

create index if not exists idx_conversation_messages_owner_id on public.conversation_messages(owner_id);
create index if not exists idx_conversation_messages_session_id on public.conversation_messages(session_id);

-- ---------------------------------------------------------------------------
-- session_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  summary text,
  outcome_suggested text,
  outcome_confirmed text,
  outcome_source text,
  objection_tags jsonb default '[]'::jsonb,
  next_step text,
  quality_notes jsonb default '{}'::jsonb,
  note_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_reviews add constraint session_reviews_outcome_source_check
  check (outcome_source is null or outcome_source in ('model_suggested','user_confirmed','user_corrected'));

alter table public.session_reviews add constraint session_reviews_outcome_suggested_check
  check (outcome_suggested is null or outcome_suggested in ('interested','follow_up','meeting_requested','not_interested','not_a_fit','unclear'));

alter table public.session_reviews add constraint session_reviews_outcome_confirmed_check
  check (outcome_confirmed is null or outcome_confirmed in ('interested','follow_up','meeting_requested','not_interested','not_a_fit','unclear'));

create index if not exists idx_session_reviews_owner_id on public.session_reviews(owner_id);
create index if not exists idx_session_reviews_session_id on public.session_reviews(session_id);

-- ---------------------------------------------------------------------------
-- session_invites
-- ---------------------------------------------------------------------------
create table if not exists public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_invites_owner_id on public.session_invites(owner_id);
create index if not exists idx_session_invites_session_id on public.session_invites(session_id);

-- ---------------------------------------------------------------------------
-- Trigger: session_purpose cannot change once session_status is no longer 'created'
-- ---------------------------------------------------------------------------
create or replace function public.lock_session_purpose()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (old.session_status is distinct from 'created'
      or new.session_status is distinct from 'created')
     and old.session_purpose is distinct from new.session_purpose then
    raise exception 'session_purpose cannot change after the session has started';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_sessions_lock_purpose on public.conversation_sessions;
create trigger conversation_sessions_lock_purpose
  before update on public.conversation_sessions
  for each row
  execute function public.lock_session_purpose();
