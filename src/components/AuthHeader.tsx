import { createClient } from '@/utils/supabase/server'
import AuthDropdown from '@/components/AuthDropdown'

export default async function AuthHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header style={{ position: 'fixed', top: 12, left: 12, zIndex: 50 }}>
      <AuthDropdown email={user?.email ?? null} />
    </header>
  )
}
