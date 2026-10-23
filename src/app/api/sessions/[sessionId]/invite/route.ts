import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { transition, type SessionStatus } from 'voicesession'
import { createToken, hashToken, INVITE_TTL_MS } from '@/lib/sessions/invite'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ message: 'Complete your two-factor check first.' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('id, session_status, session_purpose')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) return NextResponse.json({ message: 'This session was not found.' }, { status: 404 })
  if (session.session_purpose !== 'prospect_conversation') {
    return NextResponse.json({ message: 'Invite links are only for prospect conversations.' }, { status: 409 })
  }

  const current = session.session_status as SessionStatus
  if (current !== 'created' && current !== 'waiting_for_participant') {
    return NextResponse.json({ message: `Cannot create a link for a session in ${current} state.` }, { status: 409 })
  }

  const token = createToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const { error: inviteError } = await supabase
    .from('session_invites')
    .insert({ session_id: session.id, owner_id: user.id, token_hash: hashToken(token), expires_at: expiresAt })
  if (inviteError) return NextResponse.json({ message: 'Could not create the link. Please retry.' }, { status: 500 })

  if (current === 'created') {
    const next = transition(current, 'waiting_for_participant')
    if (next.error) return NextResponse.json({ message: next.error }, { status: 409 })
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ session_status: next.status })
      .eq('id', session.id)
      .eq('owner_id', user.id)
    if (error) return NextResponse.json({ message: 'The link was created but the session could not be updated.' }, { status: 500 })
  }

  const origin = req.headers.get('origin') ?? req.nextUrl.origin
  return NextResponse.json({ url: `${origin}/join/${token}`, expiresAt, status: 'waiting_for_participant' })
}
