-- ScoutSpeak RLS: owner isolation + AAL2 enforcement.
-- The counter table is intentionally untouched.

-- Helper: require AAL2 for every operation on authenticated sessions.
-- Applied as a RESTRICTIVE policy so it cannot be relaxed by permissive owner policies.

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------
alter table public.business_profiles enable row level security;
revoke all on public.business_profiles from anon;

create policy if not exists "business_profiles_owner_select"
  on public.business_profiles
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "business_profiles_owner_insert"
  on public.business_profiles
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy if not exists "business_profiles_owner_update"
  on public.business_profiles
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy if not exists "business_profiles_owner_delete"
  on public.business_profiles
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "business_profiles_require_aal2"
  on public.business_profiles
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon;

create policy if not exists "campaigns_owner_select"
  on public.campaigns
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "campaigns_owner_insert"
  on public.campaigns
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = business_profile_id and bp.owner_id = auth.uid()
    )
  );

create policy if not exists "campaigns_owner_update"
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

create policy if not exists "campaigns_owner_delete"
  on public.campaigns
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "campaigns_require_aal2"
  on public.campaigns
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
revoke all on public.leads from anon;

create policy if not exists "leads_owner_select"
  on public.leads
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "leads_owner_insert"
  on public.leads
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.owner_id = auth.uid()
    )
  );

create policy if not exists "leads_owner_update"
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

create policy if not exists "leads_owner_delete"
  on public.leads
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "leads_require_aal2"
  on public.leads
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- lead_evidence
-- ---------------------------------------------------------------------------
alter table public.lead_evidence enable row level security;
revoke all on public.lead_evidence from anon;

create policy if not exists "lead_evidence_owner_select"
  on public.lead_evidence
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "lead_evidence_owner_insert"
  on public.lead_evidence
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.owner_id = auth.uid()
    )
  );

create policy if not exists "lead_evidence_owner_update"
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

create policy if not exists "lead_evidence_owner_delete"
  on public.lead_evidence
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "lead_evidence_require_aal2"
  on public.lead_evidence
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- conversation_sessions
-- ---------------------------------------------------------------------------
alter table public.conversation_sessions enable row level security;
revoke all on public.conversation_sessions from anon;

create policy if not exists "conversation_sessions_owner_select"
  on public.conversation_sessions
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "conversation_sessions_owner_insert"
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

create policy if not exists "conversation_sessions_owner_update"
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

create policy if not exists "conversation_sessions_owner_delete"
  on public.conversation_sessions
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "conversation_sessions_require_aal2"
  on public.conversation_sessions
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- conversation_messages
-- Client may select and insert only (no direct update/delete).
-- ---------------------------------------------------------------------------
alter table public.conversation_messages enable row level security;
revoke all on public.conversation_messages from anon;

create policy if not exists "conversation_messages_owner_select"
  on public.conversation_messages
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "conversation_messages_owner_insert"
  on public.conversation_messages
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy if not exists "conversation_messages_require_aal2"
  on public.conversation_messages
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- session_reviews
-- ---------------------------------------------------------------------------
alter table public.session_reviews enable row level security;
revoke all on public.session_reviews from anon;

create policy if not exists "session_reviews_owner_select"
  on public.session_reviews
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "session_reviews_owner_insert"
  on public.session_reviews
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy if not exists "session_reviews_owner_update"
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

create policy if not exists "session_reviews_owner_delete"
  on public.session_reviews
  for delete to authenticated
  using (owner_id = auth.uid());

create policy if not exists "session_reviews_require_aal2"
  on public.session_reviews
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

-- ---------------------------------------------------------------------------
-- session_invites
-- Owner-only select/insert/delete. No anon access. No client update.
-- ---------------------------------------------------------------------------
alter table public.session_invites enable row level security;
revoke all on public.session_invites from anon;

create policy if not exists "session_invites_owner_select"
  on public.session_invites
  for select to authenticated
  using (owner_id = auth.uid());

create policy if not exists "session_invites_owner_insert"
  on public.session_invites
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy if not exists "session_invites_owner_delete"
  on public.session_invites
  for delete to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.conversation_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy if not exists "session_invites_require_aal2"
  on public.session_invites
  for all to authenticated
  as restrictive
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
