'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { SUPABASE_CONFIG_ERROR } from '@/utils/supabase/config'

export async function login(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_CONFIG_ERROR)}`)
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_CONFIG_ERROR)}`)
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  if (!supabase) {
    redirect('/')
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
