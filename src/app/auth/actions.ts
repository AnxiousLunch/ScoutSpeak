'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type AuthResult =
  | { error: string; success?: never; redirect?: never }
  | { error?: never; success: string; redirect?: never }
  | { error?: never; success?: never; redirect: string }

export async function signup(formData: FormData): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join('. ') }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  return {
    success:
      'Check your inbox to confirm your email address, then sign in.',
  }
}

export async function login(formData: FormData): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join('. ') }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const verifiedFactors =
    factorsData?.all?.filter((f) => f.status === 'verified') ?? []

  if (verifiedFactors.length === 0) {
    return { redirect: '/mfa/enroll' }
  }

  const { data: aal } = await supabase.auth.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
    return { redirect: '/mfa/challenge' }
  }

  return { redirect: '/' }
}

export async function signout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
