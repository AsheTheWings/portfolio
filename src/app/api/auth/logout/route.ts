/**
 * POST /api/auth/logout - Sign out user
 * 
 * Clears HTTP-only cookies and invalidates Supabase session
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { clearAuthCookies } from '@/lib/supabase/cookies';

export async function POST(request: NextRequest) {
  try {
    // Invalidate Supabase session
    await AuthHandlers.logout();
    
    // Clear HTTP-only cookies
    await clearAuthCookies();
    
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
