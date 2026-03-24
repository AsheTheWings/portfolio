/**
 * Agent Sessions API
 * GET /api/agent/sessions - List user's sessions
 * POST /api/agent/sessions - Create new session
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionOperations } from '@/features/agent/services/operations';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/sessions - List user's sessions
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: User must be authenticated' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    // List sessions
    const sessions = await SessionOperations.listSessions(supabase, user.id, {
      search,
    });

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to list sessions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list sessions';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/sessions - Create new session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Authenticate user via Supabase
    let supabase = await createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fallback: Try to extract JWT from Authorization header (for testing/API clients)
    if ((authError || !user) && request.headers.get('authorization')) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (token) {
        // Use standard supabase-js client for Bearer token auth
        const { createClient: createJsClient } = await import('@supabase/supabase-js');
        supabase = createJsClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        );
        
        const result = await supabase.auth.getUser();
        user = result.data.user || null;
        authError = result.error;
      }
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: User must be authenticated' },
        { status: 401 }
      );
    }

    // Server always generates sessionId for security and atomicity
    const sessionId = crypto.randomUUID();

    // Create session metadata
    const sessionMetadata = {
      sessionId,
      agentName: body.agentName || 'assistant',
      title: body.title,
      rootSessionId: body.root_session_id,  // For branch tree tracking
    };

    // Delegate to operations layer with authenticated supabase client
    await SessionOperations.createSession(supabase, user.id, sessionMetadata);

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to create session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
