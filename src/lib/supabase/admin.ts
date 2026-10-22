import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/utils/supabase/database.types'

// Service-role client. Allowed ONLY here, and used ONLY by src/app/api/join/**.
// Never import this in client code and never log the key.
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Prospect links are not configured on the server. Set SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
