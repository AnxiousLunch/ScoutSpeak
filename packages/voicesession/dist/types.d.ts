import type { ZodType } from 'zod';
export interface GenerateJSONOpts<T> {
    system: string;
    user: string;
    schema: ZodType<T>;
    maxTokens?: number;
}
export interface GenerateTextOpts {
    system: string;
    user: string;
    maxTokens?: number;
}
export interface ModelClient {
    generateJSON<T>(opts: GenerateJSONOpts<T>): Promise<T>;
    generateText(opts: GenerateTextOpts): Promise<string>;
}
export type SessionStatus = 'created' | 'waiting_for_participant' | 'active' | 'completed' | 'failed' | 'cancelled';
export type SpeakerRole = 'agent' | 'human';
export interface StoredMessage {
    id?: string;
    session_id: string;
    sequence_number: number;
    speaker_role: SpeakerRole;
    message_text: string | null;
    input_method?: string | null;
    created_at?: string;
}
export interface StoredSession {
    id: string;
    session_purpose: string;
    session_status: SessionStatus;
    business_name?: string | null;
    running_summary?: string | null;
    turn_count?: number | null;
    participant_consent_at?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    strategy_key?: string | null;
    strategy_version?: number | null;
    objective?: string | null;
    objection_profile?: string | null;
    brief?: unknown | null;
    max_turns?: number | null;
}
export interface SessionStore {
    getSession(sessionId: string): Promise<StoredSession | null>;
    listMessages(sessionId: string): Promise<StoredMessage[]>;
    insertMessage(message: Omit<StoredMessage, 'id' | 'created_at'>): Promise<StoredMessage>;
    updateSession(sessionId: string, patch: Partial<Omit<StoredSession, 'id'>>): Promise<StoredSession>;
    upsertReview(sessionId: string, review: StoredReview): Promise<StoredReview>;
}
export interface StoredReview {
    id?: string;
    session_id: string;
    summary?: string | null;
    outcome_suggested?: string | null;
    objection_tags?: string[] | null;
    next_step?: string | null;
    quality_notes?: Record<string, unknown> | null;
    excerpts?: Array<{
        point: string;
        message_seq: number[];
    }> | null;
}
export interface StrategyConfig {
    key: string;
    version: number;
    goal?: string;
    tone?: string;
    behaviours?: readonly string[];
    end_conditions?: Array<{
        id: string;
        description: string;
    }>;
    max_turns?: number;
}
export interface SystemPromptInput {
    brief?: string | null;
    strategy?: StrategyConfig | null;
    purpose?: string | null;
    objectionProfile?: string | null;
    runningSummary?: string | null;
}
export interface OpeningTurnInput {
    store: SessionStore;
    model: ModelClient;
    sessionId: string;
    businessName: string;
    opener: string;
    maxTokens?: number;
}
export interface OpeningTurnOutput {
    agentText: string;
    message: StoredMessage;
}
export interface NextTurnInput {
    store: SessionStore;
    model: ModelClient;
    sessionId: string;
    humanText: string;
    inputMethod: string;
    maxTokens?: number;
}
export interface NextTurnOutput {
    agentText: string;
    ended: boolean;
    endReason?: string;
    error?: string;
}
export interface SummaryInput {
    store: SessionStore;
    model: ModelClient;
    sessionId: string;
    maxTokens?: number;
}
//# sourceMappingURL=types.d.ts.map