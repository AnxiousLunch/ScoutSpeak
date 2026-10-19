'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { campaignSchema, type CampaignFormValues } from '@/lib/validation'

export type SaveCampaignResult =
  | { success: true; id: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function saveCampaign(
  id: string | undefined,
  values: CampaignFormValues
): Promise<SaveCampaignResult> {
  const parsed = campaignSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    parsed.error.errors.forEach((err) => {
      const path = err.path[0] as string
      fieldErrors[path] = fieldErrors[path] ?? []
      fieldErrors[path].push(err.message)
    })
    return { success: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { data: latestProfile } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('owner_id', user.id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (!latestProfile) {
    return { success: false, error: 'Create a business profile first.' }
  }

  const payload = {
    owner_id: user.id,
    business_profile_id: latestProfile.id,
    name: parsed.data.name.trim(),
    objective: parsed.data.objective?.trim() || null,
    status: parsed.data.status,
  }

  let resultId = id
  if (id) {
    const { error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('campaigns')
      .insert(payload)
      .select('id')
      .single()

    if (error || !inserted) {
      return { success: false, error: error?.message ?? 'Failed to create campaign.' }
    }
    resultId = inserted.id
  }

  revalidatePath('/campaigns')
  return { success: true, id: resultId! }
}
