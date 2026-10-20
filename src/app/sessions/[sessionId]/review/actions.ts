'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Json } from '@/utils/supabase/database.types'
import { z } from 'zod'

const outcomeValues = ['interested', 'follow_up', 'meeting_requested', 'not_interested', 'not_a_fit', 'unclear'] as const
const saveReviewSchema = z.object({
  sessionId: z.string().uuid(),
  purpose: z.enum(['rehearsal', 'prospect_conversation']),
  summary: z.string().trim().min(1).max(4000),
  outcome_suggested: z.enum(outcomeValues),
  outcome_confirmed: z.enum(outcomeValues),
  outcome_source: z.enum(['model_suggested', 'user_confirmed', 'user_corrected']),
  objection_tags: z.array(z.string().trim().min(1).max(80)).max(30),
  next_step: z.string().trim().min(1).max(1000),
  quality_notes: z.record(z.unknown()),
  excerpts: z.array(z.object({ point: z.string().trim().min(1).max(500), message_seq: z.array(z.number().int().positive()).min(1) })).max(30),
})

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
  const validation = saveReviewSchema.safeParse(input)
  if (!validation.success) return { success: false, error: validation.error.issues[0]?.message ?? 'Review data is invalid.' }
  const review = validation.data
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
    .eq('id', review.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) return { success: false, error: 'Session not found.' }
  if (session.session_purpose !== review.purpose) {
    return { success: false, error: 'Purpose mismatch: cannot save review for a different purpose.' }
  }

  const { data: savedMessages, error: messagesError } = await supabase
    .from('conversation_messages')
    .select('sequence_number')
    .eq('session_id', review.sessionId)
    .eq('owner_id', user.id)
  if (messagesError) return { success: false, error: 'Could not verify the review excerpts.' }
  const validSequences = new Set((savedMessages ?? []).map((message) => message.sequence_number))
  if (review.excerpts.some((excerpt) => excerpt.message_seq.some((sequence) => !validSequences.has(sequence)))) {
    return { success: false, error: 'A supporting excerpt does not match a saved message in this session.' }
  }

  const { error } = await supabase
    .from('session_reviews')
    .upsert({
      owner_id: user.id,
      session_id: review.sessionId,
      summary: review.summary,
      outcome_suggested: review.outcome_suggested,
      outcome_confirmed: review.outcome_confirmed,
      outcome_source: review.outcome_source,
      objection_tags: review.objection_tags,
      next_step: review.next_step,
      quality_notes: review.quality_notes as Json,
      excerpts: review.excerpts,
    }, { onConflict: 'session_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/sessions/${review.sessionId}`)
  revalidatePath('/sessions')
  return { success: true }
}
