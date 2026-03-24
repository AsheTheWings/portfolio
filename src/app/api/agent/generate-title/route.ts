/**
 * Generate Title API
 * POST /api/agent/generate-title - Generate concise title from conversation context
 */

import { NextRequest, NextResponse } from 'next/server';
import { callFireworks } from '@/features/agent/services/fireworks';
import type { AgentConfig, SessionEvent } from '@/features/agent/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/generate-title - Generate session title
 */
export async function POST(request: NextRequest) {
  try {
    const { context } = await request.json();

    if (!context || typeof context !== 'string') {
      return NextResponse.json(
        { error: 'Context string is required' },
        { status: 400 }
      );
    }

    // Minimal config for fast title generation using Kimi K2 Instruct (non-thinking for speed and reliability)
    const config = {
      model: 'accounts/fireworks/models/kimi-k2-instruct',
      provider: 'fireworks',
      systemInstructions: 'Generate a concise 3-6 word title summarizing this conversation. Output only the title with no quotes, punctuation, or explanation.',
      temperature: 0.7,
      maxOutputTokens: 50,
    } as AgentConfig;

    // Create minimal session event for title generation
    const turnId = crypto.randomUUID();
    const sessionEvents: SessionEvent[] = [
      {
        type: 'user-turn-completed',
        eventId: crypto.randomUUID(),
        componentId: crypto.randomUUID(),
        turnId,
        role: 'user',
        sequence: 0,
        timestamp: new Date(),
        data: {
          message: context,
          agentConfig: config,
          metadata: {},
        },
      },
    ];

    // Call model and collect title
    let title = '';
    for await (const event of callFireworks(sessionEvents, config)) {
      if (event.type === 'model-message-completed') {
        title = event.data.message?.trim() || '';
        break;
      }
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Failed to generate title' },
        { status: 500 }
      );
    }

    return NextResponse.json({ title });
  } catch (error: unknown) {
    console.error('❌ Failed to generate title:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate title';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
