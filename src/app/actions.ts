'use server'

import { createClient } from '@/utils/supabase/server'
import { DEFAULT_PROGRESS, clone, type Progress } from '@/components/circle-sum-challenge/config'

export async function saveProgress(progress: Progress) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, progress })

  if (error) {
    console.error('Error saving progress:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function loadProgress(): Promise<Progress | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('progress')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  // Merge with DEFAULT_PROGRESS so new users with empty {} don't crash
  const serverProgress = data.progress as Partial<Progress>
  if (!serverProgress || Object.keys(serverProgress).length === 0) {
    return null
  }

  return {
    ...clone(DEFAULT_PROGRESS),
    ...serverProgress,
    stats: {
      ...clone(DEFAULT_PROGRESS).stats,
      ...(serverProgress.stats || {}),
    },
  } as Progress
}
