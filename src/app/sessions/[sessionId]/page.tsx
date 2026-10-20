import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { SessionRoom, type SessionMessage } from './SessionRoom'

export const dynamic = 'force-dynamic'

type SessionRecord = { id: string; lead_id: string; campaign_id: string; business_profile_version: number | null; session_status: string; session_purpose: string }
type LeadRecord = { company_name: string; research_status: string }
type CampaignRecord = { objective: string | null }

export default async function SessionPage({ params }: { params: { sessionId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawSession } = await supabase.from('conversation_sessions').select('id, lead_id, campaign_id, business_profile_version, session_status, session_purpose').eq('id', params.sessionId).eq('owner_id', user.id).single()
  const session = rawSession as unknown as SessionRecord | null
  if (!session || (session.session_purpose !== 'rehearsal' && session.session_purpose !== 'prospect_conversation')) notFound()

  const [{ data: rawLead }, { data: rawCampaign }, { data: rawMessages }, { data: evidence }] = await Promise.all([
    supabase.from('leads').select('company_name, research_status').eq('id', session.lead_id).eq('owner_id', user.id).single(),
    supabase.from('campaigns').select('objective').eq('id', session.campaign_id).eq('owner_id', user.id).single(),
    supabase.from('conversation_messages').select('sequence_number, speaker_role, message_text').eq('session_id', session.id).eq('owner_id', user.id).order('sequence_number', { ascending: true }),
    supabase.from('lead_evidence').select('id').eq('lead_id', session.lead_id).eq('owner_id', user.id),
  ])
  const lead = rawLead as unknown as LeadRecord | null
  const campaign = rawCampaign as unknown as CampaignRecord | null
  const messages = (rawMessages || []) as unknown as SessionMessage[]
  if (!lead || !campaign) notFound()

  return <div className="session-page"><Link href="/leads" className="session-breadcrumb">← Back to leads</Link><SessionRoom sessionId={session.id} leadName={lead.company_name} leadStatus={lead.research_status} evidenceCount={evidence?.length || 0} campaignObjective={campaign.objective} sessionStatus={session.session_status} initialMessages={messages} /></div>
}
