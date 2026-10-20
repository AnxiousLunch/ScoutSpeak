import type { StrategyConfig } from './types'

export const conciseStrategy: StrategyConfig = {
  key: 'concise',
  version: 1,
  label: 'Concise qualifier',
  goal:
    'Quickly qualify interest and fit without wasting the prospect’s time.',
  tone: 'Direct, respectful, and efficient.',
  priority_questions: [
    'Is [problem area] something your team is actively trying to fix right now?',
    'Who else would need to be involved in a decision like this?',
    'What would make a solution a clear win for you?',
  ],
  behaviours: [
    'Use at most two sentences per turn.',
    'Open with a one-sentence intro, then ask exactly one qualifying question.',
    'Do not repeat information the prospect has already shared.',
    'Once the prospect answers, move immediately to the next question or close.',
  ],
  end_conditions: [
    { id: 'qualified', description: 'The prospect confirms active interest and a clear next step.' },
    { id: 'not_now', description: 'The prospect says they are not interested or timing is wrong.' },
    { id: 'max_turns', description: 'The conversation reaches the maximum number of turns.' },
    { id: 'info_exchanged', description: 'Enough information is exchanged to route the lead correctly.' },
  ],
  max_turns: 6,
}
