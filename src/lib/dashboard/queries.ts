'use server'

import { createClient } from '@/utils/supabase/server'
import type { DashboardSession, DashboardReview, DashboardLead } from './aggregate'

export interface DashboardData {
  sessions: DashboardSession[]
  reviews: DashboardReview[]
  leads: DashboardLead[]
  error: string | null
}

export async function loadDashboardData(): Promise<DashboardData> {
  const supabase = createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) {
    return { sessions: [], reviews: [], leads: [], error: 'Sign in to view the dashboard.' }
  }

  const userId = auth.user.id
  const [{ data: sessions, error: sessionsError }, { data: reviews, error: reviewsError }, { data: leads, error: leadsError }] =
    await Promise.all([
      supabase
        .from('conversation_sessions')
        .select('id, lead_id, session_purpose, session_status, strategy_key, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('session_reviews')
        .select('session_id, outcome_confirmed, quality_notes, objection_tags')
        .eq('owner_id', userId),
      supabase.from('leads').select('id, company_name, fit_label').eq('owner_id', userId),
    ])

  return {
    sessions: (sessions || []) as unknown as DashboardSession[],
    reviews: (reviews || []) as unknown as DashboardReview[],
    leads: (leads || []) as unknown as DashboardLead[],
    error: sessionsError?.message || reviewsError?.message || leadsError?.message || null,
  }
}
