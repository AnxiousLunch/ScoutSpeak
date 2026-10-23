import { z } from 'zod';
import type { ModelClient, StoredMessage, StoredReview } from './types.js';
declare const reviewSchema: z.ZodObject<{
    summary: z.ZodString;
    outcome_suggested: z.ZodEnum<["interested", "follow_up", "meeting_requested", "not_interested", "not_a_fit", "unclear"]>;
    objection_tags: z.ZodArray<z.ZodString, "many">;
    next_step: z.ZodString;
    quality_notes: z.ZodObject<{
        objection_handling: z.ZodString;
        missed_opportunities: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        objection_handling: string;
        missed_opportunities: string;
    }, {
        objection_handling: string;
        missed_opportunities: string;
    }>;
    excerpts: z.ZodArray<z.ZodObject<{
        point: z.ZodString;
        message_seq: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        point: string;
        message_seq: number[];
    }, {
        point: string;
        message_seq: number[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    summary: string;
    outcome_suggested: "interested" | "follow_up" | "meeting_requested" | "not_interested" | "not_a_fit" | "unclear";
    objection_tags: string[];
    next_step: string;
    quality_notes: {
        objection_handling: string;
        missed_opportunities: string;
    };
    excerpts: {
        point: string;
        message_seq: number[];
    }[];
}, {
    summary: string;
    outcome_suggested: "interested" | "follow_up" | "meeting_requested" | "not_interested" | "not_a_fit" | "unclear";
    objection_tags: string[];
    next_step: string;
    quality_notes: {
        objection_handling: string;
        missed_opportunities: string;
    };
    excerpts: {
        point: string;
        message_seq: number[];
    }[];
}>;
export type ReviewResult = z.infer<typeof reviewSchema>;
export interface ExtractOutcomeInput {
    model: ModelClient;
    messages: StoredMessage[];
    brief?: string | null;
    maxTokens?: number;
}
export interface ExtractOutcomeOutput {
    review: ReviewResult | null;
    error?: string;
}
export declare function extractOutcome(input: ExtractOutcomeInput): Promise<ExtractOutcomeOutput>;
export declare function toStoredReview(sessionId: string, review: ReviewResult): Omit<StoredReview, 'id'>;
export {};
//# sourceMappingURL=outcome.d.ts.map