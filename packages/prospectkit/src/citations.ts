import { z } from 'zod'
import { enrichmentResultSchema } from './schema.js'

export function makeEnrichmentSchema(allowedTags: Set<string>) {
  const tagSchema = z.string()

  const citedItemSchema = z.object({
    text: z.string().min(1),
    evidence: z.array(tagSchema).min(1, {
      message: 'Every factual claim must cite at least one source page',
    }),
  })

  const inferredNeedSchema = z.object({
    text: z.string().min(1),
    is_inference: z.literal(true),
    evidence: z.array(tagSchema).min(1, {
      message: 'Inferred needs must cite supporting evidence',
    }),
  })

  return enrichmentResultSchema
    .omit({ summary: true, observed_signal: true, inferred_need: true })
    .extend({
      summary: citedItemSchema,
      observed_signal: citedItemSchema,
      inferred_need: inferredNeedSchema.nullable(),
    })
    .superRefine((data, ctx) => {
      const allowed = [...allowedTags].join(', ')

      for (const tag of data.summary.evidence) {
        if (!allowedTags.has(tag)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Evidence tag "${tag}" is not allowed. Allowed tags: ${allowed}`,
            path: ['summary', 'evidence'],
          })
        }
      }

      if (data.observed_signal.evidence.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'observed_signal must cite at least one evidence tag',
          path: ['observed_signal', 'evidence'],
        })
      }

      for (const tag of data.observed_signal.evidence) {
        if (!allowedTags.has(tag)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Evidence tag "${tag}" is not allowed. Allowed tags: ${allowed}`,
            path: ['observed_signal', 'evidence'],
          })
        }
      }

      if (data.inferred_need) {
        for (const tag of data.inferred_need.evidence) {
          if (!allowedTags.has(tag)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Evidence tag "${tag}" is not allowed. Allowed tags: ${allowed}`,
              path: ['inferred_need', 'evidence'],
            })
          }
        }
      }
    })
}
