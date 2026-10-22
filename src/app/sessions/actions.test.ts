import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateSessionBrief } from './actions'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/utils/supabase/server'

function mockSupabase(status: string | null, updateError: { message: string } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' } }),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'conversation_sessions') return {}
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: status ? { id: 'session-1', session_status: status } : null,
                error: status ? null : { message: 'not found' },
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
          }),
        }),
      }
    }),
  }
}

const validBrief = {
  goal: 'Qualify interest.',
  permitted_claims: [
    { claim: 'We provide AI onboarding.', source: 'provider_profile' as const, source_id: 'services' },
  ],
  priority_questions: ['What is the hardest part of onboarding?'],
  end_conditions: ['Book a call.'],
}

describe('updateSessionBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects brief edits after the session has started', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase('waiting_for_participant') as never)
    const result = await updateSessionBrief('session-1', validBrief)
    expect(result.success).toBe(false)
    expect(result.error).toContain('brief can only be edited before the session starts')
  })

  it('saves the brief while the session is still created', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase('created') as never)
    const result = await updateSessionBrief('session-1', validBrief)
    expect(result.success).toBe(true)
  })

  it('returns 404-like error when the session is missing', async () => {
    vi.mocked(createClient).mockReturnValue(mockSupabase(null) as never)
    const result = await updateSessionBrief('session-1', validBrief)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Session not found')
  })
})
