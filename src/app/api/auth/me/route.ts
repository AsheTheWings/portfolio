/**
 * GET /api/auth/me - Get current authenticated user
 * Thin wrapper around authentication feature
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';

export async function GET(request: NextRequest) {
  try {
    const response = await AuthHandlers.getCurrentUser();
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
