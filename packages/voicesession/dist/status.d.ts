import type { SessionStatus } from './types.js';
export declare function isTerminal(status: SessionStatus): boolean;
export interface CompletedRequirements {
    humanTurns: number;
    consent: boolean;
}
export declare function canTransition(from: SessionStatus, to: SessionStatus, requirements?: CompletedRequirements): boolean;
export interface TransitionResult {
    status: SessionStatus;
    error?: string;
}
export declare function transition(from: SessionStatus, to: SessionStatus, requirements?: CompletedRequirements): TransitionResult;
//# sourceMappingURL=status.d.ts.map