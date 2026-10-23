const WINDOW_SIZE = 6;
const DEFAULT_MAX_TOKENS = 120;
function formatMessage(message) {
    const speaker = message.speaker_role === 'agent' ? 'AI' : 'Prospect';
    return `${speaker}: ${message.message_text ?? ''}`;
}
export async function maybeUpdateSummary(input) {
    const messages = await input.store.listMessages(input.sessionId);
    if (messages.length <= WINDOW_SIZE) {
        return null;
    }
    const historyToSummarize = messages.slice(0, -WINDOW_SIZE);
    const existingSummary = (await input.store.getSession(input.sessionId))?.running_summary ?? '';
    const promptLines = [
        'Update a running summary of this sales conversation.',
        'Use at most 80 words. Preserve key facts, objections, and agreed next steps.',
        'Do not invent details.',
        '',
        'EXISTING SUMMARY:',
        existingSummary || '(none)',
        '',
        'MESSAGES TO ABSORB:',
        historyToSummarize.map(formatMessage).join('\n'),
    ];
    const updated = await input.model.generateText({
        system: 'You are a summarization assistant. Return only plain text, no markdown.',
        user: promptLines.join('\n'),
        maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    });
    const trimmed = updated.trim();
    if (trimmed.length > 0) {
        await input.store.updateSession(input.sessionId, { running_summary: trimmed });
    }
    return trimmed;
}
export function buildMessageWindow(messages, runningSummary) {
    const recent = messages.slice(-WINDOW_SIZE);
    const parts = [];
    if (runningSummary) {
        parts.push('RUNNING SUMMARY:', runningSummary, '');
    }
    parts.push('RECENT MESSAGES:');
    recent.forEach((message) => parts.push(formatMessage(message)));
    return parts.join('\n');
}
