import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Complete your two-factor check first.' }, { status: 403 })
  }

  const { data: session, error: sessionError } = await supabase
    .from('conversation_sessions')
    .select('id, session_status, owner_id')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'This session was not found.' }, { status: 404 })
  }

  if (session.session_status !== 'created') {
    return NextResponse.json({ error: 'Consent can only be recorded before the session starts.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('conversation_sessions')
    .update({ participant_consent_at: now })
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Could not record consent. Please retry.' }, { status: 500 })
  }

  return NextResponse.json({ participant_consent_at: now })
}
