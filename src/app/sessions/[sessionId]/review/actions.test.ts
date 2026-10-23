import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveReview } from './actions'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/utils/supabase/server'

function mockSession(purpose: string) {
  return {
    data: { id: 'session-1', session_purpose: purpose },
    error: null,
  }
}

function mockSupabase(sessionPurpose: string, messages: { sequence_number: number }[]) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' } }),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'conversation_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockSession(sessionPurpose)),
              }),
            }),
          }),
        }
      }
      if (table === 'conversation_messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: messages, error: null }),
            }),
          }),
        }
      }
      if (table === 'session_reviews') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    }),
  }
}

const validInput = {
  sessionId: '00000000-0000-4000-8000-000000000001',
  purpose: 'rehearsal',
  summary: 'Good',
  outcome_suggested: 'follow_up' as const,
  outcome_confirmed: 'follow_up' as const,
  outcome_source: 'user_confirmed' as const,
  objection_tags: [],
  next_step: 'Demo',
  quality_notes: {},
  excerpts: [],
}

describe('saveReview action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks a review written for the wrong purpose', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase('prospect_conversation', []) as never)
    const result = await saveReview(validInput)
    expect(result.success).toBe(false)
    expect((result as { error?: string }).error).toContain('Purpose mismatch')
  })

  it('blocks excerpts that reference missing message sequence numbers', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase('rehearsal', [{ sequence_number: 1 }, { sequence_number: 2 }]) as never)
    const result = await saveReview({
      ...validInput,
      excerpts: [{ point: 'X', message_seq: [99] }],
    })
    expect(result.success).toBe(false)
    expect((result as { error?: string }).error).toContain('supporting excerpt')
  })

  it('saves a valid review', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase('rehearsal', [{ sequence_number: 1 }, { sequence_number: 2 }]) as never)
    const result = await saveReview({
      ...validInput,
      excerpts: [{ point: 'Budget', message_seq: [2] }],
    })
    expect(result.success).toBe(true)
  })
})