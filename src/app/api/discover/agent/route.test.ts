import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const { search } = vi.hoisted(() => ({ search: vi.fn().mockResolvedValue([]) }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai', () => ({ getModelClient: vi.fn() }))
vi.mock('@/lib/discovery', () => ({
  getDiscoveryProvider: vi.fn(() => ({
    name: 'openstreetmap',
    attribution: '© OpenStreetMap contributors',
    search,
  })),
}))

import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/discover/agent', { method: 'POST', body: JSON.stringify(body) })
}

function client(includeAccounting = true) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal2' } }) },
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
          eq: vi.fn(() => table === 'campaigns' ? ({
          eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: includeAccounting ? 'Local accountants' : 'Local businesses', objective: includeAccounting ? 'Find accounting firms' : '' } }) })),
        }) : ({
          order: vi.fn(() => ({ limit: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { business_name: 'Scout', services: includeAccounting ? 'Accounting software' : 'B2B services' } }) })) })),
        })),
      })),
    })),
  }
}

describe('POST /api/discover/agent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the model plan as a tool input for the free discovery provider', async () => {
    vi.mocked(createClient).mockReturnValue(client() as never)
    vi.mocked(getModelClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({ category: 'accounting' }),
    } as never)
    const response = await POST(request({ campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', location: 'Karachi', limit: 4 }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.category).toBe('accounting')
    expect(search).toHaveBeenCalledWith({ keyword: 'accounting', location: 'Karachi', limit: 4 })
  })

  it('falls back to the supplied business type when the model is rate-limited', async () => {
    vi.mocked(createClient).mockReturnValue(client() as never)
    vi.mocked(getModelClient).mockReturnValue({
      generateJSON: vi.fn().mockRejectedValue(Object.assign(new Error('rate limited'), { code: 'rate_limit' })),
    } as never)
    search.mockResolvedValue([])

    const response = await POST(request({
      campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      keyword: 'accounting firms',
      location: 'Karachi',
      limit: 4,
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.agentFallback).toBe(true)
    expect(search).toHaveBeenCalledWith({ keyword: 'accounting', location: 'Karachi', limit: 4 })
  })

  it('returns a JSON rate-limit error when no supported fallback category is available', async () => {
    vi.mocked(createClient).mockReturnValue(client(false) as never)
    vi.mocked(getModelClient).mockReturnValue({
      generateJSON: vi.fn().mockRejectedValue(Object.assign(new Error('rate limited'), { code: 'rate_limit' })),
    } as never)

    const response = await POST(request({
      campaignId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      location: 'Karachi',
    }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.message).toBe('rate limited')
    expect(body.recoverable).toBe(true)
    expect(search).not.toHaveBeenCalled()
  })
})
