import type { SessionStatus } from './types'

export type VoiceEvent =
  | { type: 'partial_transcript'; text: string }
  | { type: 'final_transcript'; text: string; speaker: 'agent' | 'human' }
  | { type: 'turn'; speaker: 'agent' | 'human'; text: string }
  | { type: 'status'; status: SessionStatus }
  | { type: 'error'; error: string }

export function partialTranscript(text: string): VoiceEvent {
  return { type: 'partial_transcript', text }
}

export function finalTranscript(text: string, speaker: 'agent' | 'human'): VoiceEvent {
  return { type: 'final_transcript', text, speaker }
}

export function turnEvent(speaker: 'agent' | 'human', text: string): VoiceEvent {
  return { type: 'turn', speaker, text }
}

export function statusEvent(status: SessionStatus): VoiceEvent {
  return { type: 'status', status }
}

export function errorEvent(error: string): VoiceEvent {
  return { type: 'error', error }
}
