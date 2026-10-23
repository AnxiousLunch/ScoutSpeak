import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'
import { runTurn } from '@/lib/sessions/run-turn'

export const runtime = 'nodejs'

const Body = z.object({
  text: z.string().trim().min(1).max(500),
  inputMethod: z.enum(['voice_browser', 'voice_hosted', 'typed']).optional().default('typed'),
})

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx

  if (!ctx.session.participant_consent_at) {
    return NextResponse.json({ message: 'Consent is required.', error: 'consent_required' }, { status: 409 })
  }

  const body = Body.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ message: body.error.errors[0]?.message || 'Invalid request.' }, { status: 400 })
  }

  const result = await runTurn({
    client: ctx.client,
    sessionId: ctx.session.id,
    text: body.data.text,
    inputMethod: body.data.inputMethod,
  })
  if (!result.ok) {
    return NextResponse.json({ message: result.body.message, error: result.body.error }, { status: result.httpStatus })
  }
  const fresh = await resolveInvite(params.token)
  if (isResponse(fresh)) return fresh
  return NextResponse.json(await joinPayload(fresh, result.status))
}
