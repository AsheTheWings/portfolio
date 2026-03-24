/**
 * POST /api/auth/signup - Register a new user
 * 
 * Proxies signup request to Supabase and sets HTTP-only cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { setAuthCookies } from '@/lib/supabase/cookies';
import type { UserSignup } from '@/features/authentication/types';

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
      // Not authenticated, proceed with signup
    }

    const body: UserSignup = await request.json();
    
    // Get tokens from Supabase (server-to-server)
    const response = await AuthHandlers.signup(body);
    
    // Set tokens + user data as HTTP-only cookies
    await setAuthCookies(
      response.access_token, 
      response.refresh_token,
      response.user
    );
    
    // Return ONLY user data to client (no tokens)
    return NextResponse.json({
      user: response.user,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    // Supabase validation errors (email invalid, already registered, etc.) should be 400
    const isClientError = ['required', 'must be', 'invalid', 'already', 'failed'].some(s =>
      message.toLowerCase().includes(s)
    );
    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}
