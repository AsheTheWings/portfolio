/**
 * POST /api/auth/refresh - Refresh access token
 * Thin wrapper around authentication feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import type { RefreshTokenRequest } from '@/features/authentication/types';

export async function POST(request: NextRequest) {
  try {
    const body: RefreshTokenRequest = await request.json();
    const response = await AuthHandlers.refreshToken(body);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message.includes('Invalid') || message.includes('expired') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
