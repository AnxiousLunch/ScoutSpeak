import { describe, expect, it } from 'vitest'
import { saveReview } from './logger'
import { createFakeStore } from './test-utils'
import type { StoredSession } from './types'

function session(purpose: string): StoredSession {
  return {
    id: 'session-1',
    session_purpose: purpose,
    session_status: 'completed',
  }
}

describe('saveReview', () => {
  it('saves review when purpose matches', async () => {
    const store = createFakeStore(session('rehearsal'))
    const review = await saveReview({
      store,
      sessionId: 'session-1',
      purpose: 'rehearsal',
      review: {
        summary: 'Good',
        outcome_suggested: 'follow_up',
        objection_tags: [],
        next_step: 'Demo',
        quality_notes: { objection_handling: 'ok', missed_opportunities: 'none' },
        excerpts: [],
      },
    })
    expect(review.session_id).toBe('session-1')
    expect(review.summary).toBe('Good')
  })

  it('rejects write when purpose does not match', async () => {
    const store = createFakeStore(session('prospect_conversation'))
    await expect(
      saveReview({
        store,
        sessionId: 'session-1',
        purpose: 'rehearsal',
        review: {
          summary: 'Good',
          outcome_suggested: 'follow_up',
          objection_tags: [],
          next_step: 'Demo',
          quality_notes: { objection_handling: 'ok', missed_opportunities: 'none' },
          excerpts: [],
        },
      })
    ).rejects.toThrow('Purpose mismatch')
  })
})
