/**
 * /api/productivity/workloads - Workload endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthHandlers } from '@/features/authentication/api';
import { ProductivityHandlers } from '@/features/productivity/api';

interface CreateWorkloadRequest {
  name: string;
  description?: string;
}

export async function GET(_request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const workloads = await ProductivityHandlers.listWorkloads(user.id);
    return NextResponse.json(workloads);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await AuthHandlers.getCurrentUser();
    const body: CreateWorkloadRequest = await request.json();
    const workload = await ProductivityHandlers.createWorkload(user.id, body);
    return NextResponse.json(workload, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status =
      message === 'Unauthorized'
        ? 401
        : message.includes('required') || message.includes('already exists') || message.includes('must be')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
