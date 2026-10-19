import { createClient } from '@/utils/supabase/server'
import { CampaignForm } from './CampaignForm'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Campaigns — ScoutSpeak',
}

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = createClient()

  const [{ data: campaigns, error: campaignsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('campaigns').select('id, name, objective, status').order('created_at', { ascending: false }),
      supabase.from('business_profiles').select('id').order('version', { ascending: false }).limit(1),
    ])

  if (campaignsError || profilesError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <Card>
          <CardHeader>
            <CardTitle>Error loading campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              {campaignsError?.message || profilesError?.message}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
      <CampaignForm
        campaigns={campaigns ?? []}
        canCreate={(profiles?.length ?? 0) > 0}
      />
    </div>
  )
}
