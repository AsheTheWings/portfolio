/**
 * POST /api/auth/logout
 *
 * Clears the timeline_token HTTP-only cookie.
 */

import { NextResponse } from 'next/server';
import { clearTokenCookie } from '@portfolio/auth/lib/cookies';

export async function POST() {
  await clearTokenCookie();
  return NextResponse.json({ message: 'Logged out successfully' });
}
