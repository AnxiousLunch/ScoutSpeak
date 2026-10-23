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
        .select('id, name')
        .order('created_at', { ascending: false }),
      supabase
        .from('leads')
        .select('id, company_name, website_url, research_status, lead_status, fit_score, fit_label, enriched_at, discovery_source')
        .order('created_at', { ascending: false }),
    ])

  if (campaignsError || leadsError) {
    return (
      <LeadsClient
        leads={[]}
        campaigns={[]}
        campaignId={null}
        error={campaignsError?.message || leadsError?.message}
      />
    )
  }

  return (
    <LeadsClient
      leads={(leads ?? []) as unknown as React.ComponentProps<typeof LeadsClient>['leads']}
      campaigns={campaigns ?? []}
      campaignId={campaigns?.[0]?.id ?? null}
    />
  )
}
