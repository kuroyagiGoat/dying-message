import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// 未設定でもローカルモードは動作させたいので、クライアントは null 許容にする
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false },
    })
  : null

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase が未設定です。.env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。',
    )
  }
  return supabase
}
