import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Fail loudly in the console, but see App.tsx for the on-page message —
  // letting createClient() throw here would crash the whole app to a blank
  // page before React even renders anything.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to ' +
      '.env.local and fill in your Supabase project values (or set them in ' +
      "Netlify's Site settings → Environment variables)."
  )
}

// Placeholder values when unconfigured so createClient() doesn't throw at
// import time — actual requests will still fail, but the app can render a
// clear on-page message instead of a blank screen. See isSupabaseConfigured.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.invalid',
  supabaseAnonKey || 'placeholder-anon-key'
)
