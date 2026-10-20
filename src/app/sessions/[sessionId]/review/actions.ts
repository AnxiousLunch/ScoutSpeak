'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export interface SaveReviewInput {
  sessionId: string
  purpose: string
  summary: string
  outcome_suggested: string
  outcome_confirmed: string
  outcome_source: 'model_suggested' | 'user_confirmed' | 'user_corrected'
  objection_tags: string[]
  next_step: string
  quality_notes: Record<string, unknown>
  excerpts: Array<{ point: string; message_seq: number[] }>
}

export type SaveReviewResult = { success: true } | { success: false; error: string }

export async function saveReview(input: SaveReviewInput): Promise<SaveReviewResult> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { success: false, error: 'Sign in again.' }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return { success: false, error: 'Complete your two-factor check first.' }
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('id, session_purpose')
    .eq('id', input.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) return { success: false, error: 'Session not found.' }
  if (session.session_purpose !== input.purpose) {
    return { success: false, error: 'Purpose mismatch: cannot save review for a different purpose.' }
  }

  const { error } = await supabase
    .from('session_reviews')
    .upsert({
      owner_id: user.id,
      session_id: input.sessionId,
      summary: input.summary,
      outcome_suggested: input.outcome_suggested,
      outcome_confirmed: input.outcome_confirmed,
      outcome_source: input.outcome_source,
      objection_tags: input.objection_tags,
      next_step: input.next_step,
      quality_notes: input.quality_notes,
      excerpts: input.excerpts,
    }, { onConflict: 'session_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/sessions/${input.sessionId}`)
  revalidatePath('/sessions')
  return { success: true }
}
