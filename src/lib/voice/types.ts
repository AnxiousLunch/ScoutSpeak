export type VoiceSessionStatus =
  | 'created'
  | 'waiting_for_participant'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type VoiceEvent =
  | { type: 'transcript.partial'; text: string }
  | { type: 'transcript.final'; text: string; speaker: 'agent' | 'human' }
  | { type: 'turn'; speaker: 'agent' | 'human'; text: string }
  | { type: 'status'; status: VoiceSessionStatus }
  | { type: 'error'; error: string }

export interface VoiceSession {
  id: string
  status: VoiceSessionStatus
}

export interface ParticipantInvite {
  sessionId: string
  token: string
  expiresAt: Date
}

export interface VoiceSessionAdapter {
  createSession(purpose: 'rehearsal' | 'prospect_conversation'): Promise<VoiceSession>

  createParticipantInvite(sessionId: string): Promise<ParticipantInvite>

  joinSession(sessionId: string, token: string): Promise<VoiceSession>

  endSession(sessionId: string): Promise<VoiceSession>

  getSessionStatus(sessionId: string): Promise<VoiceSession>

  /** Normalised event stream. Consumers subscribe to handle UI and persistence. */
  eventStream(sessionId: string): AsyncIterable<VoiceEvent>
}
