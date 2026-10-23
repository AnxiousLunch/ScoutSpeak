import { z } from 'zod';
const outcomeSchema = z.enum([
    'interested',
    'follow_up',
    'meeting_requested',
    'not_interested',
    'not_a_fit',
    'unclear',
]);
const excerptSchema = z.object({
    point: z.string().min(1),
    message_seq: z.array(z.number().int().min(1)).min(1),
});
const reviewSchema = z.object({
    summary: z.string().min(1),
    outcome_suggested: outcomeSchema,
    objection_tags: z.array(z.string().min(1)),
    next_step: z.string().min(1),
    quality_notes: z.object({
        objection_handling: z.string().min(1),
        missed_opportunities: z.string().min(1),
    }),
    excerpts: z.array(excerptSchema),
});
function formatTranscript(messages) {
    return messages
        .map((message) => `${message.sequence_number}. ${message.speaker_role === 'agent' ? 'AI' : 'Prospect'}: ${message.message_text ?? ''}`)
        .join('\n');
}
export async function extractOutcome(input) {
    const messages = input.messages;
    const validSeqs = new Set(messages.map((message) => message.sequence_number));
    const validatedSchema = reviewSchema.superRefine((data, ctx) => {
        for (const excerpt of data.excerpts) {
            for (const seq of excerpt.message_seq) {
                if (!validSeqs.has(seq)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `message_seq ${seq} does not exist in the transcript`,
                        path: ['excerpts', data.excerpts.indexOf(excerpt), 'message_seq'],
                    });
                }
            }
        }
    });
    const prompt = [
        'Review the following sales conversation transcript and produce a structured review.',
        'outcome_suggested must be one of: interested, follow_up, meeting_requested, not_interested, not_a_fit, unclear.',
        'Every excerpt message_seq must refer to a sequence number that exists in the transcript.',
        '',
        input.brief ? `BRIEF:\n${input.brief}\n` : '',
        'TRANSCRIPT:\n',
        formatTranscript(messages),
    ].join('\n');
    let validationError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await input.model.generateJSON({
                system: 'You are a conversation reviewer. Return only valid JSON matching the requested schema.',
                user: attempt === 0 ? prompt : `${prompt}\n\nRepair your previous response. Validation errors: ${validationError}`,
                schema: validatedSchema,
                maxTokens: input.maxTokens ?? 1200,
            });
            const parsed = validatedSchema.safeParse(result);
            if (!parsed.success) {
                validationError = parsed.error.message;
                continue;
            }
            return { review: parsed.data };
        }
        catch (e) {
            validationError = e instanceof Error ? e.message : 'Outcome extraction failed';
        }
    }
    return { review: null, error: validationError || 'Outcome extraction failed' };
}
export function toStoredReview(sessionId, review) {
    return {
        session_id: sessionId,
        summary: review.summary,
        outcome_suggested: review.outcome_suggested,
        objection_tags: review.objection_tags,
        next_step: review.next_step,
        quality_notes: review.quality_notes,
        excerpts: review.excerpts,
    };
}
