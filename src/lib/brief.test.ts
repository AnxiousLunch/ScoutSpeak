import { describe, it, expect, vi } from 'vitest'
import { generateBrief, type ProfileFields, type EvidenceItem, type SessionBrief } from './brief'

vi.mock('@/lib/ai', () => ({
  getModelClient: vi.fn(),
}))

import { getModelClient } from '@/lib/ai'

function fakeClient(replies: unknown[]) {
  let call = 0
  return {
    generateJSON: vi.fn(async <T>(): Promise<T> => {
      const next = replies[call++] ?? replies[replies.length - 1]
      return next as T
    }),
    generateText: vi.fn(async () => ''),
  }
}

const profile: ProfileFields = {
  business_name: 'TestCo',
  services: 'AI onboarding',
  value_proposition: 'Faster onboarding',
  target_industry: 'SaaS',
  target_geography: 'North America',
  constraints: 'Must be in North America',
}

const evidence: EvidenceItem[] = [
  { id: 'ev-1', source_url: 'https://acme.example/', page_title: 'Acme', excerpt: 'We build cloud tools.' },
]

const strategy = {
  key: 'consultative',
  version: 1,
  goal: 'Qualify interest',
  tone: 'Curious',
  priority_questions: ['What is the hardest part of onboarding?'],
  behaviours: ['Ask one question at a time'],
  end_conditions: [{ id: 'meeting', description: 'Book a call' }],
}

const baseBrief: SessionBrief = {
  goal: 'Qualify interest in onboarding help.',
  permitted_claims: [
    { claim: 'We provide AI onboarding.', source: 'provider_profile', source_id: 'services' },
    { claim: 'They build cloud tools.', source: 'lead_evidence', source_id: 'ev-1' },
  ],
  priority_questions: ['What is the hardest part of onboarding?'],
  end_conditions: ['Book a call.'],
}

describe('generateBrief claim validation', () => {
  it('accepts a brief whose claims trace to profile fields and evidence ids', async () => {
    vi.mocked(getModelClient).mockReturnValue(fakeClient([baseBrief]) as never)
    const result = await generateBrief({ profile, evidence, objective: 'Qualify', strategy })
    expect(result.brief).toEqual(baseBrief)
    expect(result.error).toBeUndefined()
  })

  it('accepts a brief with no claims when the profile fields are missing', async () => {
    const missingProfile: ProfileFields = {
      business_name: null,
      services: null,
      value_proposition: null,
      target_industry: null,
      target_geography: null,
      constraints: null,
    }
    const briefWithoutClaims = { ...baseBrief, permitted_claims: [] }
    vi.mocked(getModelClient).mockReturnValue(fakeClient([briefWithoutClaims]) as never)
    const result = await generateBrief({ profile: missingProfile, evidence: [], objective: 'Qualify', strategy })
    expect(result.brief).toEqual(briefWithoutClaims)
  })

  it('does not accept a placeholder value as a grounded provider claim', async () => {
    const placeholderProfile = { ...profile, services: 'None provided' }
    const placeholderClaim = {
      ...baseBrief,
      permitted_claims: [{ claim: 'None provided', source: 'provider_profile' as const, source_id: 'services' }],
    }
    vi.mocked(getModelClient).mockReturnValue(fakeClient([placeholderClaim, placeholderClaim]) as never)
    const result = await generateBrief({ profile: placeholderProfile, evidence, objective: 'Qualify', strategy })
    expect(result.brief).toBeNull()
    expect(result.error).toContain('does not trace to a known profile field')
  })

  it('rejects a provider claim that does not trace to a known profile field', async () => {
    const invalid = {
      ...baseBrief,
      permitted_claims: [{ claim: 'X', source: 'provider_profile', source_id: 'made_up' }],
    }
    vi.mocked(getModelClient).mockReturnValue(fakeClient([invalid, invalid]) as never)
    const result = await generateBrief({ profile, evidence, objective: 'Qualify', strategy })
    expect(result.brief).toBeNull()
    expect(result.error).toContain('does not trace to a known profile field')
  })

  it('repairs a claim error when the second attempt is valid', async () => {
    const invalid = {
      ...baseBrief,
      permitted_claims: [{ claim: 'X', source: 'provider_profile', source_id: 'made_up' }],
    }
    vi.mocked(getModelClient).mockReturnValue(fakeClient([invalid, baseBrief]) as never)
    const result = await generateBrief({ profile, evidence, objective: 'Qualify', strategy })
    expect(result.brief).toEqual(baseBrief)
  })

  it('rejects a prospect claim that does not trace to a lead evidence id', async () => {
    const invalid = {
      ...baseBrief,
      permitted_claims: [{ claim: 'X', source: 'lead_evidence', source_id: 'ev-999' }],
    }
    vi.mocked(getModelClient).mockReturnValue(fakeClient([invalid, invalid]) as never)
    const result = await generateBrief({ profile, evidence, objective: 'Qualify', strategy })
    expect(result.brief).toBeNull()
    expect(result.error).toContain('does not trace to a lead evidence id')
  })
})
