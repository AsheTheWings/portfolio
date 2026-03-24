'use client';

/**
 * Agent Playground Layout
 * 
 * Shared layout for /agent-playground and /agent-playground/[sessionId]
 * Renders AgentPlayground directly to prevent remounts on route changes.
 * Session ID is read from URL params within the playground.
 */

import { useParams } from 'next/navigation';
import { AgentProvider, AgentPlayground } from '@/features/agent';

export default function AgentPlaygroundLayout() {
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  return (
    <AgentProvider>
      <AgentPlayground sessionId={sessionId} />
    </AgentProvider>
  );
}
