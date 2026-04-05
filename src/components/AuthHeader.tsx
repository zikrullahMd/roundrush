import { createClient } from '@/utils/supabase/server'
import AuthDropdown from '@/components/AuthDropdown'

export default async function AuthHeader() {
  const supabase = await createClient()
  if (!supabase) {
    return (
      <header style={{ position: 'fixed', top: 12, left: 12, zIndex: 50 }}>
        <AuthDropdown email={null} />
      </header>
    )
  }

  let userEmail: string | null = null

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userEmail = user?.email ?? null
  } catch (error) {
    console.warn('Failed to load authenticated user.', error)
  }

  return (
    <header style={{ position: 'fixed', top: 12, left: 12, zIndex: 50 }}>
      <AuthDropdown email={userEmail} />
    </header>
  )
}
