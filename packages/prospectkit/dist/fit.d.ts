import type { Ratings } from './schema.js';

export interface FitWeights {
  offer_match?: number;
  evidence_strength?: number;
  constraint_fit?: number;
  stated_need?: number;
}

export interface FitResult {
  score: number;
  label: 'strong' | 'possible' | 'weak' | 'excluded';
  breakdown: {
    dimensions: Record<string, { value: number | null; weight: number; contribution: number }>;
    knownWeight: number;
    rawScore: number;
  };
  unknowns: string[];
  reason: string;
}

export declare function computeFit(
  ratings: Ratings,
  violatedConstraints: number[],
  weights?: FitWeights
): FitResult;
