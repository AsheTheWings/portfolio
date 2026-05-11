/**
 * Agent Session Page — Server Component
 * Dynamic route for specific session IDs: /[sessionId]
 * 
 * Fetches session events server-side for instant hydration (no empty-state flash).
 */

import { AgentHome } from '../AgentHome';
import { verifyToken, getTokenCookie } from '@/features/authentication/lib/cookies';
import { fetchAgentServerData, fetchSessionEventsSSR } from '@/features/agent/lib/server-data';

export default async function AgentSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  const token = await getTokenCookie();

  const [agentData, initialEvents] = await Promise.all([
    token ? fetchAgentServerData(token) : Promise.resolve({ tools: [], workflows: [], models: [], modelParameters: {}, defaultModelId: null }),
    token ? fetchSessionEventsSSR(token, sessionId) : Promise.resolve(null),
  ]);

  return (
    <AgentHome
      initialUser={initialUser}
      initialTools={agentData.tools}
      initialWorkflows={agentData.workflows}
      initialModels={agentData.models}
      initialModelParameters={agentData.modelParameters}
      initialDefaultModelId={agentData.defaultModelId}
      initialEvents={initialEvents}
    />
  );
}
