import { describe, it, expect, vi } from 'vitest'
import { endSession, expireStaleSession, formatEndReason, type DbClient, type SessionRow } from './session-ops'

function mockClient(scenarios: {
  lastMessage?: { data?: unknown; error?: unknown }
  updateError?: unknown
}): DbClient {
  return {
    from: vi.fn((table: string) => {
      if (table === 'conversation_messages') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve(scenarios.lastMessage ?? { data: null, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'conversation_sessions') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: scenarios.updateError ?? null }),
          }),
        }
      }
      return {}
    }),
  } as unknown as DbClient
}

function mockClientForEnd(
  messages: { speaker_role: string }[],
  updateError: unknown = null
): DbClient {
  return {
    from: vi.fn((table: string) => {
      if (table === 'conversation_messages') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: messages, error: null }),
          }),
        }
      }
      if (table === 'conversation_sessions') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: updateError }),
          }),
        }
      }
      return {}
    }),
  } as unknown as DbClient
}

describe('formatEndReason', () => {
  it('returns a human label for known reasons', () => {
    expect(formatEndReason('invite_expired')).toBe('Invite expired')
    expect(formatEndReason('audio_lost')).toBe('Audio lost')
    expect(formatEndReason('abandoned')).toBe('Abandoned')
  })

  it('falls back to the raw reason with underscores replaced', () => {
    expect(formatEndReason('some_reason')).toBe('some reason')
  })

  it('returns an empty string for missing reasons', () => {
    expect(formatEndReason(null)).toBe('')
    expect(formatEndReason(undefined)).toBe('')
  })
})

describe('expireStaleSession', () => {
  it('cancels an active session whose last message is older than 10 minutes', async () => {
    const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    const client = mockClient({ lastMessage: { data: { created_at: stale }, error: null } })
    const result = await expireStaleSession(client, { id: 's1', session_status: 'active' })
    expect(result).toEqual({ ok: true, status: 'cancelled' })
  })

  it('leaves an active session unchanged when the last message is recent', async () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const client = mockClient({ lastMessage: { data: { created_at: recent }, error: null } })
    const result = await expireStaleSession(client, { id: 's1', session_status: 'active' })
    expect(result).toEqual({ ok: true, status: 'active' })
  })

  it('does nothing for non-active sessions', async () => {
    const client = mockClient({})
    const result = await expireStaleSession(client, { id: 's1', session_status: 'completed' })
    expect(result).toEqual({ ok: true, status: 'completed' })
  })

  it('returns a failure when the update fails', async () => {
    const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    const client = mockClient({ lastMessage: { data: { created_at: stale }, error: null }, updateError: new Error('db down') })
    const result = await expireStaleSession(client, { id: 's1', session_status: 'active' })
    expect(result).toEqual({ ok: false, httpStatus: 500, body: { message: 'Could not expire stale session.' } })
  })
})

describe('endSession', () => {
  it('completes when there are at least two human turns and consent', async () => {
    const client = mockClientForEnd([{ speaker_role: 'human' }, { speaker_role: 'human' }])
    const session = { id: 's1', session_status: 'active', participant_consent_at: '2026-01-01T00:00:00Z' } as SessionRow
    const result = await endSession(client, session, 'participant_left')
    expect(result).toEqual({ ok: true, status: 'completed' })
  })

  it('cancels when there are fewer than two human turns', async () => {
    const client = mockClientForEnd([{ speaker_role: 'human' }])
    const session = { id: 's1', session_status: 'active', participant_consent_at: '2026-01-01T00:00:00Z' } as SessionRow
    const result = await endSession(client, session, 'participant_left')
    expect(result).toEqual({ ok: true, status: 'cancelled' })
  })

  it('cancels when consent is missing', async () => {
    const client = mockClientForEnd([{ speaker_role: 'human' }, { speaker_role: 'human' }])
    const session = { id: 's1', session_status: 'active', participant_consent_at: null } as SessionRow
    const result = await endSession(client, session, 'participant_left')
    expect(result).toEqual({ ok: true, status: 'cancelled' })
  })
})
