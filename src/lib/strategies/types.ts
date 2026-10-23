export interface StrategyEndCondition {
  id: string
  description: string
}

export interface StrategyConfig {
  key: string
  version: number
  label: string
  goal: string
  tone: string
  priority_questions: readonly string[]
  behaviours: readonly string[]
  end_conditions: readonly StrategyEndCondition[]
  max_turns: number
}
