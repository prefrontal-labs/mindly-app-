import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses Row Level Security.
 * Use ONLY in server-side API routes, never in client components.
 * Required for admin operations that read across multiple users.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase URL or service role key')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
