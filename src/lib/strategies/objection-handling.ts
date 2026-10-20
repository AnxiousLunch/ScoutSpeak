import type { StrategyConfig } from './types'

export const objectionHandlingStrategy: StrategyConfig = {
  key: 'objection-handling',
  version: 1,
  label: 'Objection handling',
  goal:
    'Hear the prospect’s concern, respond only with supported information, and keep the conversation moving forward.',
  tone: 'Empathetic, grounded, and reassuring.',
  priority_questions: [
    'What would need to be true for this to feel like an easy yes?',
    'How does your current solution handle [objection area]?',
    'What is the most important factor in a decision like this for you?',
  ],
  behaviours: [
    'Acknowledge the stated concern before answering.',
    'Answer only with information supported by the business profile or lead evidence.',
    'Offer a low-pressure next step after addressing the concern.',
    'If the concern cannot be resolved, ask a follow-up question to understand priority.',
  ],
  end_conditions: [
    { id: 'concern_addressed', description: 'The prospect accepts the response and agrees to a next step.' },
    { id: 'stall', description: 'The prospect remains uncertain after a supported response.' },
    { id: 'max_turns', description: 'The conversation reaches the maximum number of turns.' },
    { id: 'unresolvable', description: 'The concern contradicts a hard constraint and the lead is disqualified.' },
  ],
  max_turns: 8,
}
