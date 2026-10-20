export function researchStatus(input) {
    if (input.validationFailed)
        return 'unverified';
    if (!input.citationsValid || !input.observedSignalCited)
        return 'unverified';
    if (input.okPages >= 2)
        return 'verified';
    if (input.okPages >= 1)
        return 'partial';
    return 'unverified';
}
