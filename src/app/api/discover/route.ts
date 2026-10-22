import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getDiscoveryProvider } from '@/lib/discovery'

export const runtime = 'nodejs'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25

const RequestSchema = z.object({
  campaignId: z.string().uuid(),
  keyword: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })
  }

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
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid search request.' }, { status: 400 })
  }

  const { campaignId, keyword, location, limit } = parsed.data

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('owner_id', user.id)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ message: 'Campaign not found.' }, { status: 404 })
  }

  const provider = getDiscoveryProvider()
  try {
    const results = await provider.search({ keyword, location, limit })
    return NextResponse.json({
      provider: provider.name,
      attribution: provider.attribution,
      count: results.length,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery search failed.'
    return NextResponse.json({ message, recoverable: true }, { status: 502 })
  }
}
