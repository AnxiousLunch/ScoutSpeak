export function partialTranscript(text) {
    return { type: 'partial_transcript', text };
}
export function finalTranscript(text, speaker) {
    return { type: 'final_transcript', text, speaker };
}
export function turnEvent(speaker, text) {
    return { type: 'turn', speaker, text };
}
export function statusEvent(status) {
    return { type: 'status', status };
}
export function errorEvent(error) {
    return { type: 'error', error };
}
