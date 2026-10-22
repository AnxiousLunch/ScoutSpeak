import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai', () => ({ getModelClient: vi.fn() }))
vi.mock('@/lib/net/safe-fetch', () => ({ safeFetchPage: vi.fn() }))
vi.mock('@/lib/net/extract', () => ({ extractPage: vi.fn((html: string) => ({ title: 'Title', text: html })) }))
vi.mock('crypto', () => ({ randomUUID: vi.fn(() => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') }))

import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { safeFetchPage } from '@/lib/net/safe-fetch'

function makeRequest(leadId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/leads/${leadId}/enrich`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads/[id]/enrich citation identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists generated evidence IDs and maps citations to those exact rows', async () => {
    const evidenceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const insertedRows: unknown[] = []
    let updatePayload: Record<string, unknown> | null = null

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'leads') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'lead-1',
                      owner_id: 'user-1',
                      company_name: 'Acme',
                      website_url: 'https://example.com',
                      enriched_at: null,
                      score_breakdown: null,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              updatePayload = payload
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
              }
            }),
          }
        }
        if (table === 'business_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { owner_id: 'user-1', version: 1, business_name: 'Us', services: 'Web', value_proposition: '', constraints: '' },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'lead_evidence') {
          return {
            insert: vi.fn((rows: unknown[]) => {
              for (const row of rows as { id?: string }[]) {
                if (row.id) insertedRows.push(row)
              }
              return Promise.resolve({ error: null })
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(createClient).mockReturnValue(client as never)
    vi.mocked(safeFetchPage).mockResolvedValue({ finalUrl: 'https://example.com', status: 200, contentType: 'text/html', text: '<html>body</html>', truncated: false })
    vi.mocked(getModelClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        summary: { text: 'Summary', evidence: ['E1'] },
        observed_signal: { text: 'Signal', evidence: ['E1'] },
        inferred_need: { text: 'Need', is_inference: true, evidence: ['E1'] },
        opener: 'Hello?',
        missing_fields: [],
        violated_constraints: [],
        ratings: { offer_match: 3, evidence_strength: 3, constraint_fit: 3, stated_need: 3 },
        rating_reasons: {},
      }),
    } as never)

    const res = await POST(makeRequest('lead-1', { force: true }), { params: { id: 'lead-1' } })
    expect(res.status).toBe(200)

    expect(insertedRows).toHaveLength(1)
    expect((insertedRows[0] as { id?: string }).id).toBe(evidenceId)

    expect(updatePayload).not.toBeNull()
    const citations = updatePayload!.citations as Record<string, string>
    expect(citations.E1).toBe(evidenceId)
  })
})
