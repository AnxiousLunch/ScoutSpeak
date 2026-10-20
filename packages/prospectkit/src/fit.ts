import type { Ratings } from './schema'

export interface FitWeights {
  offer_match?: number
  evidence_strength?: number
  constraint_fit?: number
  stated_need?: number
}

export interface FitResult {
  score: number
  label: 'strong' | 'possible' | 'weak' | 'excluded'
  breakdown: {
    dimensions: Record<string, { value: number | null; weight: number; contribution: number }>
    knownWeight: number
    rawScore: number
  }
  unknowns: string[]
  reason: string
}

const DEFAULT_WEIGHTS: Required<FitWeights> = {
  offer_match: 0.35,
  evidence_strength: 0.25,
  constraint_fit: 0.2,
  stated_need: 0.2,
}

export function computeFit(
  ratings: Ratings,
  violatedConstraints: number[],
  weights: FitWeights = {}
): FitResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights }
  const dimensions: Record<string, { value: number | null; weight: number; contribution: number }> =
    {}
  const unknowns: string[] = []

  let weightedSum = 0
  let knownWeight = 0

  for (const key of Object.keys(w) as (keyof Ratings)[]) {
    const value = ratings[key]
    const weight = w[key]
    if (value == null) {
      dimensions[key] = { value: null, weight, contribution: 0 }
      unknowns.push(key)
      continue
    }
    dimensions[key] = { value, weight, contribution: value * weight }
    weightedSum += value * weight
    knownWeight += weight
  }

  const rawScore = knownWeight > 0 ? weightedSum / knownWeight : 0
  const score = Math.round(rawScore * 20)

  let label: FitResult['label']
  if (violatedConstraints.length > 0) {
    label = 'excluded'
  } else if (unknowns.length > 0) {
    label = score >= 50 ? 'possible' : 'weak'
  } else if (score >= 75) {
    label = 'strong'
  } else if (score >= 50) {
    label = 'possible'
  } else {
    label = 'weak'
  }

  let reason: string
  if (label === 'excluded') {
    reason = `Excluded because hard constraint(s) ${violatedConstraints.join(', ')} were violated.`
  } else if (unknowns.length > 0) {
    reason = `Score ${score}/100, but ${unknowns.length} rating dimension(s) could not be assessed: ${unknowns.join(', ')}.`
  } else {
    reason = `Score ${score}/100 across all four dimensions.`
  }

  return {
    score,
    label,
    breakdown: { dimensions, knownWeight, rawScore },
    unknowns,
    reason,
  }
}
