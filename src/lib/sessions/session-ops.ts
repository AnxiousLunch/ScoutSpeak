import type { SupabaseClient } from '@supabase/supabase-js'
import { transition, type SessionStatus } from 'voicesession'
import type { Database } from '@/utils/supabase/database.types'
import { AiError } from '@/lib/ai/errors'
import { pickOpeningQuestion, type SessionBrief } from '@/lib/sessions/prompt'

export type DbClient = SupabaseClient<Database>
export type SessionRow = Database['public']['Tables']['conversation_sessions']['Row']
export type Fail = { ok: false; httpStatus: number; body: Record<string, unknown> }

export function fail(httpStatus: number, message: string, extra: Record<string, unknown> = {}): Fail {
  return { ok: false, httpStatus, body: { message, ...extra } }
}

export function aiHttpStatus(error: AiError): number {
  switch (error.code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    case 'config':
      return 503
    default:
      return 502
  }
}

export function parseBrief(brief: unknown): SessionBrief | null {
  if (typeof brief !== 'object' || brief === null) return null
  const c = brief as Record<string, unknown>
  if (
    typeof c.goal === 'string' &&
    Array.isArray(c.priority_questions) &&
    c.priority_questions.every((q) => typeof q === 'string') &&
    Array.isArray(c.end_conditions) &&
    c.end_conditions.every((e) => typeof e === 'string') &&
    Array.isArray(c.permitted_claims)
  ) {
    return c as unknown as SessionBrief
  }
  return null
}

export async function ensureOpening(
  client: DbClient,
  session: SessionRow
): Promise<{ ok: true; message: { sequence_number: number; speaker_role: string; message_text: string } } | Fail> {
  const { data: existing } = await client
    .from('conversation_messages')
    .select('sequence_number, speaker_role, message_text')
    .eq('session_id', session.id)
    .eq('sequence_number', 1)
    .maybeSingle()
  if (existing?.speaker_role === 'agent' && existing.message_text) {
    return { ok: true, message: { sequence_number: 1, speaker_role: 'agent', message_text: existing.message_text } }
  }
  if (session.business_profile_version == null) {
    return fail(409, 'The business profile version for this session is missing.')
  }
  const [{ data: lead }, { data: profile }, { data: evidence }] = await Promise.all([
    client.from('leads').select('company_name').eq('id', session.lead_id).eq('owner_id', session.owner_id).single(),
    client.from('business_profiles').select('business_name').eq('owner_id', session.owner_id).eq('version', session.business_profile_version).single(),
    client.from('lead_evidence').select('id').eq('lead_id', session.lead_id).eq('owner_id', session.owner_id),
  ])
  if (!lead || !profile) return fail(409, 'The lead or business profile for this session is missing.')
  const question = pickOpeningQuestion(parseBrief(session.brief), (evidence ?? []).length > 0)
  const rehearsal = session.session_purpose === 'rehearsal'
  const disclosure = rehearsal
    ? `Hi, I’m an AI sales representative from ${profile.business_name || 'your business'}. This is a rehearsal with ${lead.company_name}. I’ll use only the offer details and lead evidence available in this workspace.`
    : `Hi, I’m an AI sales representative from ${profile.business_name || 'our business'}. This conversation is saved as a transcript.`
  const text = `${disclosure} ${question}`
  const { error } = await client
    .from('conversation_messages')
    .insert({ session_id: session.id, owner_id: session.owner_id, sequence_number: 1, speaker_role: 'agent', message_text: text })
  if (error) return fail(500, 'Could not start the session. Please try again.')
  return { ok: true, message: { sequence_number: 1, speaker_role: 'agent', message_text: text } }
}

export async function endSession(
  client: DbClient,
  session: SessionRow,
  reason: string
): Promise<{ ok: true; status: SessionStatus } | Fail> {
  const current = session.session_status as SessionStatus
  const { data: saved } = await client
    .from('conversation_messages')
    .select('speaker_role')
    .eq('session_id', session.id)
  const humanTurns = (saved ?? []).filter((m) => m.speaker_role === 'human').length
  const completion = transition(current, 'completed', { humanTurns, consent: Boolean(session.participant_consent_at) })
  const cancellation = completion.error ? transition(current, 'cancelled') : null
  if (completion.error && cancellation?.error) return fail(409, completion.error, { saved: true })
  const target: SessionStatus = completion.error ? 'cancelled' : 'completed'
  const { error } = await client
    .from('conversation_sessions')
    .update({ session_status: target, ended_at: new Date().toISOString(), end_reason: reason })
    .eq('id', session.id)
  if (error) return fail(500, 'Could not save the end of this session. Try again.')
  return { ok: true, status: target }
}
