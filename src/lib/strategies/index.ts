import type { StrategyConfig } from './types'
import { consultativeStrategy } from './consultative'
import { conciseStrategy } from './concise'
import { objectionHandlingStrategy } from './objection-handling'

export * from './types'

export const strategyByKey = {
  consultative: consultativeStrategy,
  concise: conciseStrategy,
  'objection-handling': objectionHandlingStrategy,
} as const

export type StrategyKey = keyof typeof strategyByKey

export function getStrategy(key: string): StrategyConfig | undefined {
  return strategyByKey[key as StrategyKey]
}

export const strategies = Object.values(strategyByKey)
