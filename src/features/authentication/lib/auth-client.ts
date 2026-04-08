'use client';

/**
 * Client-side authentication API functions.
 * Calls Next.js API routes (which handle cookies server-side).
 */

/**
 * Log out the current user by clearing the server-side auth cookie.
 * Callers should also clear the auth store and redirect as needed.
 */
export async function logoutUser(): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Logout failed');
  }
}
