export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_TABLE_NAME = import.meta.env.VITE_SUPABASE_TABLE_NAME || 'MyBilibiliHistory';

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
