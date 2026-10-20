import { describe, it, expect } from 'vitest'
import { consultativeStrategy } from './consultative'
import { conciseStrategy } from './concise'
import { objectionHandlingStrategy } from './objection-handling'
import { getStrategy, strategyByKey, strategies } from './index'
import type { StrategyConfig } from './types'

const all: StrategyConfig[] = [consultativeStrategy, conciseStrategy, objectionHandlingStrategy]

describe('strategy shapes', () => {
  it.each(all)('$key has the required versioned config fields', (strategy) => {
    expect(strategy.key).toBeTruthy()
    expect(strategy.version).toBe(1)
    expect(strategy.label).toBeTruthy()
    expect(strategy.goal).toBeTruthy()
    expect(strategy.tone).toBeTruthy()
    expect(strategy.priority_questions.length).toBeGreaterThan(0)
    expect(strategy.behaviours.length).toBeGreaterThanOrEqual(3)
    expect(strategy.behaviours.length).toBeLessThanOrEqual(4)
    expect(strategy.end_conditions.length).toBeGreaterThan(0)
    expect(strategy.max_turns).toBeGreaterThan(0)
  })

  it('keys are unique', () => {
    const keys = strategies.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('observable differences', () => {
  it('consultative asks discovery questions before mentioning the offer', () => {
    const behaviour = consultativeStrategy.behaviours.join(' ').toLowerCase()
    expect(behaviour).toContain('discovery question')
    expect(behaviour).toContain('before mentioning the offer')
  })

  it('concise limits turns and sentences', () => {
    expect(conciseStrategy.max_turns).toBe(6)
    const behaviour = conciseStrategy.behaviours.join(' ').toLowerCase()
    expect(behaviour).toContain('two sentences')
    expect(behaviour).toContain('one qualifying question')
  })

  it('objection-handling acknowledges concerns and uses supported information', () => {
    const behaviour = objectionHandlingStrategy.behaviours.join(' ').toLowerCase()
    expect(behaviour).toContain('acknowledge')
    expect(behaviour).toContain('supported')
    expect(behaviour).toContain('low-pressure next step')
  })
})

describe('getStrategy', () => {
  it('returns the matching strategy for each known key', () => {
    expect(getStrategy('consultative')).toBe(consultativeStrategy)
    expect(getStrategy('concise')).toBe(conciseStrategy)
    expect(getStrategy('objection-handling')).toBe(objectionHandlingStrategy)
  })

  it('returns undefined for unknown keys', () => {
    expect(getStrategy('aggressive')).toBeUndefined()
    expect(getStrategy('')).toBeUndefined()
  })

  it('matches the keyed object exactly', () => {
    for (const [key, strategy] of Object.entries(strategyByKey)) {
      expect(getStrategy(key)).toBe(strategy)
    }
  })
})
