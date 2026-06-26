/**
 * POST /api/auth/login
 *
 * Thin proxy → backend POST /auth/login
 * Sets the returned JWT as an HTTP-only cookie, returns user data only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setTokenCookie } from '@portfolio/auth/lib/cookies';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';
const APP_SLUG = process.env.APP_SLUG ?? 'timeline';
const APP_KEY = process.env.APP_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Timeline-App-Slug': APP_SLUG,
    };
    if (APP_KEY) headers['Timeline-App-Key'] = APP_KEY;

    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? 'Login failed' },
        { status: res.status },
      );
    }

    // Set JWT as HTTP-only cookie
    await setTokenCookie(data.token);

    // Return user only (no token)
    return NextResponse.json({ user: data.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
