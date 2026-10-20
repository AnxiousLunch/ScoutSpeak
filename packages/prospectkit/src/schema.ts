import { z } from 'zod'

export const ratingDimensionSchema = z.number().int().min(0).max(5).nullable()

export const ratingsSchema = z.object({
  offer_match: ratingDimensionSchema,
  evidence_strength: ratingDimensionSchema,
  constraint_fit: ratingDimensionSchema,
  stated_need: ratingDimensionSchema,
})

export const evidenceItemSchema = z.object({
  text: z.string().min(1),
  evidence: z.array(z.string().min(1)),
})

export const inferredNeedSchema = z.object({
  text: z.string().min(1),
  is_inference: z.literal(true),
  evidence: z.array(z.string().min(1)),
})

export const enrichmentResultSchema = z.object({
  summary: evidenceItemSchema,
  observed_signal: evidenceItemSchema,
  inferred_need: inferredNeedSchema.nullable(),
  opener: z
    .string()
    .min(1)
    .refine(
      (v) => v.trim().split(/\s+/).length <= 30,
      { message: 'opener must be one question with at most 30 words' }
    ),
  missing_fields: z.array(z.string().min(1)),
  violated_constraints: z.array(z.number().int().min(1)),
  ratings: ratingsSchema,
  rating_reasons: z.record(z.string().min(1)),
})

export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>
export type Ratings = z.infer<typeof ratingsSchema>
