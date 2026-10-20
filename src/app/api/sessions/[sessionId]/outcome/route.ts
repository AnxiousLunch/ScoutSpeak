import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { extractOutcome } from 'voicesession'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

function aiHttpStatus(error: AiError): number {
  switch (error.code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    default:
      return 502
  }
}

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'mfa_challenge_required' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('id, brief, session_purpose')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }

  const { data: messages } = await supabase
    .from('conversation_messages')
    .select('sequence_number, speaker_role, message_text')
    .eq('session_id', session.id)
    .eq('owner_id', user.id)
    .order('sequence_number', { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'no_messages' }, { status: 400 })
  }

  const brief = typeof session.brief === 'object' && session.brief !== null
    ? JSON.stringify(session.brief)
    : undefined

  try {
    const result = await extractOutcome({
      model: getModelClient(),
      messages: messages.map((m) => ({
        id: `${m.sequence_number}`,
        session_id: session.id,
        sequence_number: m.sequence_number,
        speaker_role: m.speaker_role as 'agent' | 'human',
        message_text: m.message_text,
        created_at: new Date().toISOString(),
      })),
      brief,
      maxTokens: 1200,
    })

    if (result.error || !result.review) {
      return NextResponse.json({ error: result.error || 'extraction_failed' }, { status: 502 })
    }

    return NextResponse.json({ review: result.review })
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: aiHttpStatus(error) })
    }
    const message = error instanceof Error ? error.message : 'Outcome extraction failed'
    return NextResponse.json({ error: 'internal_error', message }, { status: 500 })
  }
}
