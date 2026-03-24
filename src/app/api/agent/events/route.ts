/**
 * Agent Events API
 * GET /api/agent/events - Unified endpoint for querying session events
 * 
 * Query params:
 *   - type: 'tool-result' | 'tool-effects' (required)
 *   - server?: string (filter by tool server, e.g., "agent-job")
 *   - limit?: number (pagination, default 1000)
 * 
 * Returns raw SessionEvent[] - consumer handles extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventOperations } from '@/features/agent/services/operations';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'tool-result' | 'tool-effects' | null;
    const server = searchParams.get('server') || undefined;
    const limit = parseInt(searchParams.get('limit') || '1000');

    if (!type || !['tool-result', 'tool-effects'].includes(type)) {
      return NextResponse.json(
        { error: 'Missing or invalid "type" parameter. Must be "tool-result" or "tool-effects"' },
        { status: 400 }
      );
    }

    const events = await EventOperations.loadEventsByType(supabase, user.id, {
      type,
      server,
      limit,
    });

    return NextResponse.json({ events });
  } catch (error: unknown) {
    console.error('❌ Failed to fetch events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch events';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
