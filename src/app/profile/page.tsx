import { createClient } from '@/utils/supabase/server'
import { ProfileForm } from './ProfileForm'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Profile — ScoutSpeak',
}

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: profiles, error } = await supabase
    .from('business_profiles')
    .select('*')
    .order('version', { ascending: false })

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Business profile</h1>
        <Card>
          <CardHeader>
            <CardTitle>Error loading profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const current = profiles?.[0]

  return (
    <div className="space-y-6">
      <div className="guided-page-heading"><p className="eyebrow">STEP 1 · SET YOUR FOUNDATION</p><h1>Business profile</h1><p>Tell ScoutSpeak what you offer and which prospects are a good fit. You can refine this any time; each save creates a version for future conversation briefs.</p></div>

      <ProfileForm
        initialValues={
          current
            ? {
                business_name: current.business_name ?? '',
                services: current.services ?? '',
                value_proposition: current.value_proposition ?? '',
                target_industry: current.target_industry ?? '',
                target_geography: current.target_geography ?? '',
                constraints: current.constraints ?? '',
              }
            : undefined
        }
        currentVersion={current?.version}
      />

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>
            {profiles && profiles.length > 0
              ? `${profiles.length} saved version(s). Earlier sessions can retain the profile version they were prepared with.`
              : 'No versions yet. Your first save becomes version 1.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles && profiles.length > 0 ? (
            <ul className="space-y-2">
              {profiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <span className="font-medium">
                    v{profile.version} · {profile.business_name || 'Untitled'}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save your first profile to see version history here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
