export interface DashboardSession {
  id: string
  lead_id: string
  session_purpose: string
  session_status: string
  strategy_key: string | null
  created_at: string
}

export interface QualityNotes {
  objection_handling?: string | null
  missed_opportunities?: string | null
}

export interface DashboardReview {
  session_id: string
  outcome_confirmed: string | null
  quality_notes: QualityNotes | null
  objection_tags: unknown
}

export interface DashboardLead {
  id: string
  company_name: string
  fit_label: string | null
}

export interface ReviewNote {
  session_id: string
  kind: 'objection_handling' | 'missed_opportunities'
  text: string
  created_at: string
}

export interface OutcomeGroup {
  key: string
  confirmed: number
  total: number
  smallSample: boolean
}

export const MIN_CONFIRMED = 5

export function completedSessions(sessions: DashboardSession[]): DashboardSession[] {
  return sessions.filter((s) => s.session_status === 'completed')
}

export function rehearsals(sessions: DashboardSession[]): DashboardSession[] {
  return completedSessions(sessions).filter((s) => s.session_purpose === 'rehearsal')
}

export function prospects(sessions: DashboardSession[]): DashboardSession[] {
  return completedSessions(sessions).filter((s) => s.session_purpose === 'prospect_conversation')
}

export function strategyCounts(sessions: DashboardSession[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of sessions) {
    const key = s.strategy_key || 'unknown'
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export function latestReviewNotes(
  sessions: DashboardSession[],
  reviews: DashboardReview[],
  limit = 5
): ReviewNote[] {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))
  const notes: ReviewNote[] = []
  for (const review of reviews) {
    const session = sessionMap.get(review.session_id)
    if (!session || session.session_purpose !== 'rehearsal' || session.session_status !== 'completed') {
      continue
    }
    const qn = review.quality_notes
    if (!qn) continue
    if (typeof qn.objection_handling === 'string' && qn.objection_handling.trim()) {
      notes.push({
        session_id: review.session_id,
        kind: 'objection_handling',
        text: qn.objection_handling.trim(),
        created_at: session.created_at,
      })
    }
    if (typeof qn.missed_opportunities === 'string' && qn.missed_opportunities.trim()) {
      notes.push({
        session_id: review.session_id,
        kind: 'missed_opportunities',
        text: qn.missed_opportunities.trim(),
        created_at: session.created_at,
      })
    }
  }
  notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return notes.slice(0, limit)
}

export interface RepeatAttempt {
  lead_id: string
  count: number
}

export function repeatAttempts(sessions: DashboardSession[]): RepeatAttempt[] {
  const byLead = new Map<string, number>()
  for (const s of sessions) {
    if (s.session_purpose !== 'rehearsal' || s.session_status !== 'completed') continue
    byLead.set(s.lead_id, (byLead.get(s.lead_id) || 0) + 1)
  }
  return Array.from(byLead.entries())
    .filter(([, count]) => count >= 2)
    .map(([lead_id, count]) => ({ lead_id, count }))
    .sort((a, b) => b.count - a.count)
}

export function parseRange(range: string): number | null {
  if (range === '7') return 7
  if (range === '30') return 30
  return null
}

function isWithinRange(date: string, days: number | null): boolean {
  if (days === null) return true
  const then = new Date(date).getTime()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return then >= cutoff
}

export function totalConfirmedProspects(
  sessions: DashboardSession[],
  reviews: DashboardReview[],
  days: number | null
): number {
  const reviewMap = new Map(reviews.map((r) => [r.session_id, r]))
  let count = 0
  for (const s of sessions) {
    if (s.session_purpose !== 'prospect_conversation' || s.session_status !== 'completed') continue
    if (!isWithinRange(s.created_at, days)) continue
    const review = reviewMap.get(s.id)
    if (review?.outcome_confirmed) count++
  }
  return count
}

export function outcomesByStrategy(
  sessions: DashboardSession[],
  reviews: DashboardReview[],
  days: number | null
): OutcomeGroup[] {
  const reviewMap = new Map(reviews.map((r) => [r.session_id, r]))
  const groups = new Map<string, { confirmed: number; total: number }>()
  for (const s of sessions) {
    if (s.session_purpose !== 'prospect_conversation' || s.session_status !== 'completed') continue
    if (!isWithinRange(s.created_at, days)) continue
    const key = s.strategy_key || 'unknown'
    const current = groups.get(key) || { confirmed: 0, total: 0 }
    current.total++
    const review = reviewMap.get(s.id)
    if (review?.outcome_confirmed) current.confirmed++
    groups.set(key, current)
  }
  return Array.from(groups.entries())
    .map(([key, { confirmed, total }]) => ({
      key,
      confirmed,
      total,
      smallSample: total < 5,
    }))
    .sort((a, b) => b.total - a.total)
}

export function outcomesByFitLabel(
  sessions: DashboardSession[],
  reviews: DashboardReview[],
  leads: DashboardLead[],
  days: number | null
): OutcomeGroup[] {
  const leadMap = new Map(leads.map((l) => [l.id, l]))
  const reviewMap = new Map(reviews.map((r) => [r.session_id, r]))
  const groups = new Map<string, { confirmed: number; total: number }>()
  for (const s of sessions) {
    if (s.session_purpose !== 'prospect_conversation' || s.session_status !== 'completed') continue
    if (!isWithinRange(s.created_at, days)) continue
    const lead = leadMap.get(s.lead_id)
    const key = lead?.fit_label || 'unknown'
    const current = groups.get(key) || { confirmed: 0, total: 0 }
    current.total++
    const review = reviewMap.get(s.id)
    if (review?.outcome_confirmed) current.confirmed++
    groups.set(key, current)
  }
  return Array.from(groups.entries())
    .map(([key, { confirmed, total }]) => ({
      key,
      confirmed,
      total,
      smallSample: total < 5,
    }))
    .sort((a, b) => b.total - a.total)
}
