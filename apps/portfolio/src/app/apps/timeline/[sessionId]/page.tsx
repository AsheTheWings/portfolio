/**
 * Agent Session Page — Server Component
 * Dynamic route for specific Timeline sessions: /apps/timeline/[sessionId].
 *
 * Fetches session events server-side for instant hydration.
 */

import { Home } from '@portfolio/timeline/components/Home';
import { verifyToken, getTokenCookie } from '@portfolio/auth/lib/cookies';
import { fetchAgentServerData, fetchSessionEventsSSR } from '@portfolio/timeline/agent/lib/server-data';

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
    <Home
      initialUser={initialUser}
      initialAgentData={agentData}
      initialEvents={initialEvents}
    />
  );
}
