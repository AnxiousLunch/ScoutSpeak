-- ScoutSpeak core schema + RLS (idempotent). Run after existing counter migration.

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

alter table public.business_profiles drop constraint if exists business_profiles_owner_version_unique;
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

alter table public.campaigns drop constraint if exists campaigns_status_check;
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads drop constraint if exists leads_research_status_check;
alter table public.leads add constraint leads_research_status_check
  check (research_status in ('verified','partial','unverified'));

create index if not exists idx_leads_owner_id on public.leads(owner_id);
create index if not exists idx_leads_campaign_id on public.leads(campaign_id);

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

alter table public.conversation_sessions drop constraint if exists conversation_sessions_purpose_check;
alter table public.conversation_sessions add constraint conversation_sessions_purpose_check
  check (session_purpose in ('rehearsal','prospect_conversation'));

alter table public.conversation_sessions drop constraint if exists conversation_sessions_status_check;
alter table public.conversation_sessions add constraint conversation_sessions_status_check
  check (session_status in ('created','waiting_for_participant','active','completed','failed','cancelled'));

alter table public.conversation_sessions drop constraint if exists conversation_sessions_input_method_check;
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

alter table public.conversation_messages drop constraint if exists conversation_messages_speaker_role_check;
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

alter table public.session_reviews drop constraint if exists session_reviews_outcome_source_check;
alter table public.session_reviews add constraint session_reviews_outcome_source_check
  check (outcome_source is null or outcome_source in ('model_suggested','user_confirmed','user_corrected'));

alter table public.session_reviews drop constraint if exists session_reviews_outcome_suggested_check;
alter table public.session_reviews add constraint session_reviews_outcome_suggested_check
  check (outcome_suggested is null or outcome_suggested in ('interested','follow_up','meeting_requested','not_interested','not_a_fit','unclear'));

alter table public.session_reviews drop constraint if exists session_reviews_outcome_confirmed_check;
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
  if old.session_status is distinct from 'created'
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- business_profiles
alter table public.business_profiles enable row level security;
revoke all on public.business_profiles from anon;

drop policy if exists "business_profiles_owner_select" on public.business_profiles;
create policy "business_profiles_owner_select"
  on public.business_profiles
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "business_profiles_owner_insert" on public.business_profiles;
create policy "business_profiles_owner_insert"
  on public.business_profiles
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "business_profiles_owner_update" on public.business_profiles;
create policy "business_profiles_owner_update"
  on public.business_profiles
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "business_profiles_owner_delete" on public.business_profiles;
create policy "business_profiles_owner_delete"
  on public.business_profiles
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "business_profiles_require_aal2" on public.business_profiles;
create policy "business_profiles_require_aal2"
  on public.business_profiles
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- campaigns
alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon;

drop policy if exists "campaigns_owner_select" on public.campaigns;
create policy "campaigns_owner_select"
  on public.campaigns
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "campaigns_owner_insert" on public.campaigns;
create policy "campaigns_owner_insert"
  on public.campaigns
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = business_profile_id and bp.owner_id = auth.uid()
    )
  );

drop policy if exists "campaigns_owner_update" on public.campaigns;
create policy "campaigns_owner_update"
  on public.campaigns
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = business_profile_id and bp.owner_id = auth.uid()
    )
  );

drop policy if exists "campaigns_owner_delete" on public.campaigns;
create policy "campaigns_owner_delete"
  on public.campaigns
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "campaigns_require_aal2" on public.campaigns;
create policy "campaigns_require_aal2"
  on public.campaigns
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- leads
alter table public.leads enable row level security;
revoke all on public.leads from anon;

drop policy if exists "leads_owner_select" on public.leads;
create policy "leads_owner_select"
  on public.leads
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "leads_owner_insert" on public.leads;
create policy "leads_owner_insert"
  on public.leads
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "leads_owner_update" on public.leads;
create policy "leads_owner_update"
  on public.leads
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "leads_owner_delete" on public.leads;
create policy "leads_owner_delete"
  on public.leads
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "leads_require_aal2" on public.leads;
create policy "leads_require_aal2"
  on public.leads
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- lead_evidence
alter table public.lead_evidence enable row level security;
revoke all on public.lead_evidence from anon;

drop policy if exists "lead_evidence_owner_select" on public.lead_evidence;
create policy "lead_evidence_owner_select"
  on public.lead_evidence
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "lead_evidence_owner_insert" on public.lead_evidence;
create policy "lead_evidence_owner_insert"
  on public.lead_evidence
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.owner_id = auth.uid()
    )
  );

drop policy if exists "lead_evidence_owner_update" on public.lead_evidence;
create policy "lead_evidence_owner_update"
  on public.lead_evidence
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.owner_id = auth.uid()
    )
  );

drop policy if exists "lead_evidence_owner_delete" on public.lead_evidence;
create policy "lead_evidence_owner_delete"
  on public.lead_evidence
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "lead_evidence_require_aal2" on public.lead_evidence;
create policy "lead_evidence_require_aal2"
  on public.lead_evidence
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- conversation_sessions
alter table public.conversation_sessions enable row level security;
revoke all on public.conversation_sessions from anon;

drop policy if exists "conversation_sessions_owner_select" on public.conversation_sessions;
create policy "conversation_sessions_owner_select"
  on public.conversation_sessions
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "conversation_sessions_owner_insert" on public.conversation_sessions;
create policy "conversation_sessions_owner_insert"
  on public.conversation_sessions
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "conversation_sessions_owner_update" on public.conversation_sessions;
create policy "conversation_sessions_owner_update"
  on public.conversation_sessions
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "conversation_sessions_owner_delete" on public.conversation_sessions;
create policy "conversation_sessions_owner_delete"
  on public.conversation_sessions
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "conversation_sessions_require_aal2" on public.conversation_sessions;
create policy "conversation_sessions_require_aal2"
  on public.conversation_sessions
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- conversation_messages
alter table public.conversation_messages enable row level security;
revoke all on public.conversation_messages from anon;

drop policy if exists "conversation_messages_owner_select" on public.conversation_messages;
create policy "conversation_messages_owner_select"
  on public.conversation_messages
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "conversation_messages_owner_insert" on public.conversation_messages;
create policy "conversation_messages_owner_insert"
  on public.conversation_messages
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "conversation_messages_require_aal2" on public.conversation_messages;
create policy "conversation_messages_require_aal2"
  on public.conversation_messages
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- session_reviews
alter table public.session_reviews enable row level security;
revoke all on public.session_reviews from anon;

drop policy if exists "session_reviews_owner_select" on public.session_reviews;
create policy "session_reviews_owner_select"
  on public.session_reviews
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "session_reviews_owner_insert" on public.session_reviews;
create policy "session_reviews_owner_insert"
  on public.session_reviews
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "session_reviews_owner_update" on public.session_reviews;
create policy "session_reviews_owner_update"
  on public.session_reviews
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "session_reviews_owner_delete" on public.session_reviews;
create policy "session_reviews_owner_delete"
  on public.session_reviews
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "session_reviews_require_aal2" on public.session_reviews;
create policy "session_reviews_require_aal2"
  on public.session_reviews
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- session_invites
alter table public.session_invites enable row level security;
revoke all on public.session_invites from anon;

drop policy if exists "session_invites_owner_select" on public.session_invites;
create policy "session_invites_owner_select"
  on public.session_invites
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "session_invites_owner_insert" on public.session_invites;
create policy "session_invites_owner_insert"
  on public.session_invites
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "session_invites_owner_delete" on public.session_invites;
create policy "session_invites_owner_delete"
  on public.session_invites
  for delete to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "session_invites_require_aal2" on public.session_invites;
create policy "session_invites_require_aal2"
  on public.session_invites
  as restrictive
  for all to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
