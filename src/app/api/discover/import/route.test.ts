import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/utils/supabase/server'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/discover/import', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function mockClient({ campaignStatus = 'found', existingKeys = [] as string[], insertError = null as Error | null, aal = 'aal2' } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: aal } }) },
    },
    from: vi.fn((table: string) => {
      if (table === 'campaigns') {
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
      }
      if (table === 'leads') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: existingKeys.map((k) => ({ dedup_key: k })), error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: insertError })),
        }
      }
      return {}
    }),
  }
}

describe('POST /api/discover/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports new records and skips duplicates', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient({ existingKeys: ['test:p1'] }) as never)

    const res = await POST(makeRequest({
      campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      results: [
        { providerId: 'p1', name: 'Existing', category: 'A', address: null, latitude: null, longitude: null, websiteUrl: null, phone: null, source: 'test', attribution: {} },
        { providerId: 'p2', name: 'New', category: 'A', address: null, latitude: null, longitude: null, websiteUrl: 'https://new.example', phone: null, source: 'test', attribution: {} },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ found: 2, imported: 1, skipped: 1, rejected: 0 })
  })

  it('rejects a campaign owned by another user', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient({ campaignStatus: 'not_found' }) as never)

    const res = await POST(makeRequest({
      campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      results: [{ providerId: 'p1', name: 'Example', category: null, address: null, latitude: null, longitude: null, websiteUrl: null, phone: null, source: 'test', attribution: {} }],
    }))
    expect(res.status).toBe(404)
  })

  it('rejects empty imports', async () => {
    vi.mocked(createClient).mockReturnValue(mockClient() as never)

    const res = await POST(makeRequest({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', results: [] }))
    expect(res.status).toBe(400)
  })
})
