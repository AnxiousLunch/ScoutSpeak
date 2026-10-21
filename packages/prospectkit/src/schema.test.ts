import { describe, it, expect } from 'vitest'
import { enrichmentResultSchema } from './schema.js'

const validResult = {
  summary: { text: 'Acme builds cloud accounting tools.', evidence: ['E1'] },
  observed_signal: { text: 'They mention scaling support.', evidence: ['E1', 'E2'] },
  inferred_need: { text: 'They may need onboarding help.', is_inference: true, evidence: ['E3'] },
  opener: 'What prompted your recent support expansion?',
  missing_fields: ['pricing'],
  violated_constraints: [1],
  ratings: {
    offer_match: 4,
    evidence_strength: 4,
    constraint_fit: 5,
    stated_need: 3,
  },
  rating_reasons: { offer_match: 'Services align well.' },
}

describe('enrichmentResultSchema', () => {
  it('accepts a valid result with E1-E3 tags', () => {
    const parsed = enrichmentResultSchema.safeParse(validResult)
    expect(parsed.success).toBe(true)
  })

  it('rejects evidence tags outside E1-E3', () => {
    const bad = {
      ...validResult,
      summary: { text: 'Bad tag.', evidence: ['E4'] },
    }
    const parsed = enrichmentResultSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('requires at least one evidence tag', () => {
    const bad = {
      ...validResult,
      observed_signal: { text: 'No evidence.', evidence: [] },
    }
    const parsed = enrichmentResultSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('rejects an opener over 30 words', () => {
    const bad = {
      ...validResult,
      opener: 'a '.repeat(31).trim() + '?',
    }
    const parsed = enrichmentResultSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('accepts null inferred_need', () => {
    const noNeed = { ...validResult, inferred_need: null }
    const parsed = enrichmentResultSchema.safeParse(noNeed)
    expect(parsed.success).toBe(true)
  })

  it('accepts null ratings', () => {
    const partial = {
      ...validResult,
      ratings: { offer_match: 4, evidence_strength: null, constraint_fit: null, stated_need: null },
    }
    const parsed = enrichmentResultSchema.safeParse(partial)
    expect(parsed.success).toBe(true)
  })
})
