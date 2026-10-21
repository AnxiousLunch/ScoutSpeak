'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  rehearsals,
  prospects,
  strategyCounts,
  latestReviewNotes,
  repeatAttempts,
  totalConfirmedProspects,
  outcomesByStrategy,
  outcomesByFitLabel,
  parseRange,
  MIN_CONFIRMED,
  type DashboardSession,
  type DashboardReview,
  type DashboardLead,
} from '@/lib/dashboard/aggregate'
import { RehearsalTab } from './RehearsalTab'
import { ProspectTab } from './ProspectTab'

type Tab = 'rehearsal' | 'prospect'

interface DashboardAnalyticsProps {
  sessions: DashboardSession[]
  reviews: DashboardReview[]
  leads: DashboardLead[]
  initialTab?: string
  initialRange?: string
}

const RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: 'All time', value: 'all' },
]

export function DashboardAnalytics({
  sessions,
  reviews,
  leads,
  initialTab = 'rehearsal',
  initialRange = 'all',
}: DashboardAnalyticsProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab === 'prospect' ? 'prospect' : 'rehearsal')
  const [range, setRange] = useState(initialRange === '7' || initialRange === '30' ? initialRange : 'all')

  const days = parseRange(range)
  const completedRehearsals = rehearsals(sessions)
  const completedProspects = prospects(sessions)
  const confirmedProspectCount = totalConfirmedProspects(sessions, reviews, days)

  function updateTab(next: Tab) {
    setTab(next)
    router.replace(`/?tab=${next}&range=${range}`, { scroll: false })
  }

  function updateRange(next: string) {
    setRange(next)
    router.replace(`/?tab=${tab}&range=${next}`, { scroll: false })
  }

  if (sessions.length === 0) {
    return (
      <Card className="empty-state-card">
        <CardHeader>
          <div className="empty-state-icon">◌</div>
          <CardTitle>No conversations yet</CardTitle>
          <CardDescription>
            Complete a rehearsal or prospect conversation to see analytics here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/leads">Choose a lead</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="analytics-card">
      <CardHeader className="analytics-card-header">
        <div className="analytics-header">
          <div>
            <p className="eyebrow">ANALYTICS</p>
            <CardTitle>Conversation insights</CardTitle>
            <CardDescription>
              {completedRehearsals.length} completed rehearsal{completedRehearsals.length === 1 ? '' : 's'} ·{' '}
              {completedProspects.length} completed prospect conversation{completedProspects.length === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <div className="analytics-controls">
            {tab === 'prospect' && (
              <div className="range-toggle" role="group" aria-label="Date range">
                {RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={range === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateRange(option.value)}
                    aria-pressed={range === option.value}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="tab-toggle" role="group" aria-label="Dashboard tab">
              <Button
                type="button"
                variant={tab === 'rehearsal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateTab('rehearsal')}
                aria-pressed={tab === 'rehearsal'}
              >
                Rehearsals
              </Button>
              <Button
                type="button"
                variant={tab === 'prospect' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateTab('prospect')}
                aria-pressed={tab === 'prospect'}
              >
                Prospects
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="analytics-card-content">
        {tab === 'rehearsal' ? (
          <RehearsalTab
            sessions={completedRehearsals}
            reviews={reviews}
            leads={leads}
          />
        ) : (
          <ProspectTab
            sessions={completedProspects}
            reviews={reviews}
            leads={leads}
            days={days}
            confirmedCount={confirmedProspectCount}
          />
        )}
      </CardContent>
    </Card>
  )
}
