import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  strategyCounts,
  latestReviewNotes,
  repeatAttempts,
  type DashboardSession,
  type DashboardReview,
  type DashboardLead,
} from '@/lib/dashboard/aggregate'

interface RehearsalTabProps {
  sessions: DashboardSession[]
  reviews: DashboardReview[]
  leads: DashboardLead[]
}

export function RehearsalTab({ sessions, reviews, leads }: RehearsalTabProps) {
  const counts = strategyCounts(sessions)
  const notes = latestReviewNotes(sessions, reviews, 5)
  const repeats = repeatAttempts(sessions)
  const leadMap = new Map(leads.map((l) => [l.id, l]))

  if (sessions.length === 0) {
    return (
      <div className="dashboard-empty">
        <p>No completed rehearsals yet.</p>
        <p className="text-muted-foreground">Start a rehearsal from a lead to see insights.</p>
      </div>
    )
  }

  return (
    <div className="analytics-grid">
      <Card>
        <CardHeader>
          <CardTitle>Total rehearsals</CardTitle>
          <CardDescription>Completed rehearsal sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="analytics-big-number">{sessions.length}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strategies used</CardTitle>
          <CardDescription>By completed rehearsal</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="analytics-list">
            {Object.entries(counts).map(([key, count]) => (
              <li key={key}>
                <span>{key.replaceAll('_', ' ')}</span>
                <Badge variant="secondary">{count}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="analytics-wide">
        <CardHeader>
          <CardTitle>Latest review notes</CardTitle>
          <CardDescription>Objection handling and missed opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-muted-foreground">No review notes yet.</p>
          ) : (
            <ul className="analytics-notes">
              {notes.map((note) => (
                <li key={`${note.session_id}-${note.kind}`}>
                  <Badge variant="outline" className="note-badge">{note.kind.replaceAll('_', ' ')}</Badge>
                  <p>{note.text}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="analytics-wide">
        <CardHeader>
          <CardTitle>Repeat attempts</CardTitle>
          <CardDescription>Leads with two or more rehearsals</CardDescription>
        </CardHeader>
        <CardContent>
          {repeats.length === 0 ? (
            <p className="text-muted-foreground">No repeat rehearsals yet.</p>
          ) : (
            <ul className="analytics-list">
              {repeats.map(({ lead_id, count }) => {
                const company = leadMap.get(lead_id)?.company_name ?? 'Unknown lead'
                return (
                  <li key={lead_id}>
                    <span>{company}</span>
                    <Badge variant="secondary">{count} rehearsals</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
