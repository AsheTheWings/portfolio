/**
 * Agent Session Page — Server Component
 * Dynamic route for specific session IDs: /[sessionId]
 * 
 * Fetches session events server-side for instant hydration (no empty-state flash).
 */

import { AgentHome } from '../AgentHome';
import { verifyToken, getTokenCookie } from '@/features/authentication/lib/cookies';
import { fetchAgentServerData, fetchSessionEventsSSR } from '@/features/agent/lib/server-data';

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const payload = await verifyToken();

  const initialUser = payload
    ? { id: payload.userId, username: payload.username }
    : null;

  const token = await getTokenCookie();

  const [agentData, initialEvents] = await Promise.all([
    token ? fetchAgentServerData(token) : Promise.resolve({ tools: [], workflows: [], llmRegistry: null, configuredProviders: [] }),
    token ? fetchSessionEventsSSR(token, sessionId) : Promise.resolve(null),
  ]);

  return (
    <AgentHome
      initialUser={initialUser}
      initialAgentData={agentData}
      initialEvents={initialEvents}
    />
  );
}
