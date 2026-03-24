/**
 * Call Model API Route (Provider-Agnostic)
 * POST /api/agent/call-model
 * Routes to appropriate provider based on agentConfig.provider
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callGemini } from '@/features/agent/services/gemini';
import { callFireworks } from '@/features/agent/services/fireworks';
import type { AgentConfig, SessionEvent } from '@/features/agent/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionEvents, agentConfig } = body as {
      sessionEvents: SessionEvent[];
      agentConfig: AgentConfig;
    };

    // Validate request
    if (!sessionEvents || !agentConfig) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionEvents, agentConfig' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate session events have required fields
    if (!Array.isArray(sessionEvents) || sessionEvents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'sessionEvents must be a non-empty array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (let i = 0; i < sessionEvents.length; i++) {
      const event = sessionEvents[i];
      if (!event.type) {
        return new Response(
          JSON.stringify({ error: `sessionEvents[${i}]: missing required field 'type'` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (!event.data) {
        return new Response(
          JSON.stringify({ error: `sessionEvents[${i}]: missing required field 'data'` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Normalize session events - fill in missing optional fields
    const normalizedEvents = sessionEvents.map((event: Partial<SessionEvent> & { type: string; data: unknown }, index: number) => ({
      eventId: event.eventId || crypto.randomUUID(),
      componentId: event.componentId || crypto.randomUUID(),
      role: event.role || 'user',
      sequence: event.sequence ?? index,
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      data: event.data
    })) as SessionEvent[];

    // Get authenticated user for image generation
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Route to provider
    const provider = agentConfig.provider || 'google';
    let providerCall: AsyncGenerator<SessionEvent>;

    switch (provider) {
      case 'google':
        providerCall = callGemini(normalizedEvents, agentConfig, userId);
        break;
      case 'fireworks':
        providerCall = callFireworks(normalizedEvents, agentConfig);
        break;
      // Future providers:
      // case 'openai':
      //   providerCall = callOpenAI(sessionEvents, agentConfig);
      //   break;
      // case 'anthropic':
      //   providerCall = callAnthropic(sessionEvents, agentConfig);
      //   break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        // Helper to safely enqueue (handles client disconnection)
        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data);
            } catch (err) {
              // Controller closed by client (e.g., navigation, component unmount)
              isClosed = true;
            }
          }
        };

        try {
          // Stream events from provider
          for await (const event of providerCall) {
            // Stop processing if client disconnected
            if (isClosed) break;

            // Pass through event with type, eventId, componentId, and data
            safeEnqueue(
              encoder.encode(
                formatSSE(event.type, {
                  eventId: event.eventId,
                  componentId: event.componentId,
                  data: event.data
                })
              )
            );
          }

          isClosed = true;
          controller.close();
        } catch (error: unknown) {
          // Classify errors: 503 for transient (quota/rate limit), 500 for everything else
          const errorStr = String(error);
          const errorMessage = error instanceof Error ? error.message : errorStr;
          
          // Check if it's a transient error (quota, rate limit, exhaustion)
          const isTransientError =
            errorStr.toLowerCase().includes('exhaust') ||
            errorStr.toLowerCase().includes('quota') ||
            errorStr.toLowerCase().includes('rate limit') ||
            errorStr.includes('429') ||
            errorStr.includes('503');

          if (isTransientError) {
            console.warn('⚠️ Transient error (503):', errorMessage);
            safeEnqueue(
              encoder.encode(
                formatSSE('error', {
                  message: 'Service temporarily unavailable.',
                  code: 503,
                })
              )
            );
          } else {
            // Permanent error (config, auth, etc.) → 500
            console.error('❌ Permanent error (500):', errorMessage);
            safeEnqueue(
              encoder.encode(
                formatSSE('error', {
                  message: 'Internal server error.',
                  code: 500,
                })
              )
            );
          }

          isClosed = true;
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('❌ Failed to process call-model request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process call-model request';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Format SSE message
 */
function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
