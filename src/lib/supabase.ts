import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

export function createServiceRoleClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

// Database Types
export interface Account {
  id: string
  token: string
  user_id: string
  username: string
  avatar: string | null
  created_at: string
}

export interface Message {
  id: string
  account_id: string
  discord_user_id: string
  username: string
  avatar: string | null
  direction: 'sent' | 'received'
  content: string
  timestamp: string
} 