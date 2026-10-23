import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { loadDashboardData } from '@/lib/dashboard/queries'
import { DashboardAnalytics } from '@/components/dashboard/DashboardAnalytics'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string; range?: string }
}) {
  const supabase = createClient()
  const [
    { count: leadCount, error: leadError },
    { count: campaignCount, error: campaignError },
    { data: profile, error: profileError },
    { count: sessionCount, error: sessionError },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase
      .from('business_profiles')
      .select('business_name, version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('conversation_sessions').select('*', { count: 'exact', head: true }),
  ])
  const profileInfo = profile as unknown as { business_name: string | null; version: number } | null
  const error = leadError || campaignError || profileError || sessionError
  const setup = [Boolean(profileInfo), (campaignCount || 0) > 0, (leadCount || 0) > 0]
  const completed = setup.filter(Boolean).length
  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  })
    .format(new Date())
    .toUpperCase()

  const initialTab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab ?? 'rehearsal'
  const initialRange = Array.isArray(searchParams.range) ? searchParams.range[0] : searchParams.range ?? 'all'

  return (
    <div className="dashboard">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Good work starts with a good lead.</h1>
          <p className="page-subtitle">Your prospecting workspace, all in one place.</p>
        </div>
        <Button asChild className="primary-action">
          <Link href={leadCount ? '/leads' : '/profile'}>
            {leadCount ? 'Explore your leads' : 'Set up your workspace'} <span>↗</span>
          </Link>
        </Button>
      </div>

      {error && (
        <div className="inline-notice error-notice" role="alert">
          <span>!</span>
          <div>
            <b>Some workspace data couldn’t be loaded</b>
            <p>{error.message} Refresh the page to try again.</p>
          </div>
        </div>
      )}

      <section className="metric-grid" aria-label="Workspace summary">
        <Card className="metric-card">
          <CardContent>
            <span className="metric-label">Total leads</span>
            <strong>{leadCount ?? '—'}</strong>
            <span className="metric-note">{leadCount ? 'Across your workspace' : 'Ready when you are'}</span>
            <span className="metric-icon">◎</span>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent>
            <span className="metric-label">Active campaigns</span>
            <strong>{campaignCount ?? '—'}</strong>
            <span className="metric-note">Campaigns in your workspace</span>
            <span className="metric-icon">↗</span>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent>
            <span className="metric-label">Conversations</span>
            <strong>{sessionCount ?? '—'}</strong>
            <span className="metric-note">Rehearsals and prospect calls</span>
            <span className="metric-icon">◌</span>
          </CardContent>
        </Card>
      </section>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardAnalyticsWrapper initialTab={initialTab} initialRange={initialRange} />
      </Suspense>

      <section className="dashboard-grid">
        <Card className="setup-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2>Start with the essentials</h2>
              <p>Three quick steps to a better-prepared conversation.</p>
            </div>
            <Badge variant="secondary">{completed} of 3 done</Badge>
          </div>
          <div className="setup-progress">
            <span style={{ width: `${(completed / 3) * 100}%` }} />
          </div>
          <div className="setup-steps">
            <Link href="/profile" className={`setup-step ${setup[0] ? 'done' : ''}`}>
              <span className="step-number">{setup[0] ? '✓' : '01'}</span>
              <span>
                <b>Define your offer</b>
                <small>
                  {profileInfo?.business_name
                    ? `${profileInfo.business_name} · version ${profileInfo.version}`
                    : 'Tell ScoutSpeak what you do and who you help.'}
                </small>
              </span>
              <span className="step-chevron">↗</span>
            </Link>
            <Link href="/campaigns" className={`setup-step ${setup[1] ? 'done' : ''}`}>
              <span className="step-number">{setup[1] ? '✓' : '02'}</span>
              <span>
                <b>Set a campaign goal</b>
                <small>
                  {setup[1] ? `${campaignCount} campaign${campaignCount === 1 ? '' : 's'} ready` : 'Give your outreach a clear purpose.'}
                </small>
              </span>
              <span className="step-chevron">↗</span>
            </Link>
            <Link href="/leads" className={`setup-step ${setup[2] ? 'done' : ''}`}>
              <span className="step-number">{setup[2] ? '✓' : '03'}</span>
              <span>
                <b>Build your lead list</b>
                <small>
                  {setup[2] ? `${leadCount} lead${leadCount === 1 ? '' : 's'} in your workspace` : 'Import a CSV, add a company, or try sample leads.'}
                </small>
              </span>
              <span className="step-chevron">↗</span>
            </Link>
          </div>
        </Card>
        <Card className="insight-card">
          <div className="insight-top">
            <span className="insight-icon">✳</span>
            <Badge variant="outline">THE SCOUTSPEAK APPROACH</Badge>
          </div>
          <h2>Know why you’re calling before you call.</h2>
          <p>
            Every lead gets context from public sources, with facts and inferences clearly separated. Your conversations stay grounded in what’s known.
          </p>
          <Link href="/leads" className="text-link">
            See how lead context works <span>→</span>
          </Link>
          <div className="insight-rule" />
          <div className="trust-line">
            <span className="trust-dot" /> Evidence first <span className="trust-dot" /> No invented claims
          </div>
        </Card>
      </section>
      <div className="dashboard-footnote">
        <span>◎</span> Rehearsal insights stay separate from prospect conversation outcomes.
      </div>
    </div>
  )
}

async function DashboardAnalyticsWrapper({
  initialTab,
  initialRange,
}: {
  initialTab: string
  initialRange: string
}) {
  const { sessions, reviews, leads, error } = await loadDashboardData()
  if (error) {
    return (
      <div className="inline-notice error-notice" role="alert">
        <span>!</span>
        <div>
          <b>Dashboard analytics couldn’t be loaded</b>
          <p>{error} Refresh the page to try again.</p>
        </div>
      </div>
    )
  }
  return (
    <DashboardAnalytics
      sessions={sessions}
      reviews={reviews}
      leads={leads}
      initialTab={initialTab}
      initialRange={initialRange}
    />
  )
}
