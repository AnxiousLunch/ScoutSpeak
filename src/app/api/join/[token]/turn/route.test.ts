import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/sessions/join-context', () => ({
  resolveInvite: vi.fn(),
  isResponse: (value: unknown) => value instanceof Response,
  joinPayload: vi.fn(async () => ({ status: 'active', messages: [], businessName: 'Test' })),
}))

vi.mock('@/lib/sessions/run-turn', () => ({
  runTurn: vi.fn(),
}))

import { resolveInvite } from '@/lib/sessions/join-context'
import { runTurn } from '@/lib/sessions/run-turn'

function makeRequest(token: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/join/${token}/turn`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/join/[token]/turn consent gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 409 consent_required without calling runTurn when consent is missing', async () => {
    vi.mocked(resolveInvite).mockResolvedValue({
      client: {} as never,
      session: { id: 'session-1', participant_consent_at: null, session_status: 'active' } as never,
    })
    vi.mocked(runTurn).mockResolvedValue({ ok: true } as never)

    const response = await POST(makeRequest('token-1', { text: 'hello' }), { params: { token: 'token-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('consent_required')
    expect(runTurn).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid body', async () => {
    vi.mocked(resolveInvite).mockResolvedValue({
      client: {} as never,
      session: { id: 'session-1', participant_consent_at: '2026-01-01T00:00:00Z', session_status: 'active' } as never,
    })

    const response = await POST(makeRequest('token-1', { text: '' }), { params: { token: 'token-1' } })

    expect(response.status).toBe(400)
    expect(runTurn).not.toHaveBeenCalled()
  })
})
