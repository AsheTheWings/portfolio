/**
 * Supabase Middleware for Session Management
 * 
 * Phase 3: Automatic Token Refresh
 * - Intercepts all requests
 * - Reads tokens from HTTP-only cookies
 * - Automatically refreshes expired tokens
 * - Updates cookies with new tokens
 * - All happens server-side, transparent to client
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAMES = {
  ACCESS_TOKEN: 'sb_access_token',
  REFRESH_TOKEN: 'sb_refresh_token',
  USER_DATA: 'timeline_user',
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Read tokens from HTTP-only cookies
  const accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          );
        },
      },
    }
  );

  // Set session from HTTP-only cookies if available
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } else if (!accessToken && !refreshToken) {
    // No tokens at all - ensure user data cookie is also cleared
    const hasUserData = request.cookies.get(COOKIE_NAMES.USER_DATA);
    if (hasUserData) {
      supabaseResponse.cookies.delete(COOKIE_NAMES.USER_DATA);
    }
  }

  // Automatic token refresh
  // If access token is expired, Supabase will use refresh token to get new tokens
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If refresh happened, new tokens are automatically set in cookies via setAll above
  if (error) {
    // Token refresh failed - clear ALL auth cookies to prevent stale user data
    supabaseResponse.cookies.delete(COOKIE_NAMES.ACCESS_TOKEN);
    supabaseResponse.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
    supabaseResponse.cookies.delete(COOKIE_NAMES.USER_DATA);
  } else if (user) {
    // Update user data cookie if session is valid (keeps it fresh)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username,
      full_name: user.user_metadata?.full_name,
      is_active: true,
      createdAt: user.createdAt,
      last_login: user.last_sign_in_at,
    };
    
    supabaseResponse.cookies.set(COOKIE_NAMES.USER_DATA, JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
  }

  return supabaseResponse;
}
