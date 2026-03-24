/**
 * /api/productivity/slots/stop - Stop time tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body = await request.json();
    const { slot_id } = body;

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 });
    }

    const result = await ProductivityHandlers.stopSlot(user.id, slot_id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status =
      message === 'Unauthorized'
        ? 401
        : message.includes('No active slot') || message.includes('not found')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
