import { createClient } from '@/utils/supabase/server'
import { LeadsClient } from './LeadsClient'

export const metadata = {
  title: 'Leads — ScoutSpeak',
}

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = createClient()

  const [{ data: campaigns, error: campaignsError }, { data: leads, error: leadsError }] =
    await Promise.all([
      supabase
        .from('campaigns')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('leads')
        .select('id, company_name, website_url, research_status, lead_status, fit_score')
        .order('created_at', { ascending: false }),
    ])

  if (campaignsError || leadsError) {
    return (
      <LeadsClient
        leads={[]}
        campaignId={null}
        error={campaignsError?.message || leadsError?.message}
      />
    )
  }

  return (
    <LeadsClient
      leads={leads ?? []}
      campaignId={campaigns?.[0]?.id ?? null}
    />
  )
}
