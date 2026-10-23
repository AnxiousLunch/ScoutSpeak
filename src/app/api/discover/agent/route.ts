import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { getDiscoveryProvider } from '@/lib/discovery'

export const runtime = 'nodejs'

const Categories = [
  'accounting', 'restaurant', 'cafe', 'hotel', 'hospital', 'clinic', 'school', 'lawyer',
  'real estate', 'dentist', 'pharmacy', 'gym', 'beauty', 'florist', 'bakery', 'supermarket',
  'grocery', 'retail', 'software', 'marketing', 'consulting', 'construction', 'plumber',
  'electrician', 'photography', 'design', 'agency', 'car', 'salon', 'travel', 'insurance', 'bank',
] as const

const RequestSchema = z.object({
  campaignId: z.string().uuid(),
  location: z.string().min(1).max(200),
  keyword: z.string().trim().max(100).optional().default(''),
  limit: z.coerce.number().int().min(1).max(25).default(10),
})

const PlanSchema = z.object({ category: z.enum(Categories) })

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ message: 'Complete your two-factor check first.' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ message: 'The request could not be read.' }, { status: 400 })
  }
  const parsed = RequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid agent request.' }, { status: 400 })
  }

  const [{ data: campaign }, { data: profile }] = await Promise.all([
    supabase.from('campaigns').select('id, name, objective').eq('id', parsed.data.campaignId).eq('owner_id', user.id).single(),
    supabase.from('business_profiles').select('business_name, services, value_proposition, target_industry, target_geography').eq('owner_id', user.id).order('version', { ascending: false }).limit(1).single(),
  ])
  if (!campaign) return NextResponse.json({ message: 'Campaign not found.' }, { status: 404 })
  if (!profile) return NextResponse.json({ message: 'Save a business profile first.' }, { status: 400 })

  const fallbackContext = [
    parsed.data.keyword,
    campaign.name,
    campaign.objective,
    profile.target_industry,
    profile.services,
  ].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const fallbackCategory = Categories.find((category) => ` ${fallbackContext} `.includes(` ${category} `))
  let category: (typeof Categories)[number]
  let agentFallback = false
  try {
    const plan = await getModelClient().generateJSON({
      system: `You are a lead research agent. Choose one business category from this exact list for a free OpenStreetMap search tool: ${Categories.join(', ')}. Use the campaign and provider profile to infer the likely prospect category. Return JSON only: {"category":"one exact list value"}. Never invent businesses or locations.`,
      user: `Requested business type: ${parsed.data.keyword || 'infer from campaign'}\nCampaign: ${campaign.name}\nObjective: ${campaign.objective ?? ''}\nProvider: ${profile.business_name ?? ''}\nServices: ${profile.services ?? ''}\nValue proposition: ${profile.value_proposition ?? ''}\nTarget industry: ${profile.target_industry ?? ''}\nTarget geography: ${profile.target_geography ?? ''}`,
      schema: PlanSchema,
      maxTokens: 200,
    })
    category = plan.category
  } catch (error) {
    if (!fallbackCategory) {
      const message = error instanceof Error ? error.message : 'AI lead planning failed.'
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (code === 'rate_limit') return NextResponse.json({ message, recoverable: true }, { status: 429 })
      return NextResponse.json(
        { message: `The AI could not pick a business type (${message.slice(0, 140)}). Type one of: ${Categories.join(', ')}.`, recoverable: true },
        { status: 422 },
      )
    }
    category = fallbackCategory
    agentFallback = true
  }

  try {
    const provider = getDiscoveryProvider()
    const results = await provider.search({
      keyword: category,
      location: parsed.data.location,
      limit: parsed.data.limit,
    })
    return NextResponse.json({ provider: provider.name, attribution: provider.attribution, category, agentFallback, count: results.length, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lead agent search failed.'
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    return NextResponse.json({ message, recoverable: true }, { status: code === 'rate_limit' ? 429 : 502 })
  }
}