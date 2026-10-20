'use server'

import { createClient } from '@/utils/supabase/server'
import { generateBrief, type GenerateBriefInput, type SessionBrief } from '@/lib/brief'
import { getStrategy } from '@/lib/strategies'

export interface BuildBriefInput {
  leadId: string
  objective: string
  strategyKey: string
}

export type BuildBriefResult =
  | { success: true; brief: SessionBrief }
  | { success: false; error: string }

export async function buildBrief(input: BuildBriefInput): Promise<BuildBriefResult> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Sign in again.' }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return { success: false, error: 'Complete your two-factor check first.' }
  }

  const [{ data: lead }, { data: profile }, { data: evidence }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', input.leadId).eq('owner_id', user.id).single(),
    supabase.from('business_profiles').select('*').eq('owner_id', user.id).order('version', { ascending: false }).limit(1).single(),
    supabase.from('lead_evidence').select('id, source_url, page_title, excerpt').eq('lead_id', input.leadId).eq('owner_id', user.id),
  ])

  if (!lead) return { success: false, error: 'Lead not found.' }
  if (!profile) return { success: false, error: 'Save a business profile first.' }

  const strategy = getStrategy(input.strategyKey)
  if (!strategy) return { success: false, error: 'Strategy not found.' }

  const result = await generateBrief({
    profile: {
      business_name: profile.business_name,
      services: profile.services,
      value_proposition: profile.value_proposition,
      target_industry: profile.target_industry,
      target_geography: profile.target_geography,
      constraints: profile.constraints,
    },
    evidence: evidence ?? [],
    objective: input.objective,
    strategy,
  })

  if (!result.brief) {
    return { success: false, error: result.error || 'Could not generate a grounded brief.' }
  }

  return { success: true, brief: result.brief }
}
