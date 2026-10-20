import { z } from 'zod';
import type { EnrichmentResult } from './schema.js';

export interface CitedEnrichmentResult
  extends Omit<EnrichmentResult, 'summary' | 'observed_signal' | 'inferred_need'> {
  summary: { text: string; evidence: string[] };
  observed_signal: { text: string; evidence: string[] };
  inferred_need: { text: string; is_inference: true; evidence: string[] } | null;
}

export declare function makeEnrichmentSchema(allowedTags: Set<string>): z.ZodType<
  CitedEnrichmentResult,
  z.ZodTypeDef,
  unknown
>;
