import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/utils/supabase/server'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/sessions/session-1/consent', {
    method: 'POST',
  })
}

function mockClient(sessionStatus: string | null, updateError: { message: string } | null = null) {
  const updateMock = vi.fn().mockResolvedValue({ error: updateError })
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table !== 'conversation_sessions') {
      return { select: vi.fn() }
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: sessionStatus
                ? { id: 'session-1', session_status: sessionStatus, owner_id: 'user-1' }
                : null,
              error: sessionStatus ? null : { message: 'not found' },
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: updateMock,
        }),
      }),
    }
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' } }),
      },
    },
    from: fromMock,
  }
}

describe('POST /api/sessions/[sessionId]/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records consent while the session is created', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient('created') as unknown as ReturnType<typeof createClient>)

    const response = await POST(makeRequest(), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.participant_consent_at).toBeDefined()
  })

  it('rejects consent after the session has started', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient('active') as unknown as ReturnType<typeof createClient>)

    const response = await POST(makeRequest(), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Consent can only be recorded before the session starts.')
  })

  it('returns 404 when the session is not found', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient(null) as unknown as ReturnType<typeof createClient>)

    const response = await POST(makeRequest(), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('This session was not found.')
  })
})
