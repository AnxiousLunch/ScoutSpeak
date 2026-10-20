import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { LeadDetailClient } from './LeadDetailClient'

export const metadata = {
  title: 'Lead detail — ScoutSpeak',
}

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Lead detail</h1>
        <p className="text-sm text-muted-foreground">Sign in to view this lead.</p>
      </div>
    )
  }

  const [{ data: lead, error: leadError }, { data: evidence, error: evidenceError }] =
    await Promise.all([
      supabase.from('leads').select('*').eq('id', params.id).eq('owner_id', user.id).single(),
      supabase
        .from('lead_evidence')
        .select('*')
        .eq('lead_id', params.id)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true }),
    ])

  if (leadError || !lead) {
    notFound()
  }

  return (
    <LeadDetailClient
      lead={lead}
      evidence={evidence ?? []}
      error={evidenceError?.message}
    />
  )
}
