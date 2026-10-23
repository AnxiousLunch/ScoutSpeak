import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, nextTurn, openingTurn } from './controller';
import { createFakeModel, createFakeStore } from './test-utils';
function baseSession(overrides) {
    return {
        id: 'session-1',
        session_purpose: 'rehearsal',
        session_status: 'active',
        business_name: 'TestCo',
        strategy_key: 'concise',
        strategy_version: 1,
        objective: 'Qualify the prospect',
        ...overrides,
    };
}
describe('buildSystemPrompt', () => {
    it('includes AI identification and grounding rules', () => {
        const prompt = buildSystemPrompt({
            brief: 'Sell widgets',
            strategy: {
                key: 'concise',
                version: 1,
                goal: 'Qualify quickly',
                tone: 'Direct',
                behaviours: ['Be brief'],
            },
            purpose: 'rehearsal',
            objectionProfile: 'Price sensitive',
            runningSummary: 'Prospect asked about pricing.',
        });
        expect(prompt).toContain('AI');
        expect(prompt).toContain('Sell widgets');
        expect(prompt).toContain('Qualify quickly');
        expect(prompt).toContain('Price sensitive');
        expect(prompt).toContain('Prospect asked about pricing');
    });
});
describe('openingTurn', () => {
    it('prepends fixed intro and persists the opener', async () => {
        const session = baseSession({ session_status: 'created' });
        const store = createFakeStore(session);
        const model = createFakeModel();
        const { agentText, message } = await openingTurn({
            store,
            model,
            sessionId: session.id,
            businessName: 'TestCo',
            opener: 'What problem are you trying to solve?',
        });
        expect(agentText).toContain("Hi, I'm an AI sales assistant for TestCo");
        expect(agentText).toContain('What problem are you trying to solve?');
        expect(message.sequence_number).toBe(1);
        expect(message.speaker_role).toBe('agent');
        const messages = await store.listMessages(session.id);
        expect(messages).toHaveLength(1);
    });
    it('returns existing opening if already stored', async () => {
        const session = baseSession({ session_status: 'created' });
        const store = createFakeStore(session);
        await store.insertMessage({
            session_id: session.id,
            sequence_number: 1,
            speaker_role: 'agent',
            message_text: 'existing opener',
        });
        const { agentText } = await openingTurn({
            store,
            model: createFakeModel(),
            sessionId: session.id,
            businessName: 'TestCo',
            opener: 'new opener',
        });
        expect(agentText).toBe('existing opener');
    });
});
describe('nextTurn', () => {
    it('persists human message and agent reply', async () => {
        const session = baseSession();
        const store = createFakeStore(session);
        const model = createFakeModel({ textReplies: ['Thanks for sharing.'] });
        const result = await nextTurn({
            store,
            model,
            sessionId: session.id,
            humanText: 'We need better reporting.',
            inputMethod: 'typed',
        });
        expect(result.agentText).toBe('Thanks for sharing.');
        expect(result.ended).toBe(false);
        const messages = await store.listMessages(session.id);
        expect(messages).toHaveLength(2);
        expect(messages[0].speaker_role).toBe('human');
        expect(messages[1].speaker_role).toBe('agent');
    });
    it('does not duplicate sequence numbers on retry', async () => {
        const session = baseSession();
        const store = createFakeStore(session);
        const failingModel = createFakeModel();
        const okModel = createFakeModel({ textReplies: ['Got it.'] });
        const failedResult = await nextTurn({
            store,
            model: failingModel,
            sessionId: session.id,
            humanText: 'Hello',
            inputMethod: 'typed',
        });
        expect(failedResult.error).toContain('No more fake text replies');
        const afterFailure = await store.listMessages(session.id);
        expect(afterFailure).toHaveLength(1);
        expect(afterFailure[0].sequence_number).toBe(1);
        const result = await nextTurn({
            store,
            model: okModel,
            sessionId: session.id,
            humanText: 'Hello',
            inputMethod: 'typed',
        });
        expect(result.agentText).toBe('Got it.');
        const finalMessages = await store.listMessages(session.id);
        expect(finalMessages).toHaveLength(2);
        expect(finalMessages[0].sequence_number).toBe(1);
        expect(finalMessages[1].sequence_number).toBe(2);
    });
    it('ends when counterpart declines', async () => {
        const session = baseSession();
        const store = createFakeStore(session);
        const model = createFakeModel({ textReplies: ['Understood.'] });
        const result = await nextTurn({
            store,
            model,
            sessionId: session.id,
            humanText: 'I am not interested, please stop.',
            inputMethod: 'typed',
        });
        expect(result.ended).toBe(true);
        expect(result.endReason).toBe('counterpart_declined');
    });
    it('ends when max turns exceeded', async () => {
        const session = baseSession({ max_turns: 6 });
        const store = createFakeStore(session);
        for (let i = 1; i <= 6; i++) {
            await store.insertMessage({
                session_id: session.id,
                sequence_number: i,
                speaker_role: 'human',
                message_text: `turn ${i}`,
            });
        }
        const model = createFakeModel({ textReplies: ['Acknowledged.'] });
        const result = await nextTurn({
            store,
            model,
            sessionId: session.id,
            humanText: 'turn 7',
            inputMethod: 'typed',
        });
        expect(result.ended).toBe(true);
        expect(result.endReason).toBe('max_turns');
    });
});
