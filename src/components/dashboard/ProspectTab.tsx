import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  outcomesByStrategy,
  outcomesByFitLabel,
  MIN_CONFIRMED,
  type DashboardSession,
  type DashboardReview,
  type DashboardLead,
} from '@/lib/dashboard/aggregate'

interface ProspectTabProps {
  sessions: DashboardSession[]
  reviews: DashboardReview[]
  leads: DashboardLead[]
  days: number | null
  confirmedCount: number
}

function OutcomeTable({ groups, label }: { groups: ReturnType<typeof outcomesByStrategy>; label: string }) {
  return (
    <table className="outcome-table">
      <thead>
        <tr>
          <th>{label}</th>
          <th>Confirmed</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={group.key}>
            <td>
              <span className="outcome-key">{group.key.replaceAll('_', ' ')}</span>
              {group.smallSample && (
                <Badge variant="outline" className="small-sample-badge">
                  Small sample
                </Badge>
              )}
            </td>
            <td className="outcome-value">
              {group.confirmed} of {group.total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ProspectTab({ sessions, reviews, leads, days, confirmedCount }: ProspectTabProps) {
  const byStrategy = outcomesByStrategy(sessions, reviews, days)
  const byFitLabel = outcomesByFitLabel(sessions, reviews, leads, days)
  const rangeLabel = days === null ? 'all time' : days === 7 ? 'the last 7 days' : 'the last 30 days'

  if (sessions.length === 0) {
    return (
      <div className="dashboard-empty">
        <p>No completed prospect conversations yet.</p>
        <p className="text-muted-foreground">Start a prospect conversation to see outcomes.</p>
      </div>
    )
  }

  if (confirmedCount < MIN_CONFIRMED) {
    return (
      <div className="dashboard-insufficient">
        <span>◌</span>
        <div>
          <b>Insufficient data</b>
          <p>
            Only {confirmedCount} confirmed prospect outcome{confirmedCount === 1 ? '' : 's'} in {rangeLabel}.
            ScoutSpeak needs at least {MIN_CONFIRMED} confirmed outcomes before showing reliable figures.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-grid prospect-grid">
      <Card className="analytics-wide">
        <CardHeader>
          <CardTitle>Outcomes by strategy</CardTitle>
          <CardDescription>Confirmed outcomes by conversation strategy</CardDescription>
        </CardHeader>
        <CardContent>
          {byStrategy.length === 0 ? (
            <p className="text-muted-foreground">No prospect conversations match this range.</p>
          ) : (
            <OutcomeTable groups={byStrategy} label="Strategy" />
          )}
        </CardContent>
      </Card>

      <Card className="analytics-wide">
        <CardHeader>
          <CardTitle>Outcomes by lead fit</CardTitle>
          <CardDescription>Confirmed outcomes by lead fit label</CardDescription>
        </CardHeader>
        <CardContent>
          {byFitLabel.length === 0 ? (
            <p className="text-muted-foreground">No prospect conversations match this range.</p>
          ) : (
            <OutcomeTable groups={byFitLabel} label="Fit label" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
