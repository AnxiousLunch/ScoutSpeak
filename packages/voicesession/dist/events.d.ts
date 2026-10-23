import type { SessionStatus } from './types.js';
export type VoiceEvent = {
    type: 'partial_transcript';
    text: string;
} | {
    type: 'final_transcript';
    text: string;
    speaker: 'agent' | 'human';
} | {
    type: 'turn';
    speaker: 'agent' | 'human';
    text: string;
} | {
    type: 'status';
    status: SessionStatus;
} | {
    type: 'error';
    error: string;
};
export declare function partialTranscript(text: string): VoiceEvent;
export declare function finalTranscript(text: string, speaker: 'agent' | 'human'): VoiceEvent;
export declare function turnEvent(speaker: 'agent' | 'human', text: string): VoiceEvent;
export declare function statusEvent(status: SessionStatus): VoiceEvent;
export declare function errorEvent(error: string): VoiceEvent;
//# sourceMappingURL=events.d.ts.map