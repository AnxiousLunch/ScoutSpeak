import { z } from 'zod'

export const businessProfileSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(200),
  services: z.string().min(1, 'Services are required').max(2000),
  value_proposition: z.string().min(1, 'Value proposition is required').max(2000),
  target_industry: z.string().max(200).optional().or(z.literal('')),
  target_geography: z.string().max(200).optional().or(z.literal('')),
  constraints: z.string().max(2000).optional().or(z.literal('')),
})

export type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  objective: z.string().max(2000).optional().or(z.literal('')),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
})

export type CampaignFormValues = z.infer<typeof campaignSchema>

export const leadStatusValues = [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'nurture',
] as const

export type LeadStatus = (typeof leadStatusValues)[number]

export const manualLeadSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  website_url: z
    .string()
    .min(1, 'Website URL is required')
    .max(1000)
    .refine(
      (value) => {
        try {
          const url = new URL(value.trim())
          return url.protocol === 'http:' || url.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'URL must start with http:// or https://' }
    ),
})

export type ManualLeadFormValues = z.infer<typeof manualLeadSchema>

export const websiteUrlSchema = z
  .string()
  .min(1, 'Website URL is required')
  .max(1000)
  .refine(
    (value) => {
      try {
        const url = new URL(value.trim())
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'URL must start with http:// or https://' }
  )

export const csvRowSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  website_url: websiteUrlSchema,
})

export type CsvRow = z.infer<typeof csvRowSchema>

export function normalizeUrl(value: string): string {
  const url = new URL(value.trim().toLowerCase())
  url.hash = ''
  url.search = ''
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString()
}
