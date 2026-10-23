'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { businessProfileSchema, type BusinessProfileFormValues } from '@/lib/validation'

const saveSchema = businessProfileSchema.transform((data) => ({
  business_name: data.business_name.trim(),
  services: data.services.trim(),
  value_proposition: data.value_proposition.trim(),
  target_industry: data.target_industry?.trim() || null,
  target_geography: data.target_geography?.trim() || null,
  constraints: data.constraints?.trim() || null,
}))

export type SaveProfileResult =
  | { success: true; version: number }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function saveBusinessProfile(values: BusinessProfileFormValues): Promise<SaveProfileResult> {
  const parsed = saveSchema.safeParse(values)
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
    return { success: false, error: 'You must be signed in to save a profile.' }
  }

  const { data: latest, error: latestError } = await supabase
    .from('business_profiles')
    .select('version')
    .eq('owner_id', user.id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (latestError && latestError.code !== 'PGRST116') {
    return { success: false, error: latestError.message }
  }

  const nextVersion = (latest?.version ?? 0) + 1

  const { data: inserted, error: insertError } = await supabase
    .from('business_profiles')
    .insert({
      owner_id: user.id,
      ...parsed.data,
      version: nextVersion,
    })
    .select('version')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  revalidatePath('/profile')
  return { success: true, version: inserted.version }
}
