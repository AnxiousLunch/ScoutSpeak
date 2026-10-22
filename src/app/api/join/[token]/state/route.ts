import { NextRequest, NextResponse } from 'next/server'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'
import { expireStaleSession } from '@/lib/sessions/session-ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  const stale = await expireStaleSession(ctx.client, ctx.session)
  if (!stale.ok) return NextResponse.json(stale.body, { status: stale.httpStatus })
  return NextResponse.json(await joinPayload(ctx, stale.status))
}
