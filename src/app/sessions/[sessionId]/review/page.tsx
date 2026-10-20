import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ReviewClient } from './ReviewClient'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({ params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('conversation_sessions')
    .select('id, lead_id, session_purpose, session_status')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (!session) notFound()

  const [{ data: lead }, { data: messages }, { data: existingReview }] = await Promise.all([
    supabase.from('leads').select('company_name').eq('id', session.lead_id).eq('owner_id', user.id).single(),
    supabase.from('conversation_messages').select('sequence_number, speaker_role, message_text').eq('session_id', session.id).eq('owner_id', user.id).order('sequence_number', { ascending: true }),
    supabase.from('session_reviews').select('*').eq('session_id', session.id).eq('owner_id', user.id).maybeSingle(),
  ])

  return (
    <ReviewClient
      sessionId={session.id}
      leadName={lead?.company_name ?? 'Unknown lead'}
      purpose={session.session_purpose}
      messages={messages ?? []}
      existingReview={existingReview}
    />
  )
}
