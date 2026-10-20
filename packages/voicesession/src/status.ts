import type { SessionStatus } from './types'

const TERMINAL_STATES: ReadonlySet<SessionStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
])

const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  created: ['waiting_for_participant', 'cancelled'],
  waiting_for_participant: ['active', 'cancelled'],
  active: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
} as const

export function isTerminal(status: SessionStatus): boolean {
  return TERMINAL_STATES.has(status)
}

export interface CompletedRequirements {
  humanTurns: number
  consent: boolean
}

export function canTransition(
  from: SessionStatus,
  to: SessionStatus,
  requirements?: CompletedRequirements
): boolean {
  if (from === to) return true
  if (!VALID_TRANSITIONS[from].includes(to)) return false
  if (to === 'completed') {
    if (!requirements) return false
    return requirements.humanTurns >= 2 && requirements.consent
  }
  return true
}

export interface TransitionResult {
  status: SessionStatus
  error?: string
}

export function transition(
  from: SessionStatus,
  to: SessionStatus,
  requirements?: CompletedRequirements
): TransitionResult {
  if (!canTransition(from, to, requirements)) {
    return {
      status: from,
      error: `Illegal transition from ${from} to ${to}`,
    }
  }
  return { status: to }
}
