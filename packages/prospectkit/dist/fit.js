const DEFAULT_WEIGHTS = {
    offer_match: 0.35,
    evidence_strength: 0.25,
    constraint_fit: 0.2,
    stated_need: 0.2,
};
export function computeFit(ratings, violatedConstraints, weights = {}) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    const dimensions = {};
    const unknowns = [];
    let weightedSum = 0;
    let knownWeight = 0;
    for (const key of Object.keys(w)) {
        const value = ratings[key];
        const weight = w[key];
        if (value == null) {
            dimensions[key] = { value: null, weight, contribution: 0 };
            unknowns.push(key);
            continue;
        }
        dimensions[key] = { value, weight, contribution: value * weight };
        weightedSum += value * weight;
        knownWeight += weight;
    }
    const rawScore = knownWeight > 0 ? weightedSum / knownWeight : 0;
    const score = Math.round(rawScore * 20);
    let label;
    if (violatedConstraints.length > 0) {
        label = 'excluded';
    }
    else if (unknowns.length > 0) {
        label = score >= 50 ? 'possible' : 'weak';
    }
    else if (score >= 85) {
        label = 'strong';
    }
    else if (score >= 50) {
        label = 'possible';
    }
    else {
        label = 'weak';
    }
    let reason;
    if (label === 'excluded') {
        reason = `Excluded because hard constraint(s) ${violatedConstraints.join(', ')} were violated.`;
    }
    else if (unknowns.length > 0) {
        reason = `Score ${score}/100, but ${unknowns.length} rating dimension(s) could not be assessed: ${unknowns.join(', ')}.`;
    }
    else {
        reason = `Score ${score}/100 across all four dimensions.`;
    }
    return {
        score,
        label,
        breakdown: { dimensions, knownWeight, rawScore },
        unknowns,
        reason,
    };
}
