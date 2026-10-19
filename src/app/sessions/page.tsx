import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversations — ScoutSpeak' }

type SessionRow = { id: string; lead_id: string; session_purpose: string; session_status: string; strategy_key: string | null; created_at: string }
type LeadRow = { id: string; company_name: string }

export default async function SessionsPage() {
  const supabase = createClient()
  const { data, error } = await supabase.from('conversation_sessions').select('id, lead_id, session_purpose, session_status, strategy_key, created_at').order('created_at', { ascending: false })
  const sessions = (data || []) as unknown as SessionRow[]
  const { data: leadData } = sessions.length ? await supabase.from('leads').select('id, company_name').in('id', sessions.map((session) => session.lead_id)) : { data: [] as LeadRow[] }
  const leadNames = new Map(((leadData || []) as unknown as LeadRow[]).map((lead) => [lead.id, lead.company_name]))

  return <div className="space-y-5">
    <div className="guided-page-heading"><p className="eyebrow">LEARN FROM EVERY OUTCOME</p><h1>Conversations</h1><p>Private rehearsals are saved here with their lead and transcript. Session links for a separate prospect are not available yet.</p></div>
    {error ? <Card><CardHeader><CardTitle>Couldn’t load conversations</CardTitle><CardDescription>{error.message} Try refreshing this page.</CardDescription></CardHeader></Card> : sessions.length === 0 ? <Card className="empty-state-card"><CardHeader><div className="empty-state-icon">◌</div><CardTitle>No conversations yet</CardTitle><CardDescription>Start a private rehearsal from any lead. ScoutSpeak will play the AI sales representative, and you can respond as the prospect.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/leads">Choose a lead <span className="ml-2">→</span></Link></Button></CardContent></Card> : <div className="session-list">{sessions.map((session) => <Link href={`/sessions/${session.id}`} key={session.id} className="session-list-row"><span className="session-list-icon">◌</span><span className="session-list-main"><b>{leadNames.get(session.lead_id) || 'Lead rehearsal'}</b><small>{session.session_purpose === 'rehearsal' ? 'Private rehearsal' : 'Prospect conversation'} · {(session.strategy_key || 'consultative').replaceAll('_', ' ')} · {new Date(session.created_at).toLocaleDateString()}</small></span><span className={`session-status-pill ${session.session_status}`}>{session.session_status.replaceAll('_', ' ')}</span><span className="session-row-arrow">→</span></Link>)}</div>}
  </div>
}
