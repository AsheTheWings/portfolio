/**
 * Agent Events API (Event-Sourcing)
 * GET /api/agent/sessions/:sessionId/events - Load event history
 * POST /api/agent/sessions/:sessionId/events - Store new events
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionOperations, EventOperations } from '@/features/agent/services/operations';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/sessions/:sessionId/events - Load event history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Authenticate user (RLS automatically filters by auth.uid())
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: User must be authenticated' },
        { status: 401 }
      );
    }

    // Load session metadata (verify ownership via RLS)
    const session = await SessionOperations.getSession(supabase, sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    // Load all events for the session
    const events = await EventOperations.loadSessionEvents(supabase, sessionId);

    return NextResponse.json({
      success: true,
      session,
      events,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to load events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load events';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/sessions/:sessionId/events - Store events
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { events } = await request.json();

    // Authenticate user
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

    // Validate events array
    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Request body must include events array' },
        { status: 400 }
      );
    }

    // Store events
    await EventOperations.storeEvents(supabase, sessionId, events);

    return NextResponse.json({
      success: true,
      stored: events.length,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to store events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to store events';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
