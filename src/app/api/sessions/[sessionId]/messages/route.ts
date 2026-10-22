import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ message: 'Complete your two-factor check first.' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('id, session_status')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) return NextResponse.json({ message: 'This session was not found.' }, { status: 404 })

  const { data: messages, error } = await supabase
    .from('conversation_messages')
    .select('sequence_number, speaker_role, message_text')
    .eq('session_id', session.id)
    .eq('owner_id', user.id)
    .order('sequence_number', { ascending: true })
  if (error) return NextResponse.json({ message: 'Could not load the transcript.' }, { status: 500 })
  return NextResponse.json({ status: session.session_status, messages: messages ?? [] })
}
