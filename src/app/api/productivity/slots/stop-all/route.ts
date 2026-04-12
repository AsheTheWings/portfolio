/**
 * /api/productivity/slots/stop-all - Batch stop all active slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

export async function POST(_request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const stoppedSlots = await ProductivityHandlers.stopAllSlots(user.id);

    return NextResponse.json({
      slots: stoppedSlots,
      count: stoppedSlots.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status =
      message === 'Unauthorized'
        ? 401
        : message.includes('No active slots')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
