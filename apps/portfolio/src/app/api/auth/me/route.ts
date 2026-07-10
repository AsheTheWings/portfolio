/**
 * GET /api/auth/me
 *
 * Thin proxy → backend GET /auth/me
 * Forwards the JWT cookie as an Authorization header.
 */

import { NextResponse } from 'next/server';
import { getTokenCookie } from '@portfolio/auth/lib/cookies';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

export async function GET() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let data: any;
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { error: text || `HTTP error ${res.status}` };
    }
  } catch (e) {
    data = { error: `Failed to parse response: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error ?? 'Failed to get user' },
      { status: res.status },
    );
  }

  return NextResponse.json(data.user);
}
