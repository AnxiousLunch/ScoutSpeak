import type { ModelClient, SessionStore, StoredSession } from './types';
export declare function createFakeStore(initialSession: StoredSession): SessionStore;
export declare function createFakeModel(opts?: {
    textReplies?: string[];
    jsonReplies?: unknown[];
}): ModelClient;
//# sourceMappingURL=test-utils.d.ts.map