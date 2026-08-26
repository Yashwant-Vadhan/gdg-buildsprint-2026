import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
      'Supabase calls will fail until .env is filled in from .env.example.'
  );
}

// Placeholder values keep createClient from throwing so the UI can still render
// (with an in-app "not configured" banner) before real keys exist.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
);
