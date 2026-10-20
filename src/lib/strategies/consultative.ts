import type { StrategyConfig } from './types'

export const consultativeStrategy: StrategyConfig = {
  key: 'consultative',
  version: 1,
  label: 'Consultative discovery',
  goal:
    'Understand the prospect’s situation, confirm a real need, and earn permission to explain how the offer fits.',
  tone: 'Curious, patient, and genuinely helpful.',
  priority_questions: [
    'What is the hardest part of [problem area] for your team today?',
    'How are you currently handling [problem area]?',
    'What would change if [problem area] were solved?',
  ],
  behaviours: [
    'Ask at least two discovery questions before mentioning the offer.',
    'Restate the prospect’s stated pain in their own words before proposing value.',
    'Probe budget, authority, and timeline only after the need is confirmed.',
    'Offer a clear, low-pressure next step that matches the prospect’s readiness.',
  ],
  end_conditions: [
    { id: 'need_confirmed', description: 'The prospect confirms a specific business need the offer can address.' },
    { id: 'next_step_agreed', description: 'The prospect agrees to a concrete next step.' },
    { id: 'max_turns', description: 'The conversation reaches the maximum number of turns.' },
    { id: 'unqualified', description: 'The prospect explicitly declines or is disqualified.' },
  ],
  max_turns: 10,
}
