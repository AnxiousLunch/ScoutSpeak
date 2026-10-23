import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
const { providerSearch } = vi.hoisted(() => ({ providerSearch: vi.fn() }))
vi.mock('@/lib/discovery', () => ({
  getDiscoveryProvider: vi.fn(() => ({
    name: 'test-provider',
    attribution: 'Test attribution',
    search: providerSearch,
  })),
}))

import { createClient } from '@/utils/supabase/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/discover', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockClient(campaignStatus: 'found' | 'not_found' = 'found', aal = 'aal2') {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: aal } }) },
      },
      from: vi.fn((table: string) => {
        if (table !== 'campaigns') return { select: vi.fn() }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue(
                  campaignStatus === 'found'
                    ? { data: { id: 'campaign-1' }, error: null }
                    : { data: null, error: { message: 'not found' } }
                ),
              })),
            })),
          })),
        }
      }),
    }
  }

  it('requires authentication', async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
      },
      from: vi.fn(),
    } as never)

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi' }))
    expect(res.status).toBe(401)
  })

  it('requires AAL2', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient('found', 'aal1') as never)

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid input', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient() as never)

    const res = await POST(makeRequest({ campaignId: 'not-a-uuid', keyword: '', location: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects a campaign owned by another user', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient('not_found') as never)

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi' }))
    expect(res.status).toBe(404)
  })

  it('returns discovery results for a valid request', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient() as never)
    providerSearch.mockResolvedValue([
      { providerId: 'p1', name: 'A', category: 'Accountant', address: null, latitude: null, longitude: null, websiteUrl: null, phone: null, source: 'test', attribution: {} },
    ])

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.results[0].name).toBe('A')
  })

  it('caps the result limit', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient() as never)
    providerSearch.mockResolvedValue([])

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi', limit: 100 }))
    expect(res.status).toBe(400)
  })

  it('returns a recoverable error when the provider fails', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient() as never)
    providerSearch.mockRejectedValue(new Error('provider down'))

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', keyword: 'accounting', location: 'Karachi' }))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.recoverable).toBe(true)
  })
})
