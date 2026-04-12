/**
 * /api/productivity/slots/active - Get active slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

export async function GET(_request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const activeSlots = await ProductivityHandlers.getActiveSlots(user.id);
    return NextResponse.json(activeSlots);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
