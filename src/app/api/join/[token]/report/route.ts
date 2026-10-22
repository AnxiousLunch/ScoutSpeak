import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'

export const runtime = 'nodejs'

const Body = z.object({ kind: z.literal('audio_lost') })

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  const { client, session } = ctx

  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ message: 'Invalid report.' }, { status: 400 })

  if (session.session_status !== 'active') {
    return NextResponse.json({ message: 'Audio loss can only be reported during an active conversation.' }, { status: 409 })
  }

  const { error } = await client
    .from('conversation_sessions')
    .update({ session_status: 'failed', end_reason: body.data.kind, ended_at: new Date().toISOString() })
    .eq('id', session.id)

  if (error) return NextResponse.json({ message: 'Could not report the audio failure. Please retry.' }, { status: 500 })
  return NextResponse.json(await joinPayload(ctx, 'failed'))
}
