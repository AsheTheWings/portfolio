/**
 * Translate API
 * POST /api/agent/translate - Translate text to target language
 */

import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/features/agent/services/gemini';
import type { AgentConfig, SessionEvent } from '@/features/agent/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/translate - Translate message content
 */
export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    // Minimal config for translation
    const config = {
      model: 'gemini-2.5-flash-lite',
      systemInstructions: `You are a translator. Translate the following text to ${targetLanguage}. Output only the translated text without any explanation, quotes, or additional formatting. Preserve the original formatting (markdown, line breaks, etc.) in the translation.`,
      temperature: 0.3,
      maxOutputTokens: 4096,
      stream: false,
    } as AgentConfig;

    // Create minimal session event for translation
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
          message: text,
          agentConfig: config,
          metadata: {},
        },
      },
    ];

    // Call model and collect translation
    let translatedText = '';
    for await (const event of callGemini(sessionEvents, config)) {
      if (event.type === 'model-message-completed') {
        translatedText = event.data.message?.trim() || '';
        break;
      }
    }

    if (!translatedText) {
      return NextResponse.json(
        { error: 'Failed to translate text' },
        { status: 500 }
      );
    }

    return NextResponse.json({ translatedText });
  } catch (error: unknown) {
    console.error('❌ Failed to translate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to translate';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
