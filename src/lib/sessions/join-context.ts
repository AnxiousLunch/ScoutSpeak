import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, isExpired } from '@/lib/sessions/invite'
import type { DbClient, SessionRow } from '@/lib/sessions/session-ops'

export interface JoinContext {
  client: DbClient
  session: SessionRow
}

export interface JoinMessage {
  sequence_number: number
  speaker_role: string
  message_text: string | null
}

// Resolves an invite token to ONLY that invite's session. Never returns owner_id to callers' responses.
export async function resolveInvite(token: string): Promise<JoinContext | NextResponse> {
  let client: DbClient
  try {
    client = createAdminClient()
  } catch {
    return NextResponse.json({ message: 'This link is not available right now.' }, { status: 503 })
  }
  const { data: invite } = await client
    .from('session_invites')
    .select('session_id, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!invite) return NextResponse.json({ message: 'This link is not valid.' }, { status: 404 })
  if (isExpired(invite.expires_at)) return NextResponse.json({ message: 'This link has expired.' }, { status: 410 })
  const { data: session } = await client
    .from('conversation_sessions')
    .select('*')
    .eq('id', invite.session_id)
    .eq('session_purpose', 'prospect_conversation')
    .maybeSingle()
  if (!session) return NextResponse.json({ message: 'This link is not valid.' }, { status: 404 })
  return { client, session }
}

export function isResponse(value: JoinContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}

export async function joinPayload(ctx: JoinContext, statusOverride?: string) {
  const [{ data: messages }, { data: profile }] = await Promise.all([
    ctx.client
      .from('conversation_messages')
      .select('sequence_number, speaker_role, message_text')
      .eq('session_id', ctx.session.id)
      .order('sequence_number', { ascending: true }),
    ctx.session.business_profile_version == null
      ? Promise.resolve({ data: null })
      : ctx.client
          .from('business_profiles')
          .select('business_name')
          .eq('owner_id', ctx.session.owner_id)
          .eq('version', ctx.session.business_profile_version)
          .maybeSingle(),
  ])
  const clean: JoinMessage[] = (messages ?? []).map((m) => ({
    sequence_number: m.sequence_number,
    speaker_role: m.speaker_role,
    message_text: m.message_text,
  }))
  return {
    status: statusOverride ?? ctx.session.session_status,
    messages: clean,
    businessName: profile?.business_name ?? null,
  }
}
