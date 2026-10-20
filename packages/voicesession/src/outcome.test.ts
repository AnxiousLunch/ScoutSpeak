import { describe, expect, it } from 'vitest'
import { extractOutcome, toStoredReview } from './outcome'
import { createFakeModel } from './test-utils'
import type { StoredMessage } from './types'

function message(seq: number, role: 'agent' | 'human', text: string): StoredMessage {
  return {
    id: `msg-${seq}`,
    session_id: 'session-1',
    sequence_number: seq,
    speaker_role: role,
    message_text: text,
    created_at: new Date().toISOString(),
  }
}

const validReview = {
  summary: 'Good conversation.',
  outcome_suggested: 'follow_up' as const,
  objection_tags: ['budget'],
  next_step: 'Schedule a demo.',
  quality_notes: {
    objection_handling: 'Addressed budget well.',
    missed_opportunities: 'Did not ask timeline.',
  },
  excerpts: [{ point: 'Budget concern', message_seq: [2] }],
}

describe('extractOutcome', () => {
  it('returns valid review', async () => {
    const model = createFakeModel({ jsonReplies: [validReview] })
    const messages = [message(1, 'agent', 'Hi'), message(2, 'human', 'Too expensive')]

    const { review, error } = await extractOutcome({ model, messages })

    expect(error).toBeUndefined()
    expect(review).toEqual(validReview)
  })

  it('rejects and repairs invalid message_seq', async () => {
    const badReview = {
      ...validReview,
      excerpts: [{ point: 'Bad seq', message_seq: [99] }],
    }
    const fixedReview = {
      ...validReview,
      excerpts: [{ point: 'Fixed seq', message_seq: [2] }],
    }
    const model = createFakeModel({ jsonReplies: [badReview, fixedReview] })
    const messages = [message(1, 'agent', 'Hi'), message(2, 'human', 'Too expensive')]

    const { review, error } = await extractOutcome({ model, messages })

    expect(error).toBeUndefined()
    expect(review).toEqual(fixedReview)
  })

  it('returns error and saves nothing if still invalid', async () => {
    const badReview = {
      ...validReview,
      excerpts: [{ point: 'Bad seq', message_seq: [99] }],
    }
    const model = createFakeModel({ jsonReplies: [badReview, badReview] })
    const messages = [message(1, 'agent', 'Hi'), message(2, 'human', 'Too expensive')]

    const { review, error } = await extractOutcome({ model, messages })

    expect(review).toBeNull()
    expect(error).toBeDefined()
  })
})

describe('toStoredReview', () => {
  it('maps review to stored review shape', () => {
    const stored = toStoredReview('session-1', validReview)
    expect(stored.session_id).toBe('session-1')
    expect(stored.outcome_suggested).toBe('follow_up')
    expect(stored.excerpts).toEqual([{ point: 'Budget concern', message_seq: [2] }])
  })
})
