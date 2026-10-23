import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { transition, type SessionStatus } from 'voicesession'
import { runTurn } from '@/lib/sessions/run-turn'
import { endSession, ensureOpening } from '@/lib/sessions/session-ops'

export const runtime = 'nodejs'

const InputMethodSchema = z.enum(['voice_browser', 'voice_hosted', 'typed'])

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    inputMethod: InputMethodSchema.optional().default('typed'),
  }),
  z.object({ action: z.literal('end') }),
  z.object({
    action: z.literal('turn'),
    text: z.string().trim().min(1).max(500),
    inputMethod: InputMethodSchema.optional().default('typed'),
  }),
])

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ message: 'Complete your two-factor check first.' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ message: 'The request could not be read.' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid conversation request.' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (sessionError || !session) {
    return NextResponse.json({ message: 'This session was not found.' }, { status: 404 })
  }

  if (!session.participant_consent_at) {
    return NextResponse.json({ error: 'consent_required' }, { status: 409 })
  }

  const currentStatus = session.session_status as SessionStatus

  if (parsed.data.action === 'end') {
    const result = await endSession(supabase, session, 'owner_ended')
    if (!result.ok) return NextResponse.json(result.body, { status: result.httpStatus })
    return NextResponse.json({ ended: true, status: result.status })
  }

  if (parsed.data.action === 'start') {
    let startFrom = currentStatus
    if (currentStatus === 'created') {
      const waiting = transition(currentStatus, 'waiting_for_participant')
      if (waiting.error) return NextResponse.json({ message: waiting.error }, { status: 409 })
      const { error } = await supabase
        .from('conversation_sessions')
        .update({ session_status: waiting.status })
        .eq('id', session.id)
        .eq('owner_id', user.id)
      if (error) return NextResponse.json({ message: 'Could not prepare the session. Please retry.' }, { status: 500 })
      startFrom = waiting.status
    }
    if (startFrom !== 'waiting_for_participant' && startFrom !== 'active') {
      return NextResponse.json({ message: `Cannot start a session in ${startFrom} state.` }, { status: 409 })
    }

    const opening = await ensureOpening(supabase, session)
    if (!opening.ok) return NextResponse.json(opening.body, { status: opening.httpStatus })

    if (startFrom === 'waiting_for_participant') {
      const active = transition(startFrom, 'active')
      if (active.error) return NextResponse.json({ message: active.error }, { status: 409 })
      const { error } = await supabase
        .from('conversation_sessions')
        .update({
          session_status: active.status,
          started_at: session.started_at ?? new Date().toISOString(),
          input_method: parsed.data.inputMethod ?? 'typed',
        })
        .eq('id', session.id)
        .eq('owner_id', user.id)
      if (error) {
        return NextResponse.json({ message: 'The opening was saved, but the session could not be started. Try again.' }, { status: 500 })
      }
    }
    return NextResponse.json({ message: opening.message })
  }

  const result = await runTurn({
    client: supabase,
    sessionId: session.id,
    text: parsed.data.text,
    inputMethod: parsed.data.inputMethod,
  })
  if (!result.ok) return NextResponse.json(result.body, { status: result.httpStatus })
  return NextResponse.json({ message: result.message, ended: result.ended, status: result.status })
}
