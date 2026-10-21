import { z } from 'zod';

export declare const ratingDimensionSchema: z.ZodNullable<z.ZodNumber>;

export declare const ratingsSchema: z.ZodObject<{
  offer_match: z.ZodNullable<z.ZodNumber>;
  evidence_strength: z.ZodNullable<z.ZodNumber>;
  constraint_fit: z.ZodNullable<z.ZodNumber>;
  stated_need: z.ZodNullable<z.ZodNumber>;
}>;

export type Ratings = z.infer<typeof ratingsSchema>;

export declare const evidenceItemSchema: z.ZodObject<{
  text: z.ZodString;
  evidence: z.ZodArray<z.ZodString>;
}>;

export declare const inferredNeedSchema: z.ZodObject<{
  text: z.ZodString;
  is_inference: z.ZodLiteral<true>;
  evidence: z.ZodArray<z.ZodString>;
}>;

export declare const enrichmentResultSchema: z.ZodObject<{
  summary: z.ZodObject<{ text: z.ZodString; evidence: z.ZodArray<z.ZodString> }>;
  observed_signal: z.ZodObject<{ text: z.ZodString; evidence: z.ZodArray<z.ZodString> }>;
  inferred_need: z.ZodNullable<z.ZodObject<{
    text: z.ZodString;
    is_inference: z.ZodLiteral<true>;
    evidence: z.ZodArray<z.ZodString>;
  }>>;
  opener: z.ZodEffects<z.ZodString, string, string>;
  missing_fields: z.ZodArray<z.ZodString>;
  violated_constraints: z.ZodArray<z.ZodNumber>;
  ratings: z.ZodObject<{
    offer_match: z.ZodNullable<z.ZodNumber>;
    evidence_strength: z.ZodNullable<z.ZodNumber>;
    constraint_fit: z.ZodNullable<z.ZodNumber>;
    stated_need: z.ZodNullable<z.ZodNumber>;
  }>;
  rating_reasons: z.ZodRecord<z.ZodString>;
}>;

export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;
