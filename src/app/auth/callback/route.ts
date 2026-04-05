import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { SUPABASE_CONFIG_ERROR } from '@/utils/supabase/config'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(SUPABASE_CONFIG_ERROR)}`
      )
    }

    await supabase.auth.exchangeCodeForSession(code)
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/`)
}
