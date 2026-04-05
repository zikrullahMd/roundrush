import { login, signup } from './actions'
import { isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from '@/utils/supabase/config'

export default async function LoginPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const configured = isSupabaseConfigured()
  const searchError = searchParams?.error as string | undefined
  const error = searchError ?? (configured ? undefined : SUPABASE_CONFIG_ERROR)

  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <form className="flex flex-col gap-4 w-full max-w-sm p-8 bg-[#1a1a24] rounded-2xl shadow-xl border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Authentication</h2>
        
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-500 text-sm mb-2 text-center">
            {error}
          </div>
        )}
        
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-gray-400">Email</label>
          <input 
            id="email" 
            name="email" 
            type="email" 
            required 
            className="px-4 py-2 bg-[#0c0c12] rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-gray-400">Password</label>
          <input 
            id="password" 
            name="password" 
            type="password" 
            required 
            className="px-4 py-2 bg-[#0c0c12] rounded-lg border border-white/10 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-4 mt-4">
          <button 
            formAction={login} 
            disabled={!configured}
            className="flex-1 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Log in
          </button>
          <button 
            formAction={signup} 
            disabled={!configured}
            className="flex-1 py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Sign up
          </button>
        </div>
      </form>
    </div>
  )
}
