/**
 * Server-only Supabase client. Only `app/actions.ts` (and this module's own
 * repo layer) may import this — it holds the service-role key, which
 * bypasses Row Level Security entirely. The app never adopted Supabase Auth
 * (sign-in is simulated), so RLS's `auth.uid()` checks would never match a
 * real session anyway; the service role is the only way this app can write.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Returns null (never throws) when Supabase isn't configured, so callers can fall back to in-memory state. */
export function getServiceSupabase(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cachedClient = null;
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}
