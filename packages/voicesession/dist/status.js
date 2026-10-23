const TERMINAL_STATES = new Set([
    'completed',
    'failed',
    'cancelled',
]);
const VALID_TRANSITIONS = {
    created: ['waiting_for_participant', 'cancelled'],
    waiting_for_participant: ['active', 'cancelled'],
    active: ['completed', 'failed', 'cancelled'],
    completed: [],
    failed: [],
    cancelled: [],
};
export function isTerminal(status) {
    return TERMINAL_STATES.has(status);
}
export function canTransition(from, to, requirements) {
    if (from === to)
        return true;
    if (!VALID_TRANSITIONS[from].includes(to))
        return false;
    if (to === 'completed') {
        if (!requirements)
            return false;
        return requirements.humanTurns >= 2 && requirements.consent;
    }
    return true;
}
export function transition(from, to, requirements) {
    if (!canTransition(from, to, requirements)) {
        return {
            status: from,
            error: `Illegal transition from ${from} to ${to}`,
        };
    }
    return { status: to };
}
