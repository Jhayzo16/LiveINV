import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// For a real production app, these would come from environment variables.
// Since this is a prototype and we might use a mock/local setup, we'll provide placeholders.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
