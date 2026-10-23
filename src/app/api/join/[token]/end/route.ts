import { NextRequest, NextResponse } from 'next/server'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'
import { endSession } from '@/lib/sessions/session-ops'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  const { client, session } = ctx

  if (['completed', 'cancelled', 'failed'].includes(session.session_status)) {
    return NextResponse.json(await joinPayload(ctx))
  }
  const result = await endSession(client, session, 'participant_left')
  if (!result.ok) return NextResponse.json({ message: result.body.message }, { status: result.httpStatus })
  return NextResponse.json(await joinPayload(ctx, result.status))
}
