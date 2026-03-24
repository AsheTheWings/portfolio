/**
 * POST /api/auth/login - Authenticate user
 * 
 * Phase 1: Initial Authentication & Secure Token Issuance
 * - Proxies login request to Supabase
 * - Sets tokens as HTTP-only cookies (never exposed to client)
 * - Returns only user data to client
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { setAuthCookies } from '@/lib/supabase/cookies';
import type { UserLogin } from '@/features/authentication/types';

export async function POST(request: NextRequest) {
  try {
    // Check if user is already authenticated
    try {
      const currentUser = await AuthHandlers.getCurrentUser();
      if (currentUser) {
        return NextResponse.json(
          { error: `Already logged in as ${currentUser.username || currentUser.email}. Logout first.` },
          { status: 400 }
        );
      }
    } catch {
      // Not authenticated, proceed with login
    }

    const body: UserLogin = await request.json();
    
    // Get tokens from Supabase (server-to-server)
    const response = await AuthHandlers.login(body);
    
    // Set tokens + user data as HTTP-only cookies
    await setAuthCookies(
      response.access_token, 
      response.refresh_token,
      response.user
    );
    
    // Return ONLY user data to client (no tokens)
    return NextResponse.json({
      user: response.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message.includes('Invalid') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
