import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/index.js';

let client = null;

export function getClient() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase config missing');
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function resetClient() {
  client = null;
}
