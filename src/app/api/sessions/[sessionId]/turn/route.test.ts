import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  getModelClient: vi.fn(),
}))

vi.mock('voicesession', () => ({
  transition: vi.fn((from: string, to: string) => ({ status: to, error: undefined })),
}))

import { createClient } from '@/utils/supabase/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sessions/session-1/turn', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/sessions/[sessionId]/turn consent gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 409 consent_required when participant_consent_at is null', async () => {
    const mockedClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' } }),
        },
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'session-1',
                  owner_id: 'user-1',
                  session_status: 'created',
                  session_purpose: 'rehearsal',
                  participant_consent_at: null,
                },
                error: null,
              }),
            })),
          })),
        })),
      })),
    }
    vi.mocked(createClient).mockReturnValue(mockedClient as unknown as ReturnType<typeof createClient>)

    const response = await POST(makeRequest({ action: 'start' }), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('consent_required')
  })
})
