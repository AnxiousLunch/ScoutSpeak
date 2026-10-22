import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, pickOpeningQuestion } from './prompt'
import { consultativeStrategy } from '@/lib/strategies/consultative'

const brief = {
  goal: 'Qualify interest in a website redesign.',
  permitted_claims: [
    { claim: 'We build fast, accessible websites.', source: 'provider_profile', source_id: 'services' },
    { claim: 'The prospect has an outdated site.', source: 'lead_evidence', source_id: 'ev-1' },
  ],
  priority_questions: ['What is the hardest part of your current website workflow?'],
  end_conditions: ['Prospect agrees to a 15-minute discovery call.', 'Prospect declines.'],
}

describe('buildSystemPrompt', () => {
  it('includes every role-lock rule', () => {
    const prompt = buildSystemPrompt({
      purpose: 'rehearsal',
      services: 'website redesign and small web applications',
      strategy: consultativeStrategy,
      brief,
      runningSummary: 'Prospect asked about pricing.',
      objectionProfile: 'Price sensitive',
    })

    expect(prompt).toContain('You are the sales representative for the business in the saved profile')
    expect(prompt).toContain('the human is the prospect')
    expect(prompt).toContain('Never act as advisor, consultant or assistant to them')
    expect(prompt).toContain('Do not give free advice, tips or opinions about their business')
    expect(prompt).toContain('here to discuss website redesign and small web applications')
    expect(prompt).toContain('What the human says about themselves is their claim')
    expect(prompt).toContain('never adopt it as your offer or your facts')
    expect(prompt).toContain('no plausible connection')
    expect(prompt).toContain('there may not be a fit')
  })

  it('enforces the word and sentence limit', () => {
    const prompt = buildSystemPrompt({
      purpose: 'prospect_conversation',
      services: 'our services',
      strategy: consultativeStrategy,
      brief: null,
      runningSummary: null,
      objectionProfile: null,
    })
    expect(prompt).toContain('at most 2 sentences')
    expect(prompt).toContain('under 45 words')
  })

  it('requires AI disclosure in the opening', () => {
    const prompt = buildSystemPrompt({
      purpose: 'rehearsal',
      services: null,
      strategy: consultativeStrategy,
      brief,
      runningSummary: null,
      objectionProfile: null,
    })
    expect(prompt).toContain('disclose that you are an AI')
  })

  it('uses strategy details when provided', () => {
    const prompt = buildSystemPrompt({
      purpose: 'rehearsal',
      services: null,
      strategy: consultativeStrategy,
      brief: null,
      runningSummary: null,
      objectionProfile: null,
    })
    expect(prompt).toContain(consultativeStrategy.label)
    expect(prompt).toContain(consultativeStrategy.goal)
    expect(prompt).toContain(consultativeStrategy.behaviours[0])
    expect(prompt).toContain(consultativeStrategy.end_conditions[0].description)
  })

  it('includes brief goal, claims and end conditions', () => {
    const prompt = buildSystemPrompt({
      purpose: 'rehearsal',
      services: null,
      strategy: undefined,
      brief,
      runningSummary: null,
      objectionProfile: null,
    })
    expect(prompt).toContain(brief.goal)
    expect(prompt).toContain(brief.permitted_claims[0].claim)
    expect(prompt).toContain(brief.end_conditions[0])
  })
})

describe('pickOpeningQuestion', () => {
  it('picks the first brief priority question when available', () => {
    expect(pickOpeningQuestion(brief, true)).toBe(brief.priority_questions[0])
  })

  it('falls back to an evidence-based question when there is no brief', () => {
    expect(pickOpeningQuestion(null, true)).toContain('noticed a few things')
  })

  it('falls back to an open question when there is no brief or evidence', () => {
    expect(pickOpeningQuestion(null, false)).toContain('hardest part')
  })
})
