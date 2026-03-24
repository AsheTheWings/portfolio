/**
 * Supabase Cookie Management
 * 
 * Handles secure HTTP-only cookie operations for authentication tokens.
 * Tokens are NEVER exposed to client-side JavaScript.
 */

import { cookies } from 'next/headers';
import type { UserPublic } from '@/features/authentication/types';

const COOKIE_CONFIG = {
  ACCESS_TOKEN: 'sb_access_token',
  REFRESH_TOKEN: 'sb_refresh_token',
  USER_DATA: 'timeline_user', // Cached user data (avoid Supabase calls)
  MAX_AGE: {
    ACCESS: 60 * 60, // 1 hour
    REFRESH: 7 * 24 * 60 * 60, // 7 days
    USER: 7 * 24 * 60 * 60, // 7 days (matches refresh token)
  },
  OPTIONS: {
    httpOnly: true, // Cannot be accessed by JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax' as const, // CSRF protection
    path: '/',
  },
};

/**
 * Set authentication tokens and user data as HTTP-only cookies
 */
export async function setAuthCookies(
  accessToken: string, 
  refreshToken: string, 
  user: UserPublic
) {
  const cookieStore = await cookies();

  // Set Access Token cookie
  cookieStore.set(COOKIE_CONFIG.ACCESS_TOKEN, accessToken, {
    ...COOKIE_CONFIG.OPTIONS,
    maxAge: COOKIE_CONFIG.MAX_AGE.ACCESS,
  });

  // Set Refresh Token cookie
  cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, refreshToken, {
    ...COOKIE_CONFIG.OPTIONS,
    maxAge: COOKIE_CONFIG.MAX_AGE.REFRESH,
  });

  // Set User Data cookie (cached for fast reads, avoids Supabase calls)
  cookieStore.set(COOKIE_CONFIG.USER_DATA, JSON.stringify(user), {
    ...COOKIE_CONFIG.OPTIONS,
    maxAge: COOKIE_CONFIG.MAX_AGE.USER,
  });
}

/**
 * Get access token from HTTP-only cookie
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_CONFIG.ACCESS_TOKEN);
  return cookie?.value || null;
}

/**
 * Get refresh token from HTTP-only cookie
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_CONFIG.REFRESH_TOKEN);
  return cookie?.value || null;
}

/**
 * Get user data from HTTP-only cookie
 * Fast read - no Supabase call needed
 */
export async function getUserData(): Promise<UserPublic | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_CONFIG.USER_DATA);
  
  if (!cookie?.value) return null;
  
  try {
    return JSON.parse(cookie.value) as UserPublic;
  } catch {
    return null;
  }
}

/**
 * Clear all authentication cookies
 */
export async function clearAuthCookies() {
  const cookieStore = await cookies();
  
  cookieStore.delete(COOKIE_CONFIG.ACCESS_TOKEN);
  cookieStore.delete(COOKIE_CONFIG.REFRESH_TOKEN);
  cookieStore.delete(COOKIE_CONFIG.USER_DATA);
}

/**
 * Check if user has valid auth cookies
 */
export async function hasAuthCookies(): Promise<boolean> {
  const accessToken = await getAccessToken();
  return !!accessToken;
}
