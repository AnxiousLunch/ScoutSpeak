import { NextRequest, NextResponse } from 'next/server'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  const { client, session } = ctx

  if (session.session_status !== 'waiting_for_participant' && session.session_status !== 'created') {
    return NextResponse.json({ message: 'Consent can only be recorded before the conversation starts.' }, { status: 409 })
  }
  if (!session.participant_consent_at) {
    const { error } = await client
      .from('conversation_sessions')
      .update({ participant_consent_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) return NextResponse.json({ message: 'Could not record consent. Please retry.' }, { status: 500 })
  }
  return NextResponse.json(await joinPayload(ctx))
}
