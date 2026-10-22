import { NextRequest, NextResponse } from 'next/server'
import { isResponse, joinPayload, resolveInvite } from '@/lib/sessions/join-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx
  return NextResponse.json(await joinPayload(ctx))
}
