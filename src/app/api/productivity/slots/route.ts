/**
 * /api/productivity/slots - Slot endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

export async function GET(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const { searchParams } = new URL(request.url);
    const workloadId = searchParams.get('workload_id');

    const slots = await ProductivityHandlers.listSlots(user.id, workloadId);
    return NextResponse.json(slots);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
