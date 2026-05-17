/**
 * JWT Cookie Management
 *
 * Handles the `timeline_token` HTTP-only cookie used for authenticating
 * with the Hono backend.  Tokens are NEVER exposed to client-side JS.
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'timeline_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days (matches backend token expiry)

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Set the JWT token as an HTTP-only cookie.
 */
export async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: MAX_AGE,
  });
}

/**
 * Read the raw JWT token from the cookie (server-side only).
 */
export async function getTokenCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Clear the JWT cookie (logout).
 */
export async function clearTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Decode the JWT without calling the backend.
 * Returns the payload if valid, null otherwise.
 * Requires JWT_SECRET to be set in the environment.
 */
export async function verifyToken(): Promise<{
  userId: string;
  username: string;
} | null> {
  const token = await getTokenCookie();
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth/cookies] JWT_SECRET not set');
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      username: (payload.username as string) ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Quick boolean check — does a valid-looking token cookie exist?
 * Does NOT verify signature (use verifyToken for that).
 */
export async function hasTokenCookie(): Promise<boolean> {
  const token = await getTokenCookie();
  return !!token;
}
