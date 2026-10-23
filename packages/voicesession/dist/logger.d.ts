import type { SessionStore, StoredReview } from './types.js';
export interface SaveReviewInput {
    store: SessionStore;
    sessionId: string;
    purpose: string;
    review: Omit<StoredReview, 'session_id'>;
}
export declare function saveReview(input: SaveReviewInput): Promise<StoredReview>;
//# sourceMappingURL=logger.d.ts.map