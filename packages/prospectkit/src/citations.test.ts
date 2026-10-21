import { describe, it, expect } from 'vitest'
import { makeEnrichmentSchema } from './citations.js'

const base = {
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

describe('makeEnrichmentSchema', () => {
  it('accepts only allowed tags', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    expect(schema.safeParse(base).success).toBe(true)
  })

  it('rejects a foreign tag in summary', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    const bad = { ...base, summary: { text: 'x', evidence: ['E9'] } }
    const parsed = schema.safeParse(bad)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes('E9'))).toBe(true)
    }
  })

  it('rejects a foreign tag in observed_signal', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    const bad = { ...base, observed_signal: { text: 'x', evidence: ['E99'] } }
    const parsed = schema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('rejects a foreign tag in inferred_need', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    const bad = {
      ...base,
      inferred_need: { text: 'x', is_inference: true, evidence: ['E0'] },
    }
    const parsed = schema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('rejects observed_signal with zero citations', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    const bad = { ...base, observed_signal: { text: 'x', evidence: [] } }
    const parsed = schema.safeParse(bad)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(
        parsed.error.issues.some(
          (i) => i.path.join('.') === 'observed_signal.evidence' && i.message.includes('observed_signal')
        )
      ).toBe(true)
    }
  })

  it('allows null inferred_need', () => {
    const schema = makeEnrichmentSchema(new Set(['E1', 'E2', 'E3']))
    const noNeed = { ...base, inferred_need: null }
    expect(schema.safeParse(noNeed).success).toBe(true)
  })

  it('respects a custom allowed tag set', () => {
    const schema = makeEnrichmentSchema(new Set(['P1']))
    const custom = {
      ...base,
      summary: { text: 'x', evidence: ['P1'] },
      observed_signal: { text: 'y', evidence: ['P1'] },
      inferred_need: null,
    }
    expect(schema.safeParse(custom).success).toBe(true)
  })
})
