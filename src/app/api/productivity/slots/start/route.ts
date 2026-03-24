/**
 * /api/productivity/slots/start - Start time tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

interface StartSlotRequest {
  workload_name: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body: StartSlotRequest = await request.json();
    const result = await ProductivityHandlers.startSlot(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/productivity/slots/start failed', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status =
      message === 'Unauthorized'
        ? 401
        : message.includes('already active') || message.includes('not found') || message.includes('No workload')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
