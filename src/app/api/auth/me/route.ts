/**
 * GET /api/auth/me
 *
 * Thin proxy → backend GET /auth/me
 * Forwards the JWT cookie as an Authorization header.
 */

import { NextResponse } from 'next/server';
import { getTokenCookie } from '@/features/authentication/lib/cookies';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

export async function GET() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? 'Failed to get user' },
      { status: res.status },
    );
  }

  return NextResponse.json(data.user);
}
