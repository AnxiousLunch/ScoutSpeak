import { describe, it, expect } from 'vitest'
import {
  MIN_CONFIRMED,
  completedSessions,
  rehearsals,
  prospects,
  strategyCounts,
  latestReviewNotes,
  repeatAttempts,
  totalConfirmedProspects,
  outcomesByStrategy,
  outcomesByFitLabel,
  parseRange,
  type DashboardSession,
  type DashboardReview,
  type DashboardLead,
} from './aggregate'

function session(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: crypto.randomUUID(),
    lead_id: 'lead-1',
    session_purpose: 'rehearsal',
    session_status: 'completed',
    strategy_key: 'consultative',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function review(overrides: Partial<DashboardReview> = {}): DashboardReview {
  return {
    session_id: 'session-1',
    outcome_confirmed: null,
    quality_notes: null,
    objection_tags: null,
    ...overrides,
  }
}

function lead(overrides: Partial<DashboardLead> = {}): DashboardLead {
  return {
    id: 'lead-1',
    company_name: 'Acme',
    fit_label: 'strong',
    ...overrides,
  }
}

describe('completed sessions filter', () => {
  it('counts only completed sessions', () => {
    const sessions = [
      session({ session_status: 'completed' }),
      session({ session_status: 'active' }),
      session({ session_status: 'cancelled' }),
    ]
    expect(completedSessions(sessions)).toHaveLength(1)
  })
})

describe('purpose separation', () => {
  it('rehearsal rows never appear in prospect figures', () => {
    const sessions = [
      session({ id: 'r1', session_purpose: 'rehearsal', session_status: 'completed' }),
      session({ id: 'r2', session_purpose: 'rehearsal', session_status: 'completed' }),
      session({ id: 'p1', session_purpose: 'prospect_conversation', session_status: 'completed' }),
      session({ id: 'p2', session_purpose: 'prospect_conversation', session_status: 'completed' }),
      session({ id: 'p3', session_purpose: 'prospect_conversation', session_status: 'active' }),
    ]
    expect(rehearsals(sessions).map((s) => s.id)).toEqual(['r1', 'r2'])
    expect(prospects(sessions).map((s) => s.id)).toEqual(['p1', 'p2'])
  })

  it('prospect rows never appear in rehearsal figures', () => {
    const sessions = [
      session({ id: 'r1', session_purpose: 'rehearsal', session_status: 'completed', strategy_key: 'concise' }),
      session({ id: 'p1', session_purpose: 'prospect_conversation', session_status: 'completed', strategy_key: 'concise' }),
    ]
    const counts = strategyCounts(rehearsals(sessions))
    expect(counts).toEqual({ concise: 1 })
  })
})

describe('rehearsal aggregates', () => {
  it('counts strategies used', () => {
    const sessions = [
      session({ strategy_key: 'consultative' }),
      session({ strategy_key: 'consultative' }),
      session({ strategy_key: 'concise' }),
    ]
    expect(strategyCounts(rehearsals(sessions))).toEqual({ consultative: 2, concise: 1 })
  })

  it('collects latest review notes from completed rehearsals only', () => {
    const s1 = session({ id: 's1', session_purpose: 'rehearsal', created_at: '2025-01-03T00:00:00Z' })
    const s2 = session({ id: 's2', session_purpose: 'prospect_conversation', created_at: '2025-01-04T00:00:00Z' })
    const s3 = session({ id: 's3', session_purpose: 'rehearsal', session_status: 'active', created_at: '2025-01-05T00:00:00Z' })
    const reviews = [
      review({ session_id: 's1', quality_notes: { objection_handling: 'Handled price' } }),
      review({ session_id: 's2', quality_notes: { objection_handling: 'Should not appear' } }),
      review({ session_id: 's3', quality_notes: { objection_handling: 'Active session' } }),
    ]
    const notes = latestReviewNotes([s1, s2, s3], reviews)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ session_id: 's1', kind: 'objection_handling', text: 'Handled price' })
  })

  it('returns repeat attempts for leads with two or more rehearsals', () => {
    const sessions = [
      session({ lead_id: 'a', session_purpose: 'rehearsal' }),
      session({ lead_id: 'a', session_purpose: 'rehearsal' }),
      session({ lead_id: 'a', session_purpose: 'rehearsal' }),
      session({ lead_id: 'b', session_purpose: 'rehearsal' }),
      session({ lead_id: 'c', session_purpose: 'rehearsal' }),
      session({ lead_id: 'c', session_purpose: 'rehearsal' }),
    ]
    const repeats = repeatAttempts(sessions)
    expect(repeats).toHaveLength(2)
    expect(repeats).toContainEqual({ lead_id: 'a', count: 3 })
    expect(repeats).toContainEqual({ lead_id: 'c', count: 2 })
  })
})

describe('prospect outcome denominators', () => {
  it('reports x of n with correct denominators by strategy', () => {
    const sessions = [
      session({ id: 'c1', session_purpose: 'prospect_conversation', strategy_key: 'consultative' }),
      session({ id: 'c2', session_purpose: 'prospect_conversation', strategy_key: 'consultative' }),
      session({ id: 'c3', session_purpose: 'prospect_conversation', strategy_key: 'consultative' }),
      session({ id: 'o1', session_purpose: 'prospect_conversation', strategy_key: 'objection-handling' }),
    ]
    const reviews = [
      review({ session_id: 'c1', outcome_confirmed: 'meeting' }),
      review({ session_id: 'c2', outcome_confirmed: 'meeting' }),
      review({ session_id: 'c3', outcome_confirmed: null }),
      review({ session_id: 'o1', outcome_confirmed: 'meeting' }),
    ]
    const byStrategy = outcomesByStrategy(sessions, reviews, null)
    expect(byStrategy).toContainEqual({ key: 'consultative', confirmed: 2, total: 3, smallSample: true })
    expect(byStrategy).toContainEqual({ key: 'objection-handling', confirmed: 1, total: 1, smallSample: true })
  })

  it('reports x of n with correct denominators by fit_label', () => {
    const sessions = [
      session({ id: 's1', session_purpose: 'prospect_conversation', lead_id: 'strong-lead' }),
      session({ id: 's2', session_purpose: 'prospect_conversation', lead_id: 'strong-lead' }),
      session({ id: 's3', session_purpose: 'prospect_conversation', lead_id: 'weak-lead' }),
    ]
    const leads = [
      lead({ id: 'strong-lead', fit_label: 'strong' }),
      lead({ id: 'weak-lead', fit_label: 'weak' }),
    ]
    const reviews = [
      review({ session_id: 's1', outcome_confirmed: 'meeting' }),
      review({ session_id: 's2', outcome_confirmed: null }),
      review({ session_id: 's3', outcome_confirmed: 'meeting' }),
    ]
    const byFit = outcomesByFitLabel(sessions, reviews, leads, null)
    expect(byFit).toContainEqual({ key: 'strong', confirmed: 1, total: 2, smallSample: true })
    expect(byFit).toContainEqual({ key: 'weak', confirmed: 1, total: 1, smallSample: true })
  })
})

describe('prospect threshold behaviour', () => {
  it('flags small samples and hides table when confirmed prospects are below MIN_CONFIRMED', () => {
    const sessions = Array.from({ length: 4 }, (_, i) =>
      session({
        id: `p${i}`,
        session_purpose: 'prospect_conversation',
        strategy_key: 'consultative',
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      })
    )
    const reviews = sessions.map((s, i) => review({ session_id: s.id, outcome_confirmed: i < 3 ? 'meeting' : null }))
    expect(totalConfirmedProspects(sessions, reviews, null)).toBe(3)
    expect(MIN_CONFIRMED).toBe(5)
    expect(totalConfirmedProspects(sessions, reviews, null)).toBeLessThan(MIN_CONFIRMED)
  })

  it('shows data once confirmed prospects reach MIN_CONFIRMED', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      session({
        id: `p${i}`,
        session_purpose: 'prospect_conversation',
        strategy_key: 'consultative',
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      })
    )
    const reviews = sessions.map((s) => review({ session_id: s.id, outcome_confirmed: 'meeting' }))
    expect(totalConfirmedProspects(sessions, reviews, null)).toBe(5)
    const byStrategy = outcomesByStrategy(sessions, reviews, null)
    expect(byStrategy).toContainEqual({ key: 'consultative', confirmed: 5, total: 5, smallSample: false })
  })

  it('respects the 7-day range toggle', () => {
    const oldSession = session({
      id: 'old',
      session_purpose: 'prospect_conversation',
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    })
    const recentSession = session({
      id: 'recent',
      session_purpose: 'prospect_conversation',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    })
    const reviews = [
      review({ session_id: 'old', outcome_confirmed: 'meeting' }),
      review({ session_id: 'recent', outcome_confirmed: 'meeting' }),
    ]
    expect(totalConfirmedProspects([oldSession, recentSession], reviews, 7)).toBe(1)
    expect(totalConfirmedProspects([oldSession, recentSession], reviews, null)).toBe(2)
  })
})

describe('range parsing', () => {
  it('parses known range values', () => {
    expect(parseRange('7')).toBe(7)
    expect(parseRange('30')).toBe(30)
    expect(parseRange('all')).toBeNull()
    expect(parseRange('')).toBeNull()
  })
})
