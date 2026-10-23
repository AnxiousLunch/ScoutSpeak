import type {
  VoiceSessionAdapter,
  VoiceSession,
  ParticipantInvite,
  VoiceEvent,
} from './types'

function providerConfig(): { provider: string; url?: string; token?: string; apiKey?: string } {
  return {
    provider: process.env.VOICE_PROVIDER?.trim().toLowerCase() || 'stub',
    url: process.env.VOICE_PROVIDER_URL,
    token: process.env.VOICE_PROVIDER_TOKEN,
    apiKey: process.env.VOICE_PROVIDER_API_KEY,
  }
}

function missingProviderError(action: string): Error {
  const cfg = providerConfig()
  return new Error(
    `Voice provider not configured for ${action}. ` +
      `Set VOICE_PROVIDER and the matching credentials; current provider is "${cfg.provider}". ` +
      `Browser speech and typed input remain available without a managed room provider.`
  )
}

/** Default stub adapter used when no managed room provider is configured. */
export const managedRoomAdapter: VoiceSessionAdapter = {
  async createSession(): Promise<VoiceSession> {
    throw missingProviderError('createSession')
  },

  async createParticipantInvite(): Promise<ParticipantInvite> {
    throw missingProviderError('createParticipantInvite')
  },

  async joinSession(): Promise<VoiceSession> {
    throw missingProviderError('joinSession')
  },

  async endSession(): Promise<VoiceSession> {
    throw missingProviderError('endSession')
  },

  async getSessionStatus(): Promise<VoiceSession> {
    throw missingProviderError('getSessionStatus')
  },

  async *eventStream(): AsyncIterable<VoiceEvent> {
    throw missingProviderError('eventStream')
  },
}

/** Returns the configured managed-room adapter. Today this returns the stub; drop in a real provider adapter when credentials are available. */
export function getManagedRoomAdapter(): VoiceSessionAdapter {
  const cfg = providerConfig()
  if (cfg.provider === 'stub' || !cfg.provider) {
    return managedRoomAdapter
  }
  // When a real provider is chosen, construct its adapter here using cfg.url, cfg.token and cfg.apiKey.
  // Browser speech and typed input do not depend on this adapter.
  return managedRoomAdapter
}
