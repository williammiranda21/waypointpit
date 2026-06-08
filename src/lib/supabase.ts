import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaces the misconfig clearly in dev. Production builds with placeholder
  // creds will fail loudly here, which is the desired behavior.
  console.warn(
    '[waypoint-pit] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing. ' +
      'Calls against supabase will fail until .env is populated.',
  );
}

export const supabase = createClient<Database>(url ?? 'http://placeholder', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'waypoint-pit-session',
  },
  global: {
    headers: { 'x-application-name': 'waypoint-pit' },
  },
});

/** True when env vars look real (not the placeholder values in .env). */
export const supabaseConfigured =
  !!url &&
  !!anonKey &&
  !url.includes('placeholder') &&
  !anonKey.includes('placeholder');
