'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getStrategy, type StrategyKey } from '@/lib/strategies'
import type { SessionBrief } from '@/lib/brief'

export type SessionPurpose = 'rehearsal' | 'prospect_conversation'

export interface CreateSessionInput {
  leadId: string
  purpose: SessionPurpose
  objective: string
  strategyKey: StrategyKey
  objectionProfile?: string
  brief?: SessionBrief
}

export type CreateSessionResult = { success: true; id: string } | { success: false; error: string }

export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Sign in again to start a session.' }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return { success: false, error: 'Complete your two-factor check before starting a session.' }
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, campaign_id')
    .eq('id', input.leadId)
    .eq('owner_id', user.id)
    .single()
  if (leadError || !lead) return { success: false, error: 'This lead could not be found in your workspace.' }

  const strategy = getStrategy(input.strategyKey)
  if (!strategy) return { success: false, error: 'Selected strategy is not available.' }

  const [{ data: profile, error: profileError }, { data: campaign, error: campaignError }] = await Promise.all([
    supabase.from('business_profiles').select('id, version').eq('owner_id', user.id).order('version', { ascending: false }).limit(1).single(),
    supabase.from('campaigns').select('id').eq('id', lead.campaign_id).eq('owner_id', user.id).single(),
  ])
  if (profileError || !profile) return { success: false, error: 'Save a business profile before starting a conversation.' }
  if (campaignError || !campaign) return { success: false, error: 'The lead’s campaign could not be found.' }

  const { data: session, error } = await supabase.from('conversation_sessions').insert({
    owner_id: user.id,
    lead_id: lead.id,
    campaign_id: campaign.id,
    session_purpose: input.purpose,
    session_status: 'created',
    objective: input.objective,
    strategy_key: strategy.key,
    strategy_version: strategy.version,
    objection_profile: input.objectionProfile ?? null,
    brief: input.brief ?? {},
    business_profile_version: profile.version,
    prompt_version: `scoutspeak-${strategy.key}-v${strategy.version}`,
  }).select('id').single()

  if (error || !session) return { success: false, error: error?.message || 'Could not create the session. Please try again.' }
  revalidatePath('/sessions')
  return { success: true, id: session.id }
}

export async function updateSessionBrief(
  sessionId: string,
  brief: SessionBrief
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Sign in again.' }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return { success: false, error: 'Complete your two-factor check first.' }
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('session_status')
    .eq('id', sessionId)
    .eq('owner_id', user.id)
    .single()

  if (!session) return { success: false, error: 'Session not found.' }
  if (session.session_status !== 'created') {
    return { success: false, error: 'The brief can only be edited before the session starts.' }
  }

  const { error } = await supabase
    .from('conversation_sessions')
    .update({ brief })
    .eq('id', sessionId)
    .eq('owner_id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/sessions/${sessionId}`)
  return { success: true }
}
