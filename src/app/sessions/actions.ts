'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type CreateSessionResult = { success: true; id: string } | { success: false; error: string }

export async function createRehearsalSession(leadId: string): Promise<CreateSessionResult> {
  const supabase: any = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Sign in again to start a rehearsal.' }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') return { success: false, error: 'Complete your two-factor check before starting a session.' }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, campaign_id')
    .eq('id', leadId)
    .eq('owner_id', user.id)
    .single()
  if (leadError || !lead) return { success: false, error: 'This lead could not be found in your workspace.' }

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
    session_purpose: 'rehearsal',
    session_status: 'created',
    strategy_key: 'consultative',
    strategy_version: 1,
    business_profile_version: profile.version,
    prompt_version: 'scoutspeak-rehearsal-v1',
  }).select('id').single()

  if (error || !session) return { success: false, error: error?.message || 'Could not create your rehearsal. Please try again.' }
  revalidatePath('/sessions')
  return { success: true, id: session.id }
}
