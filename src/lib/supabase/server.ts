/**
 * Server-side Supabase client
 * 
 * Acts as BFF (Backend-for-Frontend) proxy to Supabase.
 * Manages authentication tokens via HTTP-only cookies.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getAccessToken, getRefreshToken } from './cookies';

/**
 * Create authenticated Supabase client using HTTP-only cookies
 */
export async function createClient() {
  const cookieStore = await cookies();

  // Get tokens from HTTP-only cookies (server-side only)
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - cookies are read-only
          }
        },
      },
      auth: {
        // Use tokens from HTTP-only cookies if available
        ...(accessToken && refreshToken
          ? {
              persistSession: false,
              autoRefreshToken: false,
            }
          : {}),
      },
    }
  );

  // Set session from HTTP-only cookies
  if (accessToken && refreshToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return client;
}

/**
 * Create Supabase admin client using the service role key.
 * Bypasses RLS and email confirmation. Use only in trusted server-side contexts.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
