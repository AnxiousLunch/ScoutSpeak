import { describe, it, expect } from 'vitest'
import { getManagedRoomAdapter, managedRoomAdapter } from './managed-room'

describe('getManagedRoomAdapter', () => {
  it('returns the stub adapter by default', () => {
    expect(getManagedRoomAdapter()).toBe(managedRoomAdapter)
  })

  it('throws a clear configuration error from every stub method', async () => {
    await expect(managedRoomAdapter.createSession('rehearsal')).rejects.toThrow('VOICE_PROVIDER')
    await expect(managedRoomAdapter.createParticipantInvite('s1')).rejects.toThrow('VOICE_PROVIDER')
    await expect(managedRoomAdapter.joinSession('s1', 't1')).rejects.toThrow('VOICE_PROVIDER')
    await expect(managedRoomAdapter.endSession('s1')).rejects.toThrow('VOICE_PROVIDER')
    await expect(managedRoomAdapter.getSessionStatus('s1')).rejects.toThrow('VOICE_PROVIDER')
  })
})
