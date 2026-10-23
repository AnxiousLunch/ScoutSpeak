export function createFakeStore(initialSession) {
    const sessions = new Map([[initialSession.id, initialSession]]);
    const messages = new Map([[initialSession.id, []]]);
    const reviews = new Map();
    let idCounter = 1;
    return {
        async getSession(sessionId) {
            return sessions.get(sessionId) ?? null;
        },
        async listMessages(sessionId) {
            return [...(messages.get(sessionId) ?? [])].sort((a, b) => a.sequence_number - b.sequence_number);
        },
        async insertMessage(message) {
            const full = {
                ...message,
                id: `msg-${idCounter++}`,
                created_at: new Date().toISOString(),
            };
            const list = messages.get(message.session_id) ?? [];
            list.push(full);
            messages.set(message.session_id, list);
            return full;
        },
        async updateSession(sessionId, patch) {
            const existing = sessions.get(sessionId);
            if (!existing)
                throw new Error('Session not found');
            const updated = { ...existing, ...patch };
            sessions.set(sessionId, updated);
            return updated;
        },
        async upsertReview(sessionId, review) {
            const full = {
                ...review,
                id: `review-${idCounter++}`,
            };
            reviews.set(sessionId, full);
            return full;
        },
    };
}
export function createFakeModel(opts) {
    const textReplies = opts?.textReplies ?? [];
    const jsonReplies = opts?.jsonReplies ?? [];
    let textIndex = 0;
    let jsonIndex = 0;
    return {
        async generateText() {
            const reply = textReplies[textIndex++];
            if (typeof reply !== 'string') {
                throw new Error('No more fake text replies');
            }
            return reply;
        },
        async generateJSON() {
            const reply = jsonReplies[jsonIndex++];
            if (reply === undefined) {
                throw new Error('No more fake JSON replies');
            }
            return reply;
        },
    };
}
