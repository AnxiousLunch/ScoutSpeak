import { describe, expect, it } from 'vitest'
import { canTransition, isTerminal, transition } from './status'

describe('status machine', () => {
  it('terminal states are final', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('created')).toBe(false)
    expect(isTerminal('waiting_for_participant')).toBe(false)
    expect(isTerminal('active')).toBe(false)
  })

  it('allows created -> waiting_for_participant', () => {
    expect(canTransition('created', 'waiting_for_participant')).toBe(true)
  })

  it('allows created -> cancelled', () => {
    expect(canTransition('created', 'cancelled')).toBe(true)
  })

  it('allows waiting_for_participant -> active', () => {
    expect(canTransition('waiting_for_participant', 'active')).toBe(true)
  })

  it('allows waiting_for_participant -> cancelled', () => {
    expect(canTransition('waiting_for_participant', 'cancelled')).toBe(true)
  })

  it('allows active -> completed with consent and enough turns', () => {
    expect(
      canTransition('active', 'completed', { humanTurns: 2, consent: true })
    ).toBe(true)
  })

  it('blocks active -> completed without consent', () => {
    expect(
      canTransition('active', 'completed', { humanTurns: 2, consent: false })
    ).toBe(false)
  })

  it('blocks active -> completed with fewer than 2 human turns', () => {
    expect(
      canTransition('active', 'completed', { humanTurns: 1, consent: true })
    ).toBe(false)
  })

  it('allows active -> failed and active -> cancelled', () => {
    expect(canTransition('active', 'failed')).toBe(true)
    expect(canTransition('active', 'cancelled')).toBe(true)
  })

  it('blocks every illegal move', () => {
    const illegal: Array<[string, string]> = [
      ['created', 'active'],
      ['created', 'completed'],
      ['created', 'failed'],
      ['waiting_for_participant', 'completed'],
      ['waiting_for_participant', 'failed'],
      ['waiting_for_participant', 'created'],
      ['active', 'created'],
      ['active', 'waiting_for_participant'],
      ['completed', 'active'],
      ['completed', 'cancelled'],
      ['failed', 'completed'],
      ['cancelled', 'active'],
    ]
    for (const [from, to] of illegal) {
      expect(canTransition(from as never, to as never)).toBe(false)
    }
  })

  it('transition returns error for illegal moves', () => {
    const result = transition('created', 'completed')
    expect(result.status).toBe('created')
    expect(result.error).toContain('Illegal transition')
  })

  it('transition succeeds for legal moves', () => {
    const result = transition('created', 'waiting_for_participant')
    expect(result.status).toBe('waiting_for_participant')
    expect(result.error).toBeUndefined()
  })
})
