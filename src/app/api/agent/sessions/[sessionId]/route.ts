/**
 * Agent Session by ID API
 * PATCH /api/agent/sessions/:sessionId - Update session metadata
 * DELETE /api/agent/sessions/:sessionId - Delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/agent/sessions/:sessionId - Update session metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    // Authenticate user (RLS enforces ownership)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: User must be authenticated' },
        { status: 401 }
      );
    }

    // Update session (RLS ensures only owned sessions can be updated)
    const updates: Record<string, string | boolean | undefined> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.titleLocked !== undefined) updates.title_locked = body.titleLocked;
    if (body.agentName !== undefined) updates.agent_name = body.agentName;
    if (body.root_session_id !== undefined) updates.root_session_id = body.root_session_id;

    const { error, count } = await supabase
      .from('agent_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }

    // If count is 0, session doesn't exist or user doesn't own it
    if (count === 0) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to update session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent/sessions/:sessionId - Delete session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Authenticate user (RLS enforces ownership)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: User must be authenticated' },
        { status: 401 }
      );
    }

    // Delete turns first (RLS + cascade)
    await supabase
      .from('turns')
      .delete()
      .eq('session_id', sessionId);

    // Delete session
    const { error } = await supabase
      .from('agent_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error: unknown) {
    console.error('❌ Failed to delete session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
