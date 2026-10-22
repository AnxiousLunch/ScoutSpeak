import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { transition, type SessionStatus } from 'voicesession'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'
import { ensureOpening } from '@/lib/sessions/session-ops'

export const runtime = 'nodejs'

const Body = z.object({ inputMethod: z.enum(['voice_browser', 'typed']).optional().default('typed') })

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  const { client, session } = ctx

  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 })

  const from = session.session_status as SessionStatus
  if (from !== 'waiting_for_participant' && from !== 'active') {
    return NextResponse.json({ message: `This conversation cannot be started (${from}).` }, { status: 409 })
  }
  if (!session.participant_consent_at) {
    return NextResponse.json({ message: 'Consent is required.', error: 'consent_required' }, { status: 409 })
  }

  const opening = await ensureOpening(client, session)
  if (!opening.ok) return NextResponse.json(opening.body, { status: opening.httpStatus })

  if (from === 'waiting_for_participant') {
    const active = transition(from, 'active')
    if (active.error) return NextResponse.json({ message: active.error }, { status: 409 })
    const { error } = await client
      .from('conversation_sessions')
      .update({
        session_status: active.status,
        started_at: session.started_at ?? new Date().toISOString(),
        input_method: body.data.inputMethod,
      })
      .eq('id', session.id)
    if (error) return NextResponse.json({ message: 'Could not start the conversation. Please retry.' }, { status: 500 })
  }
  return NextResponse.json(await joinPayload(ctx, 'active'))
}
