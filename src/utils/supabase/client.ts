import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './config'

export function createClient() {
  const supabaseEnv = getSupabaseEnv()
  if (!supabaseEnv) {
    return null
  }

  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.anonKey
  )
}
