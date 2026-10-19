import type {
  VoiceSessionAdapter,
  VoiceSession,
  ParticipantInvite,
  VoiceEvent,
} from './types'

/** Stub for a provider-backed managed WebRTC/voice room. */
export const managedRoomAdapter: VoiceSessionAdapter = {
  async createSession(): Promise<VoiceSession> {
    throw new Error('not implemented')
  },

  async createParticipantInvite(): Promise<ParticipantInvite> {
    throw new Error('not implemented')
  },

  async joinSession(): Promise<VoiceSession> {
    throw new Error('not implemented')
  },

  async endSession(): Promise<VoiceSession> {
    throw new Error('not implemented')
  },

  async getSessionStatus(): Promise<VoiceSession> {
    throw new Error('not implemented')
  },

  async *eventStream(): AsyncIterable<VoiceEvent> {
    throw new Error('not implemented')
  },
}

// TODO: implement provider-backed managed room behind this adapter.
